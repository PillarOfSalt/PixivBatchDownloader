import browser from 'webextension-polyfill'
import { EVT } from '../EVT'
import { log } from '../Log'
import { lang } from '../Language'
import { fileName } from '../FileName'
import { convertUgoira } from '../ConvertUgoira/ConvertUgoira'
import {
  downloadArgument,
  SendToBackEndData,
  DonwloadSkipData,
} from './DownloadType'
import { progressBar } from './ProgressBar'
import { filter } from '../filter/Filter'
import { downloadRecord } from './DownloadRecord'
import { settings } from '../setting/Settings'
import { makeNovelFile } from './MakeNovelFile'
import { Utils } from '../utils/Utils'
import { Config } from '../Config'
import { msgBox } from '../MsgBox'
import { states } from '../store/States'
import { Tools } from '../Tools'
import { setTimeoutWorker } from '../SetTimeoutWorker'
import { downloadStates } from './DownloadStates'
import { downloadInterval } from './DownloadInterval'

// Handle tasks in the download queue
// Download tasks that are not displayed on the progress bar are not processed here
class Download {
  constructor(
    progressBarIndex: number,
    data: downloadArgument,
    downloadStatesIndex: number
  ) {
    this.progressBarIndex = progressBarIndex
    this.downloadStatesIndex = downloadStatesIndex
    this.beforeDownload(data)
  }

  private progressBarIndex: number
  private downloadStatesIndex: number

  private retry = 0 // Number of retry times
  private lastRequestTime = 0 // The timestamp of the last request was initiated
  private retryInterval: number[] = [] // Save the time difference from the last request each time you arrive at the retry session

  private sizeChecked = false // Have the file volume been checked
  private skip = false // Should this download be skipped? If this file does not meet certain filter conditions, it should be skipped
  private error = false // Is there an unsolvable error during the download process

  private get cancel() {
    return this.skip || this.error || !states.downloading
  }

  // Skip to download this file. Text that can be passed to prompt
  private skipDownload(data: DonwloadSkipData, msg?: string) {
    this.skip = true
    if (msg) {
      log.warning(msg)
    }
    if (states.downloading) {
      EVT.fire('skipDownload', data)
    }
  }

  // Check before starting download
  private async beforeDownload(arg: downloadArgument) {
    // Check if it is a duplicate file
    const duplicate = await downloadRecord.checkDeduplication(arg.result)
    if (duplicate) {
      await downloadInterval.wait()
      return this.skipDownload({
        id: arg.id,
        type: arg.result.type,
        reason: 'duplicate',
      })
    }

    // If it is an animation, check again whether the animation is excluded.
    // Because sometimes the user does not exclude animations when crawling, but excludes animations when downloading. So you need to check again when downloading
    if (arg.result.type === 2 && !settings.downType2) {
      return this.skipDownload({
        id: arg.id,
        reason: 'excludedType',
      })
    }

    // Check aspect and aspect ratio
    if (
      (settings.setWHSwitch || settings.ratioSwitch) &&
      arg.result.type !== 3
    ) {
      // By default, the width and height of the first picture in the current work are used.
      let wh = {
        width: arg.result.fullWidth,
        height: arg.result.fullHeight,
      }
      // If it is not the first image, load the image to get width and height
      if (arg.result.index > 0) {
        // Always get the size of the original image
        wh = await Utils.getImageSize(arg.result.original)
      }

      // If the width and height acquisition fails, the image will be considered to pass the width and height check
      if (wh.width === 0 || wh.height === 0) {
        log.error(
          lang.transl('_获取图片的宽高时出现错误') +
            Tools.createWorkLink(arg.id)
        )
        // The image loading failure may be due to the request timeout, or the image does not exist. The specific reason cannot be obtained here, so I will not return directly.
        // If it is a 404 error, this problem can be handled in the download method
        // If the request timed out, it may pass this image incorrectly
      }

      const result = await filter.check(wh)
      if (!result) {
        return this.skipDownload(
          {
            id: arg.id,
            reason: 'widthHeight',
          },
          lang.transl('_不保存图片因为宽高', Tools.createWorkLink(arg.id))
        )
      }
    }

    this.download(arg)
  }

  // Set progress bar information
  private setProgressBar(name: string, loaded: number, total: number) {
    // Update the progress bar immediately when the download is initialized and download is completed
    // During downloading, use throttling to update the progress bar
    progressBar[loaded === total ? 'setProgress' : 'setProgressThrottle'](
      this.progressBarIndex,
      {
        name,
        loaded,
        total,
      }
    )
  }

  // When the maximum number of retry is reached
  private afterReTryMax(status: number, fileId: string) {
    const errorMsg = lang.transl(
      '_作品id无法下载带状态码',
      Tools.createWorkLink(fileId),
      status.toString()
    )
    // 发生 404 500 错误时跳过这个作品。因为没有触发 downloadError 事件，所以不会重试下载它
    if (status === 404 || status === 500) {
      log.error(errorMsg)
      log.error(lang.transl('_下载器不会再重试下载它'))
      return this.skipDownload({
        id: fileId,
        reason: status.toString() as '404' | '500',
      })
    }

    // The status code is 0, which may be an error caused by insufficient disk space in the system, or a network error caused by proxy software.
    // The status code will also be returned 0
    if (status === 0) {
      // Determine whether there is insufficient disk space. The characteristic is that the interval between each retry is relatively short.
      // If it is a timeout, the waiting time will be longer, which may exceed 20 seconds.
      const timeLimit = 10000 // If the interval from the time from the initiation of the request to the initiation of the retry is less than this value, it is considered to be insufficient disk space
      const result = this.retryInterval.filter((val) => val <= timeLimit)
      // Of all 10 requests, if 9 of them are less than 10 seconds, it may be that there is insufficient disk space.
      if (result.length > 9) {
        log.error(errorMsg)
        const tip = lang.transl('_状态码为0的错误提示')
        log.error(tip)
        msgBox.error(tip)
        return EVT.fire('requestPauseDownload')
      }
    }

    // 其他状态码，暂时跳过这个任务，但最后还是会尝试重新下载它
    log.log(lang.transl('_下载器会暂时跳过它'))
    this.error = true
    EVT.fire('downloadError', fileId)
  }

  // Download the file
  private async download(arg: downloadArgument) {
    // Get the file name
    const _fileName = fileName.createFileName(arg.result)

    // Reset the information of the current download bar
    this.setProgressBar(_fileName, 0, 0)

    // Download the file
    let url: string
    if (arg.result.type === 3) {
      // novel
      if (arg.result.novelMeta) {
        // 生成小说文件
        if (settings.novelSaveAs === 'epub') {
          const blob = await makeNovelFile.makeEPUB(
            arg.result.novelMeta,
            _fileName
          )
          url = URL.createObjectURL(blob)
        } else {
          const blob = await makeNovelFile.makeTXT(
            arg.result.novelMeta,
            _fileName
          )
          url = URL.createObjectURL(blob)
        }
      } else {
        throw new Error('Not found novelMeta')
      }
    } else {
      // For image works, if the image size is set, the specified url will be used, otherwise the original image url will be used.
      url = arg.result[settings.imageSize] || arg.result.original
      await downloadInterval.wait()
    }

    let xhr = new XMLHttpRequest()
    xhr.open('GET', url, true)
    xhr.responseType = 'blob'

    // Show download progress
    xhr.addEventListener('progress', async (event) => {
      // Check volume settings
      if (!this.sizeChecked) {
        this.sizeChecked = true
        const result = await filter.check({ size: event.total })
        if (!result) {
          // When the download is skipped due to volume problems, the download progress may still be 0 or very small, so just pull the progress bar here.
          this.setProgressBar(_fileName, 1, 1)
          this.skipDownload(
            {
              id: arg.id,
              reason: 'size',
            },
            lang.transl('_不保存图片因为体积', Tools.createWorkLink(arg.id))
          )
        }
      }

      if (this.cancel) {
        xhr.abort()
        xhr = null as any
        return
      }

      this.setProgressBar(_fileName, event.loaded, event.total)
    })

    // The file has been loaded or there is an error in loading
    xhr.addEventListener('loadend', async () => {
      if (this.cancel) {
        xhr = null as any
        return
      }

      // File to be downloaded
      let file: Blob = xhr.response

      // Some pictures may not have content-length when downloading, and the download progress cannot be calculated.
      // So after loadend, pull the download progress
      if (file?.size) {
        this.setProgressBar(_fileName, file.size, file.size)
      } else {
        // Sometimes file is null, so the size property cannot be obtained. It's not clear what the reason is
        console.log(file)
      }

      // The status code is wrong, enter the retry process
      if (xhr.status !== 200) {
        // 正常下载完毕的状态码是 200
        // 储存重试的时间戳等信息
        this.retryInterval.push(Date.now() - this.lastRequestTime)

        progressBar.errorColor(this.progressBarIndex, true)
        this.retry++

        if (this.retry >= Config.retryMax) {
          // Retry to the maximum number of times
          this.afterReTryMax(xhr.status, arg.id)
        } else {
          // Start trying again
          return this.download(arg)
        }
      } else {
        // The status code is normal
        progressBar.errorColor(this.progressBarIndex, false)
        // 需要转换动图的情况
        const convertExt = ['webm', 'gif', 'apng']
        const ext = settings.ugoiraSaveAs
        if (
          convertExt.includes(ext) &&
          arg.result.ugoiraInfo &&
          settings.imageSize !== 'thumb'
        ) {
          // When downloading the square thumbnail of the picture, the animation is not converted, because the static thumbnail of the work is downloaded at this time, and it cannot be converted
          try {
            if (ext === 'webm') {
              file = await convertUgoira.webm(
                file,
                arg.result.ugoiraInfo,
                arg.result.idNum
              )
            }

            if (ext === 'gif') {
              file = await convertUgoira.gif(
                file,
                arg.result.ugoiraInfo,
                arg.result.idNum
              )
            }

            if (ext === 'apng') {
              file = await convertUgoira.apng(
                file,
                arg.result.ugoiraInfo,
                arg.result.idNum
              )
            }
          } catch (error) {
            const msg = lang.transl(
              '_动图转换失败的提示',
              Tools.createWorkLink(arg.result.idNum)
            )
            // Because I will try again, it will not be displayed on the log
            // log.error(msg, 1)
            console.error(msg)

            this.error = true
            EVT.fire('downloadError', arg.id)
          }
        }
      }

      if (this.cancel) {
        return
      }

      // 生成下载链接
      const blobURL = URL.createObjectURL(file)

      // Color checks on illustrations and comics
      // The main reason for checking here: when grabbing, you will only check the color of the single-image work, and you will not check the color of the multi-image work. Therefore, multi-picture works need to be inspected here.
      // Another reason: If the color condition of the image is not set during crawling and the color condition is set during downloading, then it must be checked here.
      if (arg.result.type === 0 || arg.result.type === 1) {
        const result = await filter.check({
          mini: blobURL,
        })
        if (!result) {
          return this.skipDownload(
            {
              id: arg.id,
              reason: 'color',
            },
            lang.transl('_不保存图片因为颜色', Tools.createWorkLink(arg.id))
          )
        }
      }

      // Send download tasks to the browser
      if (settings.setFileDownloadOrder) {
        await this.waitPreviousFileDownload()
      }
      this.browserDownload(file, blobURL, _fileName, arg.id, arg.taskBatch)
      xhr = null as any
      file = null as any
    })

    this.lastRequestTime = Date.now()
    // 没有设置 timeout，默认值是 0，不会超时
    xhr.send()
  }

  // Wait for the previous file to be downloaded successfully (the browser saves the file to the hard disk), and then save the file. This is to ensure that the file is saved incorrectly
  private waitPreviousFileDownload() {
    return new Promise(async (resolve) => {
      if (this.downloadStatesIndex === 0) {
        return resolve(true)
      }

      if (downloadStates.states[this.downloadStatesIndex - 1] === 1) {
        return resolve(true)
      } else {
        return resolve(
          new Promise((resolve) => {
            setTimeoutWorker.set(() => {
              resolve(this.waitPreviousFileDownload())
            }, 50)
          })
        )
      }
    })
  }

  // 向浏览器发送下载任务
  private async browserDownload(
    blob: Blob,
    blobURL: string,
    fileName: string,
    id: string,
    taskBatch: number
  ) {
    // If the task has been stopped, the download task will not be sent to the browser.
    if (this.cancel) {
      // 释放 blob URL
      URL.revokeObjectURL(blobURL)
      return
    }

    let dataURL: string | undefined = undefined
    if (Config.sendDataURL) {
      dataURL = await Utils.blobToDataURL(blob)
    }

    const sendData: SendToBackEndData = {
      msg: 'save_work_file',
      fileName: fileName,
      id,
      taskBatch,
      blobURL,
      blob: Config.sendBlob ? blob : undefined,
      dataURL,
    }

    // 使用 a.download 来下载文件时，不调用 downloads API
    if (settings.rememberTheLastSaveLocation) {
      // 移除文件夹，只保留文件名部分，因为这种方式不支持建立文件夹
      // 路径符号 / 会被浏览器处理成 _，例如：
      // pixiv/mojo-94576902/136825223_p0-藤田ことね🎃.png 会变成：
      // pixiv_mojo-94576902_136825223_p0-藤田ことね🎃.png
      // 所以我只保留了文件名部分
      const lastName = fileName.split('/').pop()
      Utils.downloadFile(blobURL, lastName!)
      sendData.msg = 'save_work_file_a_download'
      browser.runtime.sendMessage(sendData)
      return
    }

    try {
      browser.runtime.sendMessage(sendData)
      EVT.fire('sendBrowserDownload')
    } catch (error) {
      let msg = `${lang.transl('_发生错误原因')}<br>{}${lang.transl(
        '_请刷新页面'
      )}`
      if ((error as Error).message.includes('Extension context invalidated')) {
        msg = msg.replace('{}', lang.transl('_扩展程序已更新'))
        log.error(msg)
        msgBox.error(msg)
        return
      }

      console.error(error)
      msg = msg.replace('{}', lang.transl('_未知错误'))
      log.error(msg)
      msgBox.error(msg)
    }
  }
}

export { Download }

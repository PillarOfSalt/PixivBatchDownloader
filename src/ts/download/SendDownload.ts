import browser from 'webextension-polyfill'
import { Config } from '../Config'
import { settings } from '../setting/Settings'
import { Utils } from '../utils/Utils'
import { SendToBackEndData } from './DownloadType'

class SendDownload {
  // 由于现在有两种下载方式：交给浏览器下载和使用 a 标签下载，所以在这里统一处理
  /** 不检查下载状态，默认下载成功。这些文件是不会出现在下载进度条上的独立文件 */
  static async noReply(
    blob: Blob,
    name: string,
    conflictAction?: 'uniquify' | 'overwrite' | 'prompt'
  ) {
    const blobURL = URL.createObjectURL(blob)

    // 如果需要使用 a.download 来下载文件
    if (settings.rememberTheLastSaveLocation) {
      // 移除文件夹，只保留文件名部分，因为这种方式不支持建立文件夹
      const lastName = name.split('/').pop()
      Utils.downloadFile(blobURL, lastName!)
    } else {
      // 调用 downloads API
      let dataURL: string | undefined = undefined
      if (Config.sendDataURL) {
        dataURL = await Utils.blobToDataURL(blob)
      }

      const sendData: SendToBackEndData = {
        msg: 'save_novel_series_file',
        fileName: name,
        id: 'fake',
        taskBatch: -1,
        blobURL,
        blob: Config.sendBlob ? blob : undefined,
        dataURL,
        conflictAction,
      }
      browser.runtime.sendMessage(sendData)
    }
  }
}

export { SendDownload }

import { EVT } from '../EVT'
import { store } from '../store/Store'
import { DonwloadSuccessData, SendToBackEndData } from './DownloadType'
import { DonwloadSkipData } from './DownloadType'
import { fileName } from '../FileName'
import { Result } from '../store/StoreType'
import { settings } from '../setting/Settings'
import { Utils } from '../utils/Utils'
import { Tools } from '../Tools'
import { SendDownload } from './SendDownload'

// 为每个作品创建一个单独的文件，保存这个作品的元数据
class SaveWorkMeta {
  constructor() {
    this.bindEvents()
  }

  // Save the id of the work that has downloaded the metadata

  private savedIds: string[] = []

  private readonly CRLF = '\n' // Line breaks used in txt files

  private bindEvents() {
    // When a work file is downloaded successfully, save its metadata

    window.addEventListener(EVT.list.downloadSuccess, (ev: CustomEventInit) => {
      const successData = ev.detail.data as DonwloadSuccessData
      this.saveMeta(successData.id)
    })

    window.addEventListener(EVT.list.skipDownload, (ev: CustomEventInit) => {
      const skipData = ev.detail.data as DonwloadSkipData
      if (skipData.reason === 'duplicate') {
        this.saveMeta(skipData.id)
      }
    })

    // When a new crawl begins, clear the saved id list

    window.addEventListener(EVT.list.crawlStart, () => {
      this.savedIds = []
    })
  }

  // Add a metadata
  // Add line breaks after name and value
  /* 
  private addMeta(name: string, value: string) {
    return `${name}${this.CRLF}${value}${this.CRLF.repeat(2)}`
  }

  private getWorkURL(data: Result) {
    return `https://www.pixiv.net/${data.type === 3 ? 'n' : 'i'}/${data.idNum}`
  }


  private joinTags(tags: String[]) {
    const format = tags.map((tag) => '#' + tag)
    return format.join(this.CRLF)
  }
*/
  private xmlWrapper(value: string) {
    return (
      "<?xpacket begin='﻿' id='W5M0MpCehiHzreSzNTczkc9d'?>" +
      this.CRLF +
      "<x:xmpmeta xmlns:x='adobe:ns:meta/' x:xmptk='Image::ExifTool 13.00'>" +
      this.CRLF +
      "<rdf:RDF xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns#'>" +
      this.CRLF +
      value +
      this.CRLF +
      '</rdf:RDF>' +
      this.CRLF +
      '</x:xmpmeta>' +
      this.CRLF +
      "<?xpacket end='w'?>"
    )
  }
  private xmlDesc1(value: string) {
    return (
      "<rdf:Description rdf:about=''" +
      this.CRLF +
      "xmlns:dc='http://purl.org/dc/elements/1.1/'>" +
      this.CRLF +
      '<dc:description>' +
      this.CRLF +
      '<rdf:Alt>' +
      this.CRLF +
      "<rdf:li xml:lang='x-default'>" +
      value +
      '</rdf:li>' +
      this.CRLF +
      '</rdf:Alt>' +
      this.CRLF +
      '</dc:description>' +
      this.CRLF +
      '</rdf:Description>' +
      this.CRLF
    )
  }
  private xmlTagsList(value: string) {
    return (
      "<rdf:Description rdf:about=''" +
      this.CRLF +
      "xmlns:digiKam='http://www.digikam.org/ns/1.0/'>" +
      this.CRLF +
      '<digiKam:TagsList>' +
      this.CRLF +
      '<rdf:Seq>' +
      this.CRLF +
      value +
      this.CRLF +
      '</rdf:Seq>' +
      this.CRLF +
      '</digiKam:TagsList>' +
      this.CRLF +
      '</rdf:Description>' +
      this.CRLF
    )
  }
  private xmlDesc2(value: string) {
    return (
      "<rdf:Description rdf:about=''" +
      this.CRLF +
      "xmlns:tiff='http://ns.adobe.com/tiff/1.0/'>" +
      this.CRLF +
      '<tiff:ImageDescription>' +
      this.CRLF +
      '<rdf:Alt>' +
      this.CRLF +
      "<rdf:li xml:lang='x-default'>" +
      value +
      '</rdf:li>' +
      this.CRLF +
      '</rdf:Alt>' +
      this.CRLF +
      '</tiff:ImageDescription>' +
      this.CRLF +
      '</rdf:Description>'
    )
  }
  private xmlJoinTags(tags: String[]) {
    const format = tags.map((tag) => '<rdf:li>pixiv/' + tag + '</rdf:li>')
    return format.join(this.CRLF)
  }

  // Judging whether it is necessary to save its metadata based on the type of work

  private checkNeedSave(type: 0 | 1 | 2 | 3): boolean {
    switch (type) {
      case 0:
        return settings.saveMetaType0
      case 1:
        return settings.saveMetaType1
      case 2:
        return settings.saveMetaType2
      case 3:
        return settings.saveMetaType3
      default:
        return false
    }
  }

  private async saveMeta(id: string) {
    // 如果所有类型的作品都不需要保存元数据
    if (
      !settings.saveMetaType0 &&
      !settings.saveMetaType1 &&
      !settings.saveMetaType2 &&
      !settings.saveMetaType3
    ) {
      return
    }

    if (!settings.saveMetaFormatTXT && !settings.saveMetaFormatJSON) {
      return
    }

    if (this.savedIds.includes(id)) {
      return
    }

    // Find data for this work

    const dataSource =
      store.resultMeta.length > 0 ? store.resultMeta : store.result
    const data = dataSource.find((val) => val.idNum === Number.parseInt(id))
    if (data === undefined) {
      console.error(`Not find ${id} in result`)
      return
    }

    if (this.checkNeedSave(data.type) === false) {
      return
    }
    this.savedIds.push(id)

    // 生成文件名
    // 元数据文件需要和它对应的图片/小说文件的路径相同，文件名相似，这样它们才能在资源管理器里排在一起，便于查看

    // 生成这个数据的路径和文件名
    const _fileName = fileName.createFileName(data)
    // 取出后缀名之前的部分
    // const index = _fileName.lastIndexOf('.')
    // let part1 = _fileName.substring(0, index)
    let part1 = _fileName.replace(data.id, id)

    if (settings.zeroPadding) {
      // 把 id 字符串换成数字 id，这是为了去除 id 后面可能存在的序号，如 p0
      // 但如果用户启用了在序号前面填充 0，则不替换 id，因为文件名里的 id 后面可能带多个 0，如 p000，用 idNum 去替换的话替换不了后面两个 0
      const index = id.lastIndexOf('p')
      const num = id.substring(index + 1)
      part1 = _fileName.replace(
        /p\d+\./,
        `p${num.padStart(settings.zeroPaddingLength, '0')}.`
      )

      // part1 = part1.replace(data.id, data.idNum.toString())
    }
    // 拼接出元数据文件的文件名，不包含后缀名
    // const metaFileName = `${part1}-meta`
    const metaFileName = `${part1}`

    this.saveTXT(data, metaFileName)
    this.saveJSON(data, metaFileName)
  }

  private async saveTXT(data: Result, metaFileName: string) {
    if (!settings.saveMetaFormatTXT) {
      return
    }

    const fileContent: string[] = []
    const desc = Utils.htmlToText(Tools.replaceATag(data.description))
    fileContent.push(
      this.xmlWrapper(
        this.xmlDesc1(desc) +
          this.xmlTagsList(this.xmlJoinTags(data.tagsWithTransl)) +
          this.xmlDesc2(desc)
      )
    )
    /*
    fileContent.push(this.addMeta('ID', data.idNum.toString()))
    fileContent.push(this.addMeta('URL', this.getWorkURL(data)))
    if (data.type !== 3) {
      fileContent.push(this.addMeta('Original', data.original))
    }
    fileContent.push(this.addMeta('Thumbnail', data.thumb))
    fileContent.push(
      this.addMeta('xRestrict', Tools.getXRestrictText(data.xRestrict)!)
    )

    const checkAITag = data.tags.includes('AI生成')
    fileContent.push(
      this.addMeta('AI', Tools.getAITypeText(checkAITag ? 2 : data.aiType || 0))
    )
    fileContent.push(this.addMeta('User', data.user))
    fileContent.push(this.addMeta('UserID', data.userId))
    fileContent.push(this.addMeta('Title', data.title))
    fileContent.push(
      this.addMeta(
        'Description',
        Utils.htmlToText(Tools.replaceATag(data.description))
      )
    )
    fileContent.push(this.addMeta('Tags', this.joinTags(data.tags)))
    if (data.type !== 3) {
      fileContent.push(
        this.addMeta('Size', `${data.fullWidth} x ${data.fullHeight}`)
      )
    }
    fileContent.push(this.addMeta('Bookmark', data.bmk.toString()))
    fileContent.push(this.addMeta('Date', data.date))
*/
    // Generate files

    // 保存文件
    const blob = new Blob(fileContent, {
      type: 'application/x-trash',
    })
    SendDownload.noReply(blob, metaFileName + '.xmp')
  }

  private async saveJSON(data: Result, metaFileName: string) {
    if (!settings.saveMetaFormatJSON) {
      return
    }

    // 保存文件
    const blob = Utils.json2Blob(data)
    SendDownload.noReply(blob, metaFileName + '.json')
  }
}

new SaveWorkMeta()

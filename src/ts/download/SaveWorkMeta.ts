import { EVT } from '../EVT'
import { store } from '../store/Store'
import { DonwloadSuccessData } from './DownloadType'
import { DonwloadSkipData } from './DownloadType'
import { fileName } from '../FileName'
import { Result } from '../store/StoreType'
import { settings } from '../setting/Settings'
import { Utils } from '../utils/Utils'
import { Tools } from '../Tools'

// Create a txt file for each work to save the metadata of this work

class SaveWorkMeta {
  constructor() {
    this.bindEvents()
  }

  // Save the id of the work that has downloaded the metadata
<<<<<<< HEAD

  private savedIds: string[] = []

=======

  private savedIds: number[] = []

>>>>>>> 12b527125098dd024769af44e4a825d5c926ffd1
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
<<<<<<< HEAD
        this.saveMeta(skipData.id)
=======
        this.saveMeta(Number.parseInt(skipData.id))
>>>>>>> 12b527125098dd024769af44e4a825d5c926ffd1
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
<<<<<<< HEAD
      '<rdf:Seq>' +
      this.CRLF +
=======
>>>>>>> 12b527125098dd024769af44e4a825d5c926ffd1
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

<<<<<<< HEAD
  private saveMeta(id: string) {
=======
  private saveMeta(id: number) {
>>>>>>> 12b527125098dd024769af44e4a825d5c926ffd1
    // If all types of works do not need to save metadata

    if (
      !settings.saveMetaType0 &&
      !settings.saveMetaType1 &&
      !settings.saveMetaType2 &&
      !settings.saveMetaType3
    ) {
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

    // Add file content

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

    const blob = new Blob(fileContent, {
      type: 'application/x-trash',
    })

    // Generate file name
    // The metadata file needs to have the same path and similar file names as its corresponding picture/novel file, so that they can be arranged together in the Explorer for easy viewing.

    // The path and file name to generate this data

    const _fileName = fileName.createFileName(data)
    // Take out the part before the suffix name

    // const index = _fileName.lastIndexOf('.')
<<<<<<< HEAD
    let part1 = _fileName.replace(data.id, id)
=======
    // let part1 = _fileName.substring(0, index)
>>>>>>> 12b527125098dd024769af44e4a825d5c926ffd1

    // if (!settings.zeroPadding) {
    //   // Swap the id string with a number id, which is to remove the possible sequence numbers after id, such as p0
    //   // However, if the user enables 0 in front of the sequence number, the id will not be replaced, because the id in the file name may have multiple 0s followed by p000. If you replace it with idNum, the next two 0s cannot be replaced.

    //   part1 = part1.replace(data.id, data.idNum.toString())
    // }
    // // Splice out the file name of the metadata file

<<<<<<< HEAD
    const metaFileName = `${part1}.xmp`
    // const metaFileName = `${_fileName}.xmp`
=======
    // const metaFileName = `${part1}.xmp`
    const metaFileName = `${_fileName}.xmp`
>>>>>>> 12b527125098dd024769af44e4a825d5c926ffd1

    // Send a download request
    // Because I'm lazy, the background will not return to the download status, and the default is successful download

    chrome.runtime.sendMessage({
      msg: 'save_description_file',
      fileUrl: URL.createObjectURL(blob),
      fileName: metaFileName,
    })

    this.savedIds.push(id)
  }
}

new SaveWorkMeta()

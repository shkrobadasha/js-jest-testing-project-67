import { promises as fs } from 'fs'
import path from 'path'
import axios from 'axios'
import * as cheerio from 'cheerio'
import debug from 'debug'

const log = debug('page-loader')

export const getFileName = (url) => {
  const name = url.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9]/g, '-')
  return `${name}.html`
}

const getResourceDirName = (url) =>
  getFileName(url).replace(/\.html$/, '_files')

const getAssetFileName = (assetUrl) => {
  const { hostname, pathname } = new URL(assetUrl)
  const ext = path.extname(pathname)
  const stemPart = ext ? pathname.slice(0, -ext.length) : pathname
  const stem = `${hostname}${stemPart}`.replace(/[^a-zA-Z0-9]/g, '-')
  return `${stem}${ext || '.html'}`
}

const isLocalResource = (pageUrl, assetUrl) =>
  new URL(pageUrl).hostname === new URL(assetUrl).hostname

const loadError = (error, url) => {
  if (error.response) {
    return new Error(
      `Не удалось загрузить ${url}: сервер вернул статус ${error.response.status}`,
      { cause: error },
    )
  }
  if (error.code) {
    return new Error(
      `Не удалось загрузить ${url}: сетевая ошибка (${error.code})`,
      { cause: error },
    )
  }
  return new Error(`Не удалось загрузить ${url}: ${error.message}`, {
    cause: error,
  })
}

const load = async (url, options) => {
  try {
    return await axios.get(url, options)
  } catch (error) {
    throw loadError(error, url)
  }
}

const saveFile = async (filepath, data) => {
  try {
    await fs.writeFile(filepath, data)
  } catch (error) {
    throw new Error(`Не удалось сохранить файл ${filepath}: ${error.message}`, {
      cause: error,
    })
  }
}

const downloadResource = async (assetUrl, output, dirName) => {
  const filename = getAssetFileName(assetUrl)
  log('Скачивание ресурса %s', assetUrl)
  const { data } = await load(assetUrl, { responseType: 'arraybuffer' })
  await saveFile(path.join(output, dirName, filename), Buffer.from(data))
  log('Ресурс сохранён: %s', filename)
  return filename
}

const processResources = (
  $,
  selector,
  attr,
  url,
  output,
  dirName,
  promises,
  onError,
) => {
  $(selector).each((_, element) => {
    const value = $(element).attr(attr)
    if (!value || value.startsWith('data:')) return
    const absoluteUrl = new URL(value, url).href
    if (!isLocalResource(url, absoluteUrl)) {
      log('Пропущен внешний ресурс %s', absoluteUrl)
      return
    }
    promises.push(
      downloadResource(absoluteUrl, output, dirName)
        .then((filename) => {
          $(element).attr(attr, `${dirName}/${filename}`)
        })
        .catch((error) => onError(error)),
    )
  })
}

export default async function pageLoader(url, output) {
  log('Загрузка страницы %s в %s', url, output)
  const { data } = await load(url)
  log('Страница загружена, размер %d байт', data.length)

  const $ = cheerio.load(data)
  const dirName = getResourceDirName(url)
  const assetPromises = []
  let resourceError = null
  const recordError = (error) => {
    resourceError = resourceError || error
  }

  processResources(
    $,
    'img[src]',
    'src',
    url,
    output,
    dirName,
    assetPromises,
    recordError,
  )
  processResources(
    $,
    'script[src]',
    'src',
    url,
    output,
    dirName,
    assetPromises,
    recordError,
  )
  processResources(
    $,
    'link[href]',
    'href',
    url,
    output,
    dirName,
    assetPromises,
    recordError,
  )

  if (assetPromises.length > 0) {
    const assetsDir = path.join(output, dirName)
    try {
      await fs.mkdir(assetsDir, { recursive: true })
    } catch (error) {
      throw new Error(
        `Не удалось создать директорию ${assetsDir}: ${error.message}`,
        {
          cause: error,
        },
      )
    }
    log('Создана директория ресурсов %s', dirName)
    await Promise.all(assetPromises)
    if (resourceError) throw resourceError
  }

  const filepath = path.join(output, getFileName(url))
  await saveFile(filepath, assetPromises.length > 0 ? $.html() : data)
  log('Страница сохранена: %s', filepath)
  return { filepath }
}

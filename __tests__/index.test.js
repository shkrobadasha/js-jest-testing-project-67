import { test, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import { fileURLToPath } from 'url'
import os from 'os'
import path from 'path'
import nock from 'nock'
import pageLoader, { getFileName } from '../src/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturesPath = (name) => path.join(__dirname, '..', '__fixtures__', name)

let tempDir

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'))
})

afterEach(() => {
  nock.cleanAll()
})

test('формирует имя файла из адреса страницы', () => {
  expect(getFileName('https://ru.hexlet.io/courses')).toBe(
    'ru-hexlet-io-courses.html',
  )
})

test('скачивает страницу и сохраняет её в указанную директорию', async () => {
  const url = 'https://ru.hexlet.io/courses'
  const html = '<html><body>Hello, Hexlet!</body></html>'
  nock('https://ru.hexlet.io').get('/courses').reply(200, html)

  const { filepath } = await pageLoader(url, tempDir)

  expect(filepath).toBe(path.join(tempDir, 'ru-hexlet-io-courses.html'))
  const content = await fs.readFile(filepath, 'utf-8')
  expect(content).toBe(html)
})

test('возвращает объект с путём к сохранённому файлу', async () => {
  const url = 'https://example.com/page'
  nock('https://example.com').get('/page').reply(200, '<html></html>')

  const result = await pageLoader(url, tempDir)

  expect(result).toEqual({
    filepath: path.join(tempDir, 'example-com-page.html'),
  })
})

test('скачивает все локальные ресурсы и заменяет ссылки в HTML', async () => {
  const url = 'https://ru.hexlet.io/courses'
  const pageHtml = await fs.readFile(fixturesPath('page.html'), 'utf-8')
  const png = await fs.readFile(fixturesPath('nodejs.png'))
  const css = 'body { color: red; }'
  const js = 'console.log("runtime");'

  nock('https://ru.hexlet.io').get('/courses').twice().reply(200, pageHtml)
  nock('https://ru.hexlet.io').get('/assets/application.css').reply(200, css)
  nock('https://ru.hexlet.io')
    .get('/assets/professions/nodejs.png')
    .reply(200, png)
  nock('https://ru.hexlet.io').get('/packs/js/runtime.js').reply(200, js)

  const { filepath } = await pageLoader(url, tempDir)

  const filesDir = path.join(tempDir, 'ru-hexlet-io-courses_files')

  const imagePath = path.join(
    filesDir,
    'ru-hexlet-io-assets-professions-nodejs.png',
  )
  const savedPng = await fs.readFile(imagePath)
  expect(savedPng.equals(png)).toBe(true)

  const cssPath = path.join(filesDir, 'ru-hexlet-io-assets-application.css')
  expect(await fs.readFile(cssPath, 'utf-8')).toBe(css)

  const jsPath = path.join(filesDir, 'ru-hexlet-io-packs-js-runtime.js')
  expect(await fs.readFile(jsPath, 'utf-8')).toBe(js)

  const canonicalPath = path.join(filesDir, 'ru-hexlet-io-courses.html')
  expect(await fs.readFile(canonicalPath, 'utf-8')).toBe(pageHtml)

  await expect(
    fs.access(path.join(filesDir, 'ru-hexlet-io-assets-menu.css')),
  ).rejects.toThrow()

  const savedHtml = await fs.readFile(filepath, 'utf-8')
  expect(savedHtml).toContain(
    'src="ru-hexlet-io-courses_files/ru-hexlet-io-assets-professions-nodejs.png"',
  )
  expect(savedHtml).toContain(
    'href="ru-hexlet-io-courses_files/ru-hexlet-io-assets-application.css"',
  )
  expect(savedHtml).toContain(
    'src="ru-hexlet-io-courses_files/ru-hexlet-io-packs-js-runtime.js"',
  )
  expect(savedHtml).toContain(
    'href="ru-hexlet-io-courses_files/ru-hexlet-io-courses.html"',
  )
  expect(savedHtml).toContain('https://cdn2.hexlet.io/assets/menu.css')
  expect(savedHtml).toContain('https://js.stripe.com/v3/')
  expect(savedHtml).toContain('href="/professions/nodejs"')
})

test('бросает ошибку, если страница вернула статус, отличный от 200', async () => {
  const url = 'https://ru.hexlet.io/courses'
  nock('https://ru.hexlet.io').get('/courses').reply(500, 'Server Error')

  await expect(pageLoader(url, tempDir)).rejects.toThrow(
    `Не удалось загрузить ${url}: сервер вернул статус 500`,
  )
})

test('бросает ошибку при сетевой проблеме при загрузке страницы', async () => {
  const url = 'https://ru.hexlet.io/courses'
  const networkError = new Error('connection refused')
  networkError.code = 'ECONNREFUSED'
  nock('https://ru.hexlet.io').get('/courses').replyWithError(networkError)

  await expect(pageLoader(url, tempDir)).rejects.toThrow(
    `Не удалось загрузить ${url}: сетевая ошибка (ECONNREFUSED)`,
  )
})

test('бросает ошибку, если ресурс не загрузился, и указывает его адрес', async () => {
  const url = 'https://ru.hexlet.io/courses'
  const html =
    '<html><head><link rel="stylesheet" href="/assets/application.css"></head></html>'
  nock('https://ru.hexlet.io').get('/courses').reply(200, html)
  nock('https://ru.hexlet.io')
    .get('/assets/application.css')
    .reply(404, 'not found')

  await expect(pageLoader(url, tempDir)).rejects.toThrow(
    'https://ru.hexlet.io/assets/application.css',
  )
})

test('бросает ошибку, если директория назначения недоступна', async () => {
  const url = 'https://example.com/page'
  nock('https://example.com').get('/page').reply(200, '<html></html>')

  const missingDir = path.join(tempDir, 'no', 'such', 'dir')

  await expect(pageLoader(url, missingDir)).rejects.toThrow(
    'Не удалось сохранить файл',
  )
})

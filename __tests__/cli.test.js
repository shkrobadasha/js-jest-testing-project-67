import {
  test,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from 'vitest'
import { promises as fs } from 'fs'
import { createServer } from 'http'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { fileURLToPath } from 'url'
import os from 'os'
import path from 'path'

const execFileAsync = promisify(execFile)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const binPath = path.join(__dirname, '..', 'bin', 'page-loader.js')

let server
let baseUrl
let tempDir

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === '/courses') {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<html><body>Hello, Hexlet!</body></html>')
    } else {
      res.writeHead(500, { 'Content-Type': 'text/plain' })
      res.end('Server Error')
    }
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  baseUrl = `http://127.0.0.1:${port}`
})

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve))
})

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-cli-'))
})

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true })
})

test('CLI сохраняет страницу и выводит путь в stdout', async () => {
  const { stdout, stderr } = await execFileAsync(process.execPath, [
    binPath,
    '--output',
    tempDir,
    `${baseUrl}/courses`,
  ])

  expect(stderr).toBe('')
  const url = `${baseUrl}/courses`
  const expectedFilename = `${url
    .replace(/^https?:\/\//, '')
    .replace(/[^a-zA-Z0-9]/g, '-')}.html`
  expect(stdout.trim()).toBe(path.join(tempDir, expectedFilename))

  const saved = await fs.readFile(path.join(tempDir, expectedFilename), 'utf-8')
  expect(saved).toBe('<html><body>Hello, Hexlet!</body></html>')
})

test('CLI выводит ошибку в stderr и завершается с ненулевым кодом', async () => {
  let error

  try {
    await execFileAsync(process.execPath, [binPath, `${baseUrl}/missing`])
  } catch (err) {
    error = err
  }

  expect(error.code).toBe(1)
  expect(error.stdout).toBe('')
  expect(error.stderr).toContain('Не удалось загрузить')
  expect(error.stderr).toContain(`${baseUrl}/missing`)
})

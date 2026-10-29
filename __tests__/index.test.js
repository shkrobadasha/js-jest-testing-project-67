import { test, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import os from 'os';
import path from 'path';
import nock from 'nock';
import pageLoader, { getFileName } from '../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesPath = (name) => path.join(__dirname, '..', '__fixtures__', name);

let tempDir;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
});

afterEach(() => {
  nock.cleanAll();
});

test('формирует имя файла из адреса страницы', () => {
  expect(getFileName('https://ru.hexlet.io/courses')).toBe(
    'ru-hexlet-io-courses.html',
  );
});

test('скачивает страницу и сохраняет её в указанную директорию', async () => {
  const url = 'https://ru.hexlet.io/courses';
  const html = '<html><body>Hello, Hexlet!</body></html>';
  nock('https://ru.hexlet.io').get('/courses').reply(200, html);

  const { filepath } = await pageLoader(url, tempDir);

  expect(filepath).toBe(path.join(tempDir, 'ru-hexlet-io-courses.html'));
  const content = await fs.readFile(filepath, 'utf-8');
  expect(content).toBe(html);
});

test('возвращает объект с путём к сохранённому файлу', async () => {
  const url = 'https://example.com/page';
  nock('https://example.com').get('/page').reply(200, '<html></html>');

  const result = await pageLoader(url, tempDir);

  expect(result).toEqual({
    filepath: path.join(tempDir, 'example-com-page.html'),
  });
});

test('скачивает локальные изображения и заменяет ссылки в HTML', async () => {
  const url = 'https://ru.hexlet.io/courses';
  const pageHtml = await fs.readFile(fixturesPath('page.html'), 'utf-8');
  const png = await fs.readFile(fixturesPath('nodejs.png'));

  nock('https://ru.hexlet.io').get('/courses').reply(200, pageHtml);
  nock('https://ru.hexlet.io')
    .get('/assets/professions/nodejs.png')
    .reply(200, png);

  const { filepath } = await pageLoader(url, tempDir);

  const imageDir = path.join(tempDir, 'ru-hexlet-io-courses_files');
  const imagePath = path.join(
    imageDir,
    'ru-hexlet-io-assets-professions-nodejs.png',
  );
  const savedPng = await fs.readFile(imagePath);
  expect(savedPng.equals(png)).toBe(true);

  const savedHtml = await fs.readFile(filepath, 'utf-8');
  expect(savedHtml).toContain(
    'src="ru-hexlet-io-courses_files/ru-hexlet-io-assets-professions-nodejs.png"',
  );
  expect(savedHtml).toContain('href="/professions/nodejs"');
});
import { promises as fs } from 'fs';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';

export const getFileName = (url) => {
  const name = url.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9]/g, '-');
  return `${name}.html`;
};

const getResourceDirName = (url) => getFileName(url).replace(/\.html$/, '_files');

const getAssetFileName = (assetUrl) => {
  const { hostname, pathname } = new URL(assetUrl);
  const ext = path.extname(pathname);
  const stemPart = ext ? pathname.slice(0, -ext.length) : pathname;
  const stem = `${hostname}${stemPart}`.replace(/[^a-zA-Z0-9]/g, '-');
  return `${stem}${ext || '.html'}`;
};

const isLocalResource = (pageUrl, assetUrl) =>
  new URL(pageUrl).hostname === new URL(assetUrl).hostname;

const downloadResource = async (assetUrl, output, dirName) => {
  const filename = getAssetFileName(assetUrl);
  const { data } = await axios.get(assetUrl, { responseType: 'arraybuffer' });
  await fs.writeFile(path.join(output, dirName, filename), Buffer.from(data));
  return filename;
};

const processResources = ($, selector, attr, url, output, dirName, promises) => {
  $(selector).each((_, element) => {
    const value = $(element).attr(attr);
    if (!value || value.startsWith('data:')) return;
    const absoluteUrl = new URL(value, url).href;
    if (!isLocalResource(url, absoluteUrl)) return;
    promises.push(
      downloadResource(absoluteUrl, output, dirName).then((filename) => {
        $(element).attr(attr, `${dirName}/${filename}`);
      }),
    );
  });
};

export default async function pageLoader(url, output) {
  const { data } = await axios.get(url);

  const $ = cheerio.load(data);
  const dirName = getResourceDirName(url);
  const assetPromises = [];

  processResources($, 'img[src]', 'src', url, output, dirName, assetPromises);
  processResources($, 'script[src]', 'src', url, output, dirName, assetPromises);
  processResources($, 'link[href]', 'href', url, output, dirName, assetPromises);

  if (assetPromises.length > 0) {
    await fs.mkdir(path.join(output, dirName), { recursive: true });
    await Promise.all(assetPromises);
  }

  const filepath = path.join(output, getFileName(url));
  await fs.writeFile(filepath, assetPromises.length > 0 ? $.html() : data);
  return { filepath };
}
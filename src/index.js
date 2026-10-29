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
  const stem = `${hostname}${pathname.slice(0, -ext.length)}`.replace(
    /[^a-zA-Z0-9]/g,
    '-',
  );
  return `${stem}${ext}`;
};

const getBaseDomain = (hostname) => {
  const parts = hostname.split('.');
  return parts.length > 2 ? parts.slice(1).join('.') : hostname;
};

const isLocalResource = (pageUrl, assetUrl) => {
  const pageHost = new URL(pageUrl).hostname;
  const assetHost = new URL(assetUrl).hostname;
  const baseDomain = getBaseDomain(pageHost);
  return (
    assetHost === pageHost
    || assetHost === baseDomain
    || assetHost.endsWith(`.${baseDomain}`)
  );
};

const downloadResource = async (assetUrl, output, dirName) => {
  const filename = getAssetFileName(assetUrl);
  const { data } = await axios.get(assetUrl, { responseType: 'arraybuffer' });
  await fs.writeFile(path.join(output, dirName, filename), Buffer.from(data));
  return filename;
};

export default async function pageLoader(url, output) {
  const { data } = await axios.get(url);

  const $ = cheerio.load(data);
  const dirName = getResourceDirName(url);
  const assetPromises = [];

  $('img[src]').each((_, element) => {
    const src = $(element).attr('src');
    if (!src || src.startsWith('data:')) return;
    const absoluteUrl = new URL(src, url).href;
    if (!isLocalResource(url, absoluteUrl)) return;
    assetPromises.push(
      downloadResource(absoluteUrl, output, dirName).then((filename) => {
        $(element).attr('src', `${dirName}/${filename}`);
      }),
    );
  });

  if (assetPromises.length > 0) {
    await fs.mkdir(path.join(output, dirName), { recursive: true });
    await Promise.all(assetPromises);
  }

  const filepath = path.join(output, getFileName(url));
  await fs.writeFile(filepath, assetPromises.length > 0 ? $.html() : data);
  return { filepath };
}
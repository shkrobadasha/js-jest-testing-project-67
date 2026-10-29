import { promises as fs } from 'fs';
import path from 'path';
import axios from 'axios';

export const getFileName = (url) => {
  const name = url.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9]/g, '-');
  return `${name}.html`;
};

export default async function pageLoader(url, output) {
  const { data } = await axios.get(url);
  const filepath = path.join(output, getFileName(url));
  await fs.writeFile(filepath, data);
  return { filepath };
}
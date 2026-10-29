#!/usr/bin/env node
import { Command } from 'commander';
import pageLoader from '../src/index.js';

const program = new Command();

program
  .name('page-loader')
  .description('Скачивает страницу из сети и сохраняет в указанную директорию')
  .version('1.0.0')
  .arguments('<url>')
  .option('-o, --output <dir>', 'директория для сохранения файла', process.cwd())
  .action(async (url, options) => {
    try {
      const { filepath } = await pageLoader(url, options.output);
      console.log(filepath);
    } catch (error) {
      console.error(error.message);
      process.exit(1);
    }
  });

program.parse();
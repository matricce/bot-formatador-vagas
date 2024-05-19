import { Browser } from 'puppeteer-core';
import puppeteer from 'puppeteer-extra';
import chromium from '@sparticuz/chromium';

require('puppeteer-extra-plugin-stealth/evasions/chrome.app');
require('puppeteer-extra-plugin-stealth/evasions/chrome.csi');
require('puppeteer-extra-plugin-stealth/evasions/chrome.loadTimes');
require('puppeteer-extra-plugin-stealth/evasions/chrome.runtime');
require('puppeteer-extra-plugin-stealth/evasions/iframe.contentWindow');
require('puppeteer-extra-plugin-stealth/evasions/media.codecs');
require('puppeteer-extra-plugin-stealth/evasions/navigator.hardwareConcurrency');
require('puppeteer-extra-plugin-stealth/evasions/navigator.languages');
require('puppeteer-extra-plugin-stealth/evasions/navigator.permissions');
require('puppeteer-extra-plugin-stealth/evasions/navigator.plugins');
require('puppeteer-extra-plugin-stealth/evasions/navigator.vendor');
require('puppeteer-extra-plugin-stealth/evasions/navigator.webdriver');
require('puppeteer-extra-plugin-stealth/evasions/sourceurl');
require('puppeteer-extra-plugin-stealth/evasions/user-agent-override');
require('puppeteer-extra-plugin-stealth/evasions/webgl.vendor');
require('puppeteer-extra-plugin-stealth/evasions/window.outerdimensions');
require('puppeteer-extra-plugin-stealth/evasions/defaultArgs');
require('puppeteer-extra-plugin-user-preferences');
require('puppeteer-extra-plugin-user-data-dir');

const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

let browser: Browser | undefined;
const isLocal = process.env.NODE_ENV === 'development';

export async function getBrowser() {
  console.log(`Executing getBrowser`);
  /*METRIC*/ const startTime = performance.now();
  chromium.setHeadlessMode = true;
  chromium.setGraphicsMode = false;

  const chromeArgs = [
    '--font-render-hinting=none', // Improves font-rendering quality and spacing
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-animations',
    '--disable-background-timer-throttling',
    '--disable-restore-session-state',
    '--disable-web-security', // Only if necessary, be cautious with security implications
    '--single-process', // Be cautious as this can affect stability in some environments
  ];

  try {
    if (!browser?.connected) {
      browser = await puppeteer.launch({
        ...(isLocal
          ? { channel: 'chrome' }
          : {
              args: chromeArgs,
              executablePath: await chromium.executablePath(),
              ignoreHTTPSErrors: true,
              headless: true,
            }),
      });
    } else {
      console.log('Browser already created');
    }
  } catch (error) {
    throw new Error('Failed to start browser');
  }
  /*METRIC*/ const endTime = performance.now();
  /*METRIC*/ console.log(`METRIC: getBrowser, time ${endTime - startTime} ms`);
  return browser;
}

export async function getPage() {
  console.log(`Executing getPage`);
  /*METRIC*/ const startTime = performance.now();
  const browser = await getBrowser();
  console.log(`Browser created successfully: ${JSON.stringify(browser)}`);
  const page =
    (await browser?.newPage().catch(err => console.log(`Error creating new page: ${err}`))) ||
    undefined;
  /*METRIC*/ const endTime = performance.now();
  /*METRIC*/ console.log(`METRIC: getPage, time ${endTime - startTime} ms`);
  return page || undefined;
}

export async function closeBrowser() {
  console.log(`Executing closeBrowser`);
  /*METRIC*/ const startTime = performance.now();
  await browser?.close();
  /*METRIC*/ const endTime = performance.now();
  /*METRIC*/ console.log(`METRIC: closeBrowser, time ${endTime - startTime} ms`);
}

export async function getScreenshot(url: string): Promise<Buffer | undefined> {
  const page = await getPage();
  if (!page) return;

  async function realHeight(page) {
    const bodyHeight = await page.evaluate(_ => document.body.scrollHeight);
    console.log(`bodyHeight: ${bodyHeight}`);
    return bodyHeight;
  }

  await page.goto(url, {
    waitUntil: ['load', 'domcontentloaded'],
  });

  const pageRealHeight = (await realHeight(page)) || 844;
  await page.setViewport({ width: 1024, height: pageRealHeight });

  page.evaluate(() => {
    (<HTMLElement>document.querySelector('.show-more-less-html__button'))?.click();
  });

  await page.screenshot({
    type: 'png',
    fullPage: true,
  });
  const file = await page.screenshot();
  await page?.close();
  return file;
}

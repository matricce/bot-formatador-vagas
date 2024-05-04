import axios from 'axios';
import { execSync } from 'child_process';
import * as cheerio from 'cheerio';
import { RetrieveContentResponse } from '../types/shared-interfaces';

export const retrieveContent = async (url: string): Promise<RetrieveContentResponse> => {
  console.log('Retrieving content from url:', url);
  url = url.startsWith('https://') ? url : 'https://' + url;
  const response = (await axios
    .get(url)
    .then(res => (res.data.widget ? undefined : res))
    .catch(() => undefined)) || {
    data: execSync(`
    curl '${url}' \
    -H 'accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7' \
    -H 'sec-ch-ua: "Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"' \
    -H 'user-agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    `).toString('utf-8'),
  };

  const $ = cheerio.load(response.data);
  const jobObject = $('script').attr('type', 'application/ld+json');
  const jobObjectData = JSON.parse((<any>jobObject?.[0]?.children?.[0])?.data);
  const jobObjectTitle = jobObjectData?.title;
  const jobObjectBody = jobObjectData?.description;
  const jobTitle = $('title').html() || jobObjectTitle || '';
  const body = `${jobTitle}\n${$('body').html() || jobObjectBody || ''}`;

  return { jobUrl: url, jobTitle, body };
};

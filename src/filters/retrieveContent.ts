import * as cheerio from 'cheerio';
import { RetrieveContentResponse } from '../types/shared-interfaces';
import { withAxios, withChromium } from '../utils';

export const retrieveContent = async (url: string): Promise<RetrieveContentResponse> => {
  url = url.startsWith('https://') ? url : 'https://' + url;
  const ignoreList = ['.com/viewjob'];
  for (const ignore of ignoreList) {
    if (url.endsWith(ignore)) {
      return {
        jobUrl: url,
        jobTitle: '',
        body: '',
      };
    }
  }
  /*METRIC*/ const startTime = performance.now();
  const { title, data } = (await withAxios(url)) || (await withChromium(url)) || {};
  const $ = cheerio.load(data || '');
  const jobObject = $('script').attr('type', 'application/ld+json');
  const jobObjectData = await Promise.resolve((<any>jobObject?.[0]?.children?.[0])?.data || data)
    .then(JSON.parse)
    .catch(() => undefined);

  const jobObjectTitle = jobObjectData?.title || jobObjectData?.displayName;
  const jobObjectBody = jobObjectData?.description;
  const jobTitle = title || $('title').text() || jobObjectTitle || '';
  const body = jobObjectBody || $('body').html() || '';
  /*METRIC*/ const endTime = performance.now();
  /*METRIC*/ console.log(`METRIC: retrieveContent, url ${url}, time ${endTime - startTime} ms`);
  return { jobUrl: url, jobTitle, body };
};

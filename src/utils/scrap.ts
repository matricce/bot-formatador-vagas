import axios from 'axios';
import { getPage } from '../utils';

const withAxios = async (url): Promise<{ title: string; data: string } | undefined> => {
  console.info('withAxios', 'Retrieving content from url:', url);
  /*METRIC*/ const startTime = performance.now();
  const data = await axios
    .get(url)
    .then(res => (res.data.widget ? undefined : res.data))
    .catch(() => undefined);
  data && console.info('withAxios', 'Retrieved content from url', url);
  /*METRIC*/ const endTime = performance.now();
  /*METRIC*/ console.log(`METRIC: withAxios, url ${url}, time ${endTime - startTime} ms`);
  if (data) {
    return {
      title: '',
      data: data || '',
    };
  }
  return;
};

const withChromium = async (url): Promise<{ title: string; data: string } | undefined> => {
  console.info('withChromium', 'Retrieving content from url:', url);
  /*METRIC*/ const startTime = performance.now();
  const page =
    (await getPage().catch(err => console.log(`Error creating new page: ${err}`))) || undefined;

  if (page) {
    console.log(`Page created successfully: ${JSON.stringify(page)}`);
  } else {
    console.log(`Error creating new page: ${page}`);
    return { title: '', data: '' };
  }

  await page
    .goto(url, {
      waitUntil: 'domcontentloaded',
    })
    .catch(err => console.log(`Error navigating to page: ${err}`));

  const pageTitle = await page
    .title()
    .catch(err => console.log(`Error getting page title: ${err}`));

  console.log('Page title:', pageTitle);

  const jobDescriptionIndeed = await page.evaluate(
    () => (<HTMLElement>document?.querySelector('.jobsearch-BodyContainer'))?.innerText,
  );

  const html = await page.evaluate(() => document?.querySelector('*')?.outerHTML);

  console.log(`Closing page`);
  await page?.close();

  const data = jobDescriptionIndeed || html;

  /*METRIC*/ const endTime = performance.now();
  /*METRIC*/ console.log(`METRIC: withChromium, url ${url}, time ${endTime - startTime} ms`);
  if (data) {
    return { title: pageTitle || '', data: jobDescriptionIndeed || data || '' };
  }
  return;
};

export { withAxios, withChromium };

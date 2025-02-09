import axios from 'axios';
import { getPage, setPageLanguage } from '../utils';

const withAxios = async (url): Promise<{ title: string; data: string } | undefined> => {
  console.info('withAxios', 'Retrieving content from url:', url);
  /*METRIC*/ const startTime = performance.now();
  const functionName = url.includes('inhire.app') ? 'inhire' : 'def';
  const data = await owners[functionName](url).catch(() => undefined);
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

const owners = {
  inhire: url => inhire(url),
  def: url => def(url),
};

const def = async (url): Promise<string | undefined> => {
  const data = await axios
    .get(url, { headers: { 'Accept-Language': 'pt-BR' } })
    .then(res => (res.data.widget ? undefined : res.data))
    .catch(() => undefined);
  return data;
};

const inhire = async (url): Promise<string | undefined> => {
  const jobUuid = url.match(/[a-z0-9]{8}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{12}/)[0];
  const tenant = url.match(/(\w+)(\.inhire\.app)/)[1];
  const apiUrl = `https://api.inhire.app/job-posts/public/pages/${jobUuid}`;
  const data = await axios
    .get(apiUrl, { headers: { 'X-Tenant': tenant } })
    .then(res => res.data)
    .then(JSON.stringify)
    .catch(() => undefined);
  return data;
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

  await setPageLanguage(page);

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

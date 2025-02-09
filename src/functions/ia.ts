import { GoogleGenerativeAI } from '@google/generative-ai';
import * as cheerio from 'cheerio';
import he from 'he';

const MODEL_NAME = process.env.GEMINI_API_MODEL!;
const API_KEY = process.env.GEMINI_API_KEY!;

export const isMessageOnlyEmojis = (message: string): Boolean => {
  const regex = /^(\p{Extended_Pictographic}|\u200d)*$/u;
  return regex.test(message.trim());
};

const transformMarkdown = (html: string): string => {
  return html
    .replace(/<[\w\s\/"=]+>/g, '')
    .replace(/(\*\*)([A-zÀ-ÿ\s\d%:?!,\.\-/()]+)(\*\*)/g, '*$2*')
    .replace(/(^\s*)(\*)(\s+)/gm, '$1-$3');
};

const systemInstruction = process.env.GEMINI_SYSTEM_INSTRUCTION;

const preProcessDescription = async (message: string): Promise<string> => {
  /*METRIC*/ const startTime = performance.now();
  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction,
  });
  const $ = cheerio.load(message);

  message = $('html')
    .text()
    .replace(/(\n\s+){2,}/g, '\n');

  try {
    const jobObject = he.decode($('script').attr('type', 'application/ld+json').text());
    const gupyJobJSON = JSON.parse(jobObject);
    const gupyJobObject = gupyJobJSON?.props?.pageProps?.job;
    delete gupyJobObject?.careerPage;
    message = JSON.stringify(gupyJobObject || gupyJobJSON, null, 0);
  } catch (error) {
    console.warn('Warn: Invalid JSON');
  }

  message = [...new Set(message.split('\n'))].join('\n');

  let totalTokens = (await model.countTokens(message).catch(() => {}))?.totalTokens;
  console.log(`Total tokens: ${totalTokens}, length: ${message.length}`);
  if (totalTokens && totalTokens > 30720) {
    message = message.substring(0, 30720 * 2);
    totalTokens = (await model.countTokens(message).catch(() => undefined))?.totalTokens;
    console.log(`Total tokens: ${totalTokens}, length: ${message.length}`);
  }

  /*METRIC*/ const endTime = performance.now();
  /*METRIC*/ console.log(`METRIC: preProcessDescription, time ${endTime - startTime} ms`);
  return message;
};

const getGeminiResponse = async (
  message: string,
): Promise<{
  jobTitle: string;
  jobDescription: string;
  confidence: number;
  reason: string;
  opinion: string;
  sentiment: string;
}> => {
  /*METRIC*/ const startTime = performance.now();
  const genAI = new GoogleGenerativeAI(API_KEY);
  const generationConfig = {
    temperature: 0.15,
    topK: 1,
    topP: 1,
    maxOutputTokens: 2500,
    responseMimeType: 'application/json',
    responseSchema: {
      type: 'object',
      properties: {
        jobTitle: {
          type: 'string',
        },
        jobDescriptionMarkdown: {
          type: 'string',
        },
        confidence: {
          type: 'number',
        },
        reason: {
          type: 'string',
        },
        opinion: {
          type: 'string',
        },
        sentiment: {
          type: 'string',
        },
      },
      required: [
        'jobTitle',
        'jobDescriptionMarkdown',
        'confidence',
        'reason',
        'opinion',
        'sentiment',
      ],
    },
  };
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction,
    generationConfig,
  });

  const result = message
    ? await model
        .generateContent({
          contents: [{ role: 'user', parts: [{ text: `${message}` }] }],
        })
        .catch(console.error)
    : undefined;

  const jobObject = await Promise.resolve(result?.response?.text() || '')
    .then(JSON.parse)
    .catch(() => undefined);

  jobObject.jobDescription = transformMarkdown(jobObject.jobDescriptionMarkdown || '');

  console.log('jobObject', jobObject);
  const { jobTitle, jobDescription, confidence, reason, opinion, sentiment } = jobObject;

  /*METRIC*/ const endTime = performance.now();
  /*METRIC*/ console.log(`METRIC: processDescription, time ${endTime - startTime} ms`);
  return { jobTitle, jobDescription, confidence, reason, opinion, sentiment };
};

export { getGeminiResponse, preProcessDescription };

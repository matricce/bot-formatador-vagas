import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import * as cheerio from 'cheerio';
import he from 'he';

const MODEL_NAME = 'gemini-1.5-flash-latest';
const API_KEY = process.env.GEMINI_API_KEY!;

export const isMessageOnlyEmojis = (message: string): Boolean => {
  const regex = /^(\p{Extended_Pictographic}|\u200d)*$/u;
  return regex.test(message.trim());
};

const transformHTML = (html: string): string => {
  return html
    .replace(/<[\w\s\/"=]+>/g, '')
    .replace(/(\*\*)([A-zÀ-ÿ\s\d%:?!,\.]+)(\*\*)/g, '<b>$2</b>')
    .replace(/(^\s*)(\*)(\s+)/gm, '$1-$3');
};

const systemInstruction = `Por favor, o texto a seguir é de uma página web de uma vaga de emprego, extraia do texto original o que for parte da vaga, como responsabilidades, requisitos, salário, benefícios e etc. Em seguida, forneça uma porcentagem de confiabilidade entre 0 e 100%, indicando o quão próximo o texto gerado está do original, e justifique sua escolha. Por exemplo: (Confiabilidade: 95%, Motivo: O texto gerado é...)`;

const processDescription = async (message: string): Promise<string> => {
  /*METRIC*/ const startTime = performance.now();
  const genAI = new GoogleGenerativeAI(API_KEY);
  const generationConfig = {
    temperature: 0.15,
    topK: 1,
    topP: 1,
    maxOutputTokens: 2048,
    responseMimeType: 'text/plain',
  };
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction,
    generationConfig,
  });

  const safetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
  ];

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
    console.error('Error: Invalid JSON');
  }

  message = [...new Set(message.split('\n'))].join('\n');

  let totalTokens = (await model.countTokens(message).catch(() => {}))?.totalTokens;
  console.log(`Total tokens: ${totalTokens}, length: ${message.length}`);
  if (totalTokens && totalTokens > 30720) {
    message = message.substring(0, 30720 * 2);
    totalTokens = (await model.countTokens(message).catch(() => undefined))?.totalTokens;
    console.log(`Total tokens: ${totalTokens}, length: ${message.length}`);
  }

  const result = message
    ? await model
        .generateContent({
          contents: [{ role: 'user', parts: [{ text: `${message}` }] }],
          safetySettings,
        })
        .catch(console.error)
    : undefined;

  const response = transformHTML(
    typeof result === 'string' ? result : result?.response?.text() || '',
  );
  /*DELETEME*/ console.log('Gemini response length:', response.length);
  /*METRIC*/ const endTime = performance.now();
  /*METRIC*/ console.log(`METRIC: processDescription, time ${endTime - startTime} ms`);
  return (
    response &&
    `\n<code>############↓EDITAR↓############</code>\n\n${response}\n\n<code>############↑EDITAR↑############</code>\n`
  );
};

export { processDescription };

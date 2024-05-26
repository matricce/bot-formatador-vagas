import { InputFile, Message, MessageEntity } from 'grammy/types';
import { retrieveContent } from '../filters/retrieveContent';
import { erroUrl, unknownCommand, vagaEncerrada } from '../responses/messages';
import { PutHashtagsResponse, RetrieveContentResponse } from '../types/shared-interfaces';
import { Context } from 'grammy';
import { cleanUrl } from 'tracking-params';
import bot from '../bot';
import { formatMenu } from '../menus/mainMenu';
import { format, screenshot } from '../functions';
import { serialiseWith } from '@telegraf/entity';
import { Markdown, None } from './toMarkdownHelper';

export const searchTerms = (terms: Object, body: string): string[] => {
  const optionsArray = Object.keys(terms);
  const arr: string[] = [];
  for (let i = 0; i < optionsArray.length; i++) {
    for (let j = 0; j < terms[optionsArray[i]].terms.length; j++) {
      const termRegex = new RegExp(
        terms[optionsArray[i]].terms[j],
        terms[optionsArray[i]].regexOpt,
      );
      if (body.search(termRegex) !== -1) {
        arr.push(terms[optionsArray[i]].hashtag);
        break;
      }
    }
  }
  return arr;
};

export const formatJob = (putHashtagsResponse: PutHashtagsResponse): string => {
  const {
    jobTitle,
    jobOpportunity,
    jobLevel,
    jobLocal,
    jobDescription,
    jobUrl,
    limitDate,
    footer,
    encerrada,
  } = putHashtagsResponse;
  const job = encerrada
    ? [vagaEncerrada]
    : [jobOpportunity, jobLevel, jobLocal, jobTitle, jobDescription, jobUrl, limitDate, footer];
  return job.join('\n');
};

export const resultsEqual = (results: RetrieveContentResponse[]): RetrieveContentResponse => {
  const firstResult = results[0];
  results.shift();
  for (const e of results) {
    if (e.jobTitle === firstResult.jobTitle || e.body === firstResult.body) {
      return e;
    }
  }
  return firstResult;
};

export const removeTrackingParams = (url: string): string => {
  const clearedUrl = cleanUrl(url);
  return clearedUrl;
};

export const removeQueryString = (url: string, keepfirstQueryParam: boolean = false) => {
  const parsedUrl = new URL(url);
  const queryPairs = parsedUrl.search.split('&');

  parsedUrl.search = keepfirstQueryParam ? queryPairs[0] : '';
  return parsedUrl.toString();
};

export const isRetrieveContentResponse = (obj: any): obj is RetrieveContentResponse => {
  return Boolean(obj?.jobTitle && obj?.body);
};

export const sanitizeUrlAndReturnContent = async (
  url: string,
): Promise<RetrieveContentResponse> => {
  /*METRIC*/ const startTime = performance.now();
  const sanitizedUrl = removeQueryString(url);
  const sanitizedUrlWithFirstParam = removeQueryString(url, true);

  const resultFromOriginalUrl = await retrieveContent(url).catch(() => undefined);
  const resultFromSanitizedUrlWithFirstParam =
    url !== sanitizedUrlWithFirstParam &&
    (await retrieveContent(sanitizedUrlWithFirstParam).catch(() => undefined));
  const resultFromSanitizedUrl =
    sanitizedUrlWithFirstParam !== sanitizedUrl &&
    (await retrieveContent(sanitizedUrl).catch(() => undefined));

  const results: RetrieveContentResponse[] = [
    resultFromOriginalUrl,
    resultFromSanitizedUrlWithFirstParam,
    resultFromSanitizedUrl,
  ].filter(isRetrieveContentResponse);
  /*METRIC*/ const endTime = performance.now();
  /*METRIC*/ console.log(`METRIC: sanitizeUrlAndReturnContent, time ${endTime - startTime} ms`);
  if (results.length === 0) {
    throw new Error('No results found');
  }
  return resultsEqual(results);
};

export const getUrlFromMessage = (message: Message): string | undefined => {
  let url =
    message.entities
      ?.map(
        (e: MessageEntity) =>
          (e.type === 'url' && message.text?.slice(e.offset, e.offset + e.length)) ||
          (e.type === 'text_link' && e.url),
      )
      .filter(Boolean)[0] || undefined;
  if (url) {
    url = url.startsWith('https://') ? url : 'https://' + url;
  }
  return url;
};

export const processLink = async (ctx: Context) => {
  console.log(`processLink`);
  const url = ctx.update.message && getUrlFromMessage(ctx.update.message);
  if (!url) {
    return ctx.reply(erroUrl, { reply_to_message_id: ctx.msg?.message_id });
  }
  const sentMessage = await ctx.replyWithDocument(new InputFile(Buffer.from(' '), 'carregando'), {
    caption: 'Se levar mais que 15 segundos, tente novamente',
  });

  const clearedUrl: string = removeTrackingParams(url);
  if (!sentMessage) {
    return;
  }

  const content: RetrieveContentResponse | undefined | string = await Promise.race([
    sanitizeUrlAndReturnContent(clearedUrl),
    new Promise<RetrieveContentResponse | undefined>((res, rej) =>
      setTimeout(() => rej('Tempo esgotado ao processar a url'), 9800),
    ),
  ]).catch(err => `Erro ao processar o link "${url}": ${err}`);

  if (!content || typeof content === 'string') {
    return ctx
      .reply(content || erroUrl, { reply_to_message_id: ctx.msg?.message_id })
      .catch(console.error);
  }

  await bot.api.editMessageMedia(sentMessage.chat.id, sentMessage.message_id, {
    type: 'document',
    media: new InputFile(Buffer.from(JSON.stringify(content)), 'job_data.json'),
    caption: `${content.jobUrl}`,
  });
  await formatMenu(sentMessage);
  if (ctx.chat?.id && ctx.msg?.message_id) {
    await bot.api.deleteMessage(ctx.chat.id, ctx.msg?.message_id).catch(() => {});
  }
};

export const processMenuResponse = async (ctx: Context) => {
  console.log(`processMenuResponse`);
  const data = ctx.update.callback_query?.data;
  const command = {
    screenshot: screenshot,
    format: format,
    format_ia: ctx => format(ctx, true),
    markdown: toMarkdown,
    default: ctx => ctx.reply(unknownCommand, { reply_to_message_id: ctx.msg?.message_id }),
  };

  typeof command[data || ''] === 'function'
    ? await command[data || '']?.(ctx)
    : await command.default(ctx);
  return ctx.answerCallbackQuery().catch(() => '');
};

export const toMarkdown = (ctx: Context): string | undefined => {
  if (ctx.update?.callback_query?.message) {
    const markdown = serialiseWith(Markdown, None)(ctx.update?.callback_query?.message);
    ctx.reply(markdown, { link_preview_options: { is_disabled: true } }).catch(console.error);
  }
  return;
};

export const timestampToDate = (timestamp: Date): string => {
  const padNum = (num: number, length = 2) => num.toString().padStart(length, '0');
  const year = timestamp.getFullYear();
  const month = padNum(timestamp.getMonth() + 1);
  const day = padNum(timestamp.getDate());
  const hour = padNum(timestamp.getHours());
  const minute = padNum(timestamp.getMinutes());
  const second = padNum(timestamp.getSeconds());

  return `${year}-${month}-${day}_${hour}-${minute}-${second}`;
};

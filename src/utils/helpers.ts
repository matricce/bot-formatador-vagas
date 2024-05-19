import { Message, MessageEntity } from 'grammy/types';
import { retrieveContent } from '../filters/retrieveContent';
import { erroValidaUrl, unknownCommand, vagaEncerrada } from '../responses/messages';
import { PutHashtagsResponse, RetrieveContentResponse } from '../types/shared-interfaces';
import { Context } from 'grammy';
import { cleanUrl } from 'tracking-params';
import bot from '../bot';
import { mainMenu } from '../menus/mainMenu';
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
): Promise<RetrieveContentResponse | undefined> => {
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
  return resultsEqual(results) || undefined;
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
  const sentMessage = url && (await ctx.reply(url));

  const clearedUrl: string | undefined = url && removeTrackingParams(url);
  if (!sentMessage) {
    return;
  }
  if (ctx.chat?.id && ctx.msg?.message_id) {
    await bot.api.deleteMessage(ctx.chat.id, ctx.msg?.message_id).catch(() => {});
  }
  const hasParams =
    clearedUrl && [...new URL(clearedUrl).searchParams.values()].filter(Boolean).length > 0;

  const editMessage = newUrl =>
    bot.api
      .editMessageText(
        sentMessage.chat.id,
        sentMessage.message_id,
        [url, newUrl].filter(Boolean).join('\n'),
        { link_preview_options: { is_disabled: true } },
      )
      .catch(console.error);

  await editMessage(clearedUrl).catch(() => {});

  const sanitizedUrl = hasParams
    ? (await sanitizeUrlAndReturnContent(clearedUrl).catch(console.error))?.jobUrl
    : clearedUrl;

  await editMessage(sanitizedUrl).catch(() => {});

  await mainMenu(sentMessage);

  if (!url) {
    return ctx
      .reply(erroValidaUrl, { reply_to_message_id: ctx.msg?.message_id })
      .catch(console.error);
  }
};

export const processMenuResponse = async (ctx: Context) => {
  console.log(`processMenuResponse`);
  const data = ctx.update.callback_query?.data;
  const command = {
    screenshot: screenshot,
    format: format,
    format_ia: ctx => format(ctx, true),
    default: ctx => ctx.reply(unknownCommand, { reply_to_message_id: ctx.msg?.message_id }),
  };

  typeof command[data || ''] === 'function'
    ? await command[data || '']?.(ctx)
    : await command.default(ctx);
  return ctx.answerCallbackQuery().catch(() => '');
};

export const toMarkdown = (ctx: Context): string | undefined => {
  if (ctx.msg?.reply_to_message) {
    const markdown = serialiseWith(Markdown, None)(ctx.msg.reply_to_message);
    ctx.reply(markdown, { link_preview_options: { is_disabled: true } }).catch(console.error);
  }
  return;
};

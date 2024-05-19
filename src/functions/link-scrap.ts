import { Context } from 'grammy';
import { putHashtags } from '../filters/hashtags';
import { erroUrl } from '../responses/messages';
import { formatJob, sanitizeUrlAndReturnContent } from '../utils/helpers';
import { RetrieveContentResponse } from '../types/shared-interfaces';
import { processDescription } from './ia';

export const format = async (ctx: Context, withIA = false) => {
  /*METRIC*/ const startTime = performance.now();
  const message = ctx.update.callback_query?.message?.text?.split('\n').pop() || '';

  const content = await Promise.race([
    sanitizeUrlAndReturnContent(message),
    new Promise<RetrieveContentResponse | undefined>((res, rej) =>
      setTimeout(() => rej('Tempo esgotado ao processar a url'), 8000),
    ),
  ]).catch(err => `Erro ao processar o link "${message}": ${err}`);

  /*METRIC*/ console.log(
    `METRIC: format, before format, url ${message}, time ${performance.now() - startTime} ms`,
  );
  if (content && typeof content !== 'string') {
    const jobTitle = `\n${content?.jobTitle || 'JOB_TITLE'}`;
    const jobUrl = `\n🔗 ${content?.jobUrl || message || 'JOB_URL'}`;
    const jobBody = content?.body || '';
    const putHashtagsResponse = await putHashtags(`${jobTitle}\n${jobBody}`);
    const answer = formatJob({
      ...putHashtagsResponse,
      jobUrl,
      jobTitle,
      jobDescription: '',
    });
    /*METRIC*/ const endTime = performance.now();
    /*METRIC*/ console.log(
      `METRIC: format _ 1, url ${jobUrl.replace('\n', '')}, time ${endTime - startTime} ms`,
    );
    if (!withIA) {
      await ctx
        .reply(answer, { parse_mode: 'HTML', reply_to_message_id: ctx.msg?.message_id })
        .catch(() => ctx.reply(erroUrl, { reply_to_message_id: ctx.msg?.message_id }));
    }
    const timeElapsed = performance.now() - startTime;
    console.log(`Time elapsed: ${timeElapsed} ms.`);
    const jobDescription =
      !withIA || putHashtagsResponse.encerrada
        ? ''
        : await Promise.race([
            processDescription(jobBody),
            new Promise<undefined>((res, rej) =>
              setTimeout(() => rej('Tempo esgotado ao processar a descrição'), 9000 - timeElapsed),
            ),
          ]).catch(async err => {
            console.error(`Erro ao processar a descrição: ${err}`);
          });
    if (jobDescription) {
      const answer = formatJob({
        ...putHashtagsResponse,
        jobUrl,
        jobTitle,
        jobDescription,
      });
      /*METRIC*/ const endTime = performance.now();
      /*METRIC*/ console.log(
        `METRIC: format _ 2, url ${jobUrl.replace('\n', '')}, time ${endTime - startTime} ms`,
      );
      return ctx
        .reply(answer, { parse_mode: 'HTML', reply_to_message_id: ctx.msg?.message_id })
        .catch(() => ctx.reply(erroUrl, { reply_to_message_id: ctx.msg?.message_id }));
    }
    return;
  }
  /*METRIC*/ const endTime = performance.now();
  /*METRIC*/ console.log(`METRIC: format _ 2, url ${message}, time ${endTime - startTime} ms`);
  return ctx
    .reply(content || erroUrl, { reply_to_message_id: ctx.msg?.message_id })
    .catch(() => ctx.reply(erroUrl, { reply_to_message_id: ctx.msg?.message_id }));
};

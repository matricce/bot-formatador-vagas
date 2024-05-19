import { Context } from 'grammy';
import { InputFile } from 'grammy/types';
import { erroUrl } from '../responses/messages';
import { getScreenshot } from '../utils';

export const screenshot = async (ctx: Context) => {
  /*METRIC*/ const startTime = performance.now();
  const message = ctx.update.callback_query?.message?.text?.split('\n').pop() || '';

  const content = await Promise.race([
    getScreenshot(message),
    new Promise<string | undefined>((res, rej) =>
      setTimeout(() => rej('Tempo esgotado ao processar a url'), 8000),
    ),
  ]).catch(err => `Erro ao processar o link "${message}": ${err}`);

  /*METRIC*/ const endTime = performance.now();
  /*METRIC*/ console.log(`METRIC: screenshot, url ${message}, time ${endTime - startTime} ms`);
  if (typeof content === 'string') {
    return ctx
      .reply(content, { reply_to_message_id: ctx.msg?.message_id })
      .catch(() => ctx.reply(erroUrl, { reply_to_message_id: ctx.msg?.message_id }));
  }
  if (content instanceof Buffer) {
    return ctx
      .replyWithDocument(new InputFile(content, 'fullpage.png'), {
        reply_to_message_id: ctx.msg?.message_id,
      })
      .catch(() => ctx.reply(erroUrl, { reply_to_message_id: ctx.msg?.message_id }));
  }

  return ctx
    .reply('Erro ao processar o link', { reply_to_message_id: ctx.msg?.message_id })
    .catch(console.error);
};

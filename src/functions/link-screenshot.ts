import { Context } from 'grammy';
import { InputFile } from 'grammy/types';
import { getScreenshot, timestampToDate } from '../utils';

export const screenshot = async (ctx: Context) => {
  /*METRIC*/ const startTime = performance.now();
  const message = ctx.update.callback_query?.message?.caption?.split('\n').pop() || '';

  const content = await getScreenshot(message).catch(
    err => `Erro ao processar o link "${message}": ${err}`,
  );

  /*METRIC*/ const endTime = performance.now();
  /*METRIC*/ console.log(`METRIC: screenshot, url ${message}, time ${endTime - startTime} ms`);
  if (typeof content === 'string') {
    return ctx.reply(content, { reply_to_message_id: ctx.msg?.message_id }).catch(console.error);
  }
  if (content instanceof Buffer) {
    return ctx
      .replyWithDocument(new InputFile(content, `fullpage_${timestampToDate(new Date())}.png`), {
        reply_to_message_id: ctx.msg?.message_id,
      })
      .catch(console.error);
  }

  return ctx
    .reply('Erro ao processar o link', { reply_to_message_id: ctx.msg?.message_id })
    .catch(console.error);
};

import 'dotenv/config';
import bot from './bot';
import commands from './commands/composer';
import { checkText } from './functions';
import { erroValidaUrl } from './responses/messages';
import { processLink, processMenuResponse, timeoutFallback } from './utils';
import { development } from './utils/start';

bot.use(commands);

bot.on(['::url', '::text_link'], ctx => timeoutFallback(ctx, processLink));

bot.on(':text', ctx => timeoutFallback(ctx, checkText));

bot.on('callback_query:data', ctx => timeoutFallback(ctx, processMenuResponse));

bot.on('message', ctx => ctx.reply(erroValidaUrl, { reply_to_message_id: ctx.msg?.message_id }));

bot.catch((e: Error) => console.error(e));

process.env.NODE_ENV === 'development' && development(bot);

export {};

import 'dotenv/config';
import bot from './bot';
import commands from './commands/composer';
import { checkText } from './functions';
import { development } from './utils/start';
import { processLink, processMenuResponse } from './utils';

bot.use(commands);

bot.on(['::url', '::text_link'], processLink);

bot.on(':text', checkText);

bot.on('callback_query:data', processMenuResponse);

bot.catch((e: Error) => console.error(e));

process.env.NODE_ENV === 'development' && development(bot);

export {};

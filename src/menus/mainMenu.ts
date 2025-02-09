import { InlineKeyboard } from 'grammy';
import { Message } from 'grammy/types';
import bot from '../bot';

const formatMenu = async (message: Message.DocumentMessage): Promise<void> => {
  const keyboard = new InlineKeyboard()
    .text('📸 Screenshot', 'screenshot')
    .row()
    .text('💼 Formatar', 'format')
    .row()
    .text('🤖 Formatar (IA)', 'format_ia');

  bot.api.editMessageReplyMarkup(message.chat.id, message.message_id, {
    reply_markup: keyboard,
  });
};

const postMenu = async (message: Message.TextMessage): Promise<void> => {
  const keyboard = new InlineKeyboard().text('📝 Markdown', 'markdown');

  bot.api.editMessageReplyMarkup(message.chat.id, message.message_id, {
    reply_markup: keyboard,
  });
};

export { formatMenu, postMenu };

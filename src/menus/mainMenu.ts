import { InlineKeyboard } from 'grammy';
import { Message } from 'grammy/types';
import bot from '../bot';

const mainMenu = async (message: Message.TextMessage): Promise<void> => {
  const keyboard = new InlineKeyboard()
    .text('📸 Screenshot', 'screenshot')
    .text('💼 Formatar', 'format')
    .text('🤖 Formatar (IA)', 'format_ia');

  bot.api.editMessageReplyMarkup(message.chat.id, message.message_id, {
    reply_markup: keyboard,
  });
};

export { mainMenu };

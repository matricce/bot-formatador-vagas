import { Escaper, Node } from '@telegraf/entity/types/types';

export function Markdown(match: string, node?: Node): string {
  switch (node?.type || 'monospace') {
    case 'bold':
      return `**${match}**`;
    case 'italic':
      return `__${match.trim()}__ `;
    case 'strikethrough':
      return `~~${match}~~`;
    case 'spoiler':
      return `||${match}||`;
    case 'code':
    case 'monospace':
      return `\`${match}\``;
    case 'blockquote':
    case 'mention':
    case 'custom_emoji':
    case 'hashtag':
    case 'cashtag':
    case 'bot_command':
    case 'phone_number':
    case 'email':
    default:
      return match;
  }
}

export const None: Escaper = (() => {
  const escapables = {};

  return s => s.replace('', r => escapables[r as keyof typeof escapables] || r);
})();

import { Context } from 'grammy';
import { MessageEntity } from 'grammy/types';
import { putHashtags } from '../filters/hashtags';
import { erroUrl } from '../responses/messages';
import { formatJob, sanitizeUrlAndReturnContent } from '../utils/helpers';

export const checkLink = async (ctx: Context) => {
  const message =
    String(
      ctx.update?.message?.entities?.map(
        (e: MessageEntity) => (<MessageEntity.TextLinkMessageEntity>e)?.url,
      ),
    ) ||
    ctx.update?.message?.text ||
    '';

  const content = await sanitizeUrlAndReturnContent(message);

  if (typeof content !== 'string') {
    const jobTitle = `\n${content?.jobTitle || 'JOB_TITLE'}`;
    const jobUrl = `\n🔗 ${content?.jobUrl || 'JOB_URL'}`;
    const answer = formatJob({
      ...(await putHashtags(content?.body || '')),
      jobUrl,
      jobTitle,
    });
    return ctx
      .reply(answer, { parse_mode: 'HTML', reply_to_message_id: ctx.msg?.message_id })
      .catch(() => ctx.reply(erroUrl, { reply_to_message_id: ctx.msg?.message_id }));
  }
  return ctx
    .reply(content, { reply_to_message_id: ctx.msg?.message_id })
    .catch(() => ctx.reply(erroUrl, { reply_to_message_id: ctx.msg?.message_id }));
};

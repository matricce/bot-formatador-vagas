import { Context } from 'grammy';
import { MessageEntity } from 'grammy/types';
import { putHashtags } from '../filters/hashtags';
import { erroUrl } from '../responses/messages';
import { formatJob, sanitizeUrlAndReturnContent } from '../utils/helpers';
import { RetrieveContentResponse } from 'src/types/shared-interfaces';

export const checkLink = async (ctx: Context) => {
  const message =
    String(
      ctx.update?.message?.entities
        ?.map(
          (e: MessageEntity) =>
            (e.type === 'url' && ctx.update?.message?.text?.slice(e.offset, e.offset + e.length)) ||
            (e.type === 'text_link' && e.url) ||
            '',
        )
        .filter(Boolean)[0],
    ) ||
    ctx.update?.message?.text ||
    '';

  const content = await Promise.race([
    sanitizeUrlAndReturnContent(message),
    new Promise<RetrieveContentResponse | undefined>(resolve =>
      setTimeout(() => resolve(undefined), 9000),
    ),
  ]);

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

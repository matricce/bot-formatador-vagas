import { Context } from 'grammy';
import { putHashtags } from '../filters/hashtags';
import { erroUrl } from '../responses/messages';
import { formatJob, isRetrieveContentResponse } from '../utils/helpers';
import { getGeminiResponse, preProcessDescription } from './ia';
import axios from 'axios';
import { postMenu } from '../menus/mainMenu';

export const format = async (ctx: Context, withIA = false) => {
  /*METRIC*/ const startTime = performance.now();
  const message = ctx.update.callback_query?.message?.caption?.split('\n').pop() || '';
  const file = (await ctx.getFile().catch(() => undefined)) || undefined;
  const file_url = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file?.file_path}`;

  const downloadFile = async file_url => {
    const fileContent = await axios
      .get(file_url)
      .then(res => res.data)
      .catch(() => undefined);

    return fileContent;
  };

  const response = await downloadFile(file_url).catch(() => {});

  if (!isRetrieveContentResponse(response)) {
    return ctx.reply(erroUrl, { reply_to_message_id: ctx.msg?.message_id }).catch(console.error);
  }
  const content = response;

  /*METRIC*/ console.log(
    `METRIC: format, before format, url ${message}, time ${performance.now() - startTime} ms`,
  );
  if (content) {
    const jobTitle = `\n${content?.jobTitle || 'JOB_TITLE'}`;
    const jobUrl = `\n🔗 ${content?.jobUrl || message || 'JOB_URL'}`;
    const jobBody = content?.body || '';
    const putHashtagsResponse = await putHashtags(`${jobTitle}\n${jobBody}`);
    const timeElapsed = performance.now() - startTime;
    console.log(`Time elapsed: ${timeElapsed} ms.`);
    const jobDescription: string =
      !withIA || putHashtagsResponse.encerrada
        ? ''
        : (await Promise.race([
            getGeminiResponse(await preProcessDescription(jobBody)),
            new Promise<undefined>((res, rej) =>
              setTimeout(() => rej('Tempo esgotado ao processar a descrição'), 9800 - timeElapsed),
            ),
          ]).catch(async err => console.error(`Erro ao processar a descrição: ${err}`))) || '';
    const answer = formatJob({
      ...putHashtagsResponse,
      jobUrl,
      jobTitle,
      jobDescription,
    });
    /*METRIC*/ const endTime = performance.now();
    /*METRIC*/ console.log(
      `METRIC: format, url ${jobUrl.replace('\n', '')}, time ${endTime - startTime} ms`,
    );
    const sentMessage = await ctx
      .reply(answer, { parse_mode: 'HTML', reply_to_message_id: ctx.msg?.message_id })
      .catch(() => ctx.reply(erroUrl, { reply_to_message_id: ctx.msg?.message_id }));
    if (sentMessage) {
      await postMenu(sentMessage);
    }
  }
};

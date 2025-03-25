import axios from 'axios';
import { Context, InputFile } from 'grammy';
import zlib from 'zlib';
import { putHashtags } from '../filters/hashtags';
import { postMenu } from '../menus/mainMenu';
import { bigMessage, erroUrl } from '../responses/messages';
import { escapeMarkdown, formatJob, isRetrieveContentResponse } from '../utils/helpers';
import { getGeminiResponse, preProcessDescription } from './ia';

export const format = async (ctx: Context, withIA = false) => {
  /*METRIC*/ const startTime = performance.now();
  const message = ctx.update.callback_query?.message?.caption?.split('\n').pop() || '';
  const file = (await ctx.getFile().catch(() => undefined)) || undefined;
  const file_url = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file?.file_path}`;

  const downloadFile = async file_url => {
    const fileContent = await axios
      .get(file_url, { responseType: 'arraybuffer' })
      .then(res => zlib.inflateSync(res.data).toString())
      .then(JSON.parse)
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
    const job = {
      url: content?.jobUrl || message || 'JOB_URL',
      title: content?.jobTitle || 'JOB_TITLE',
      hashtags: {
        jobOpportunity: 'JOB\\_OPPORTUNITY',
        jobLevel: 'JOB\\_LEVEL',
        jobLocal: 'JOB\\_LOCAL',
      },
      description: 'JOB\\_DESCRIPTION',
      descriptionByAI: '',
      confidence: 0,
      reason: '',
      opinion: '',
      sentiment: '',
    };
    const jobBody = content?.body || '';
    const putHashtagsResponse = await putHashtags(`${job.title}\n${jobBody}`);
    const timeElapsed = performance.now() - startTime;
    console.log(`Time elapsed: ${timeElapsed} ms.`);
    if (withIA) {
      const response = await getGeminiResponse(await preProcessDescription(jobBody)).catch(
        async err => console.error(`Erro ao processar a descrição: ${err}`),
      );
      if (response) {
        job.title = response.jobTitle || job.title;
        job.hashtags = {
          jobOpportunity: response.jobHashtags.jobOpportunity,
          jobLevel: response.jobHashtags.jobLevel,
          jobLocal: response.jobHashtags.jobLocal,
        };
        job.descriptionByAI = response.jobDescription;
        job.confidence = response.confidence;
        job.reason = response.reason;
        job.opinion = response.opinion;
        job.sentiment = response.sentiment;
      }
    }
    const answer = formatJob({
      ...putHashtagsResponse,
      jobOpportunity: job.hashtags.jobOpportunity,
      jobLevel: job.hashtags.jobLevel,
      jobLocal: job.hashtags.jobLocal,
      jobUrl: `\n🔗 ${escapeMarkdown(job.url)})`,
      jobTitle: `\n💻 *${escapeMarkdown(job.title)}*`,
      jobDescription: `\n${job.confidence ? job.descriptionByAI : job.description}`,
    });
    /*METRIC*/ const endTime = performance.now();
    /*METRIC*/ console.log(
      `METRIC: format, url ${job.url.replace('\n', '')}, time ${endTime - startTime} ms`,
    );
    const sentMessage = await ctx
      .reply(answer, { parse_mode: 'Markdown', reply_to_message_id: ctx.msg?.message_id })
      .catch(async err => {
        console.error(err);
        await ctx.reply(`${bigMessage}\nErro: ${err}`, {
          reply_to_message_id: ctx.msg?.message_id,
        });
        await ctx.replyWithDocument(new InputFile(Buffer.from(answer), 'vaga.md'), {
          reply_to_message_id: ctx.msg?.message_id,
        });
      });
    if (sentMessage) {
      await postMenu(sentMessage);
      if (job.descriptionByAI) {
        await ctx
          .reply(
            `<b>Confiança:</b> ${job.confidence}%\n\n<b>Motivo:</b> ${job.reason}\n\n<b>Opinião:</b> ${job.opinion}\n\n<b>Sentimento:</b> ${job.sentiment}`,
            {
              reply_to_message_id: sentMessage.message_id,
              parse_mode: 'HTML',
            },
          )
          .catch(console.error);
      }
    }
  }
};

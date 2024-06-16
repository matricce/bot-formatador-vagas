require('../src/main');

import { webhookCallback } from 'grammy';
import bot from '../src/bot';

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, result => {
      if (result instanceof Error) {
        return reject(result);
      }

      return resolve(result);
    });
  });
}

async function handler(req, res) {
  req.body && console.log('handler', req.url, JSON.stringify(req.body, null, 0));
  if (!req.url.startsWith('/api/index')) {
    return res.json({
      homepage: `https://github.com/${process.env.VERCEL_GIT_REPO_OWNER || 'cafeinabots'}/${process.env.VERCEL_GIT_REPO_SLUG || ''}`,
    });
  }
  await runMiddleware(
    req,
    res,
    webhookCallback(
      bot,
      'http',
      args =>
        console.error('Handler timeout error to message', JSON.stringify(args?.body, null, 0)),
      60000,
    ),
  );

  res.status(200).end();
}

export default handler;

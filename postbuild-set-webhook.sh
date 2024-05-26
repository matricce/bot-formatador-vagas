#!/bin/bash

[[ -z $VERCEL_URL ]] && VERCEL_URL=$WEBHOOK_URL

# Chama a API do Telegram para configurar o webhook
echo "Setting Webhook to $VERCEL_URL/api/index"
curl -X POST \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"$VERCEL_URL/api/index\"}" \
  https://api.telegram.org/bot$BOT_TOKEN/setWebhook

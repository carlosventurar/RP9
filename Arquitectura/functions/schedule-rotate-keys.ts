import { Handler } from '@netlify/functions';

export const handler: Handler = async () => {
  // TODO: fetch columns marked as encrypted; re-encrypt using DATA_KEK_VERSION next
  // Maintain grace window for previous versions (read old, write new)
  return { statusCode: 200, body: JSON.stringify({ rotated: true, version: process.env.DATA_KEK_VERSION }) };
};
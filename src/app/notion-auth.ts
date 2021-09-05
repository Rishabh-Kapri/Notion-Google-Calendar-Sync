import { Client } from '@notionhq/client';

const { NOTION_TOKEN } = require('../configs/notion_token.json');

export const notion = new Client({
  auth: NOTION_TOKEN,
});

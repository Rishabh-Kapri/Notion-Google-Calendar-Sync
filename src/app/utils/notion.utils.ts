import { InputPropertyValueMap } from '@notionhq/client/build/src/api-endpoints';
import { Page } from '@notionhq/client/build/src/api-types';
import { Notion } from '../constants';
import { notion } from '../notion-auth';
const {
  DATABASE_ID,
  GCAL_SYNC_PROP,
  GCAL_ID_PROP,
  GCAL_EVENT_ID_PROP,
  GCAL_EDIT_PROP,
  TAGS_PROP,
  TASK_NAME_PROP,
  DUE_DATE_PROP,
  DEFAULT_TIMEZONE,
} = Notion;

/**
 * Formats the date to system timezone ISO string
 * @param {string} date date in ISO string, can be any timezone
 * @returns {string} date as in system timezone ISO string
 */
const formatDate = (date: string): string => {
  const originalDate = new Date(date);
  const offset = originalDate.getTimezoneOffset() * 60 * 1000;
  const localDate = new Date(originalDate.getTime() - offset);
  let localISO = localDate.toISOString();
  localISO = localISO.slice(0, 23) + DEFAULT_TIMEZONE;
  return localISO;
};

const getProperties = (
  title: string,
  calId: string,
  eventId: string,
  startDate: string,
  endDate: string,
  tags: string,
  gCalUpdatedTime: string
) => {
  return {
    [TASK_NAME_PROP as string]: {
      title: [
        {
          type: 'text',
          text: {
            content: title,
          },
        },
      ],
    },
    [GCAL_SYNC_PROP as string]: {
      checkbox: true,
    },
    [GCAL_ID_PROP as string]: {
      rich_text: [
        {
          type: 'text',
          text: {
            content: calId,
          },
        },
      ],
    },
    [GCAL_EVENT_ID_PROP as string]: {
      rich_text: [
        {
          type: 'text',
          text: {
            content: eventId,
          },
        },
      ],
    },
    [GCAL_EDIT_PROP as string]: {
      date: {
        start: formatDate(gCalUpdatedTime),
      },
    },
    [DUE_DATE_PROP as string]: {
      date: {
        start: startDate,
        end: endDate,
      },
    },
    [TAGS_PROP as string]: {
      multi_select: [
        {
          name: tags,
        },
      ],
    },
  } as InputPropertyValueMap;
};

export const getDescription = (tags: string[], done: boolean, energyLevel: string) => {
  let description = '';
  // add done status
  description = `${description}Done: ${done ? 'Yes' : 'No'}`;
  description = `${description}\n`;
  // add tags
  description = `${description}Tags:`;
  tags.forEach((tag) => {
    description = `${description} ${tag},`;
  });
  description = `${description}\n`;
  // add energy level
  description = `${description}Energy Level: ${energyLevel}`;
  description = `${description}\n`;

  return description;
};

export const getNotionTasks = async (): Promise<Page[]> => {
  try {
    const res = await notion.databases.query({
      database_id: DATABASE_ID as string,
      // filter: {
      //   property: 'Name',
      //   text: {
      //     equals: 'test',
      //   },
      // },
    });
    return res.results;
  } catch (err) {
    throw err;
  }
};

export const updateNotionTask = async (
  pageId: string,
  title: string,
  startDate: string,
  endDate: string,
  tags: string,
  calId: string,
  gCalEventId: string,
  gCalUpdatedTime: string
) => {
  const res = await notion.pages.update({
    page_id: pageId,
    archived: false,
    properties: getProperties(title, calId, gCalEventId, startDate, endDate, tags, gCalUpdatedTime),
  });
  if (res) {
    console.log(`UPDATED NOTION TASK: ${res.properties[TASK_NAME_PROP]['title'][0]['plain_text']}`);
  } else {
    throw `Error while updating notion task`;
  }
};

export const createNotionTask = async (
  title: string,
  startDate: string,
  endDate: string,
  calId: string,
  eventId: string,
  gCalUpdatedTime: string,
  tags: string
) => {
  const res = await notion.pages.create({
    parent: {
      database_id: DATABASE_ID as string,
    },
    properties: getProperties(title, calId, eventId, startDate, endDate, tags, gCalUpdatedTime),
  });
  if (res) {
    console.log(`CREATED NEW NOTION TASK FOR ${title}`);
    return true;
  } else {
    console.log(`Some error occured while creating new task for event ${title}`);
    throw `Some error occured while creating new task for event ${title}`;
  }
};

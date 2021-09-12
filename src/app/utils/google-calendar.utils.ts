import { Page } from '@notionhq/client/build/src/api-types';
import { calendar_v3 } from 'googleapis';
import { getDescription, updateNotionTask } from './notion.utils';
import { Notion } from '../constants';
import { gCalEventsByEventId } from '../store';
const {
  GCAL_EVENT_ID_PROP,
  GCAL_EDIT_PROP,
  DUE_DATE_PROP,
  TASK_NAME_PROP,
  TAGS_PROP,
  DONE_PROP,
  ENERGY_LEVEL_PROP,
  DEFAULT_START_MINUTE_UTC,
  DEFAULT_START_HOUR_UTC,
  DEFAULT_INTERVAL,
} = Notion;

export const calendarAlreadyExist = (
  calendarName: string,
  calendarList: calendar_v3.Schema$CalendarListEntry[]
): string => {
  let calId = '';
  const index = calendarList.findIndex((c) => c.summary === calendarName);
  if (index !== -1) {
    calId = calendarList[index].id as string;
  }
  return calId;
};

/**
 * Checks if google calendar event has updated after the saved updated time on notion
 * @param {Page} task a notion task
 * @returns boolean
 */
export const checkForGCalUpdateTime = (
  gCalEventsByEventId: Map<string, calendar_v3.Schema$Event>,
  task: Page
): boolean => {
  let res = false;
  const eventId = (task.properties[GCAL_EVENT_ID_PROP]?.['rich_text']?.[0]?.['plain_text'] as string) ?? '';
  const notionGCalEditTime = task.properties[GCAL_EDIT_PROP]?.['date']?.['start'];
  if (eventId && notionGCalEditTime) {
    const gCalEvent = gCalEventsByEventId.get(eventId);
    let updatedTime = new Date(gCalEvent?.updated as string).getTime();
    const notionTime = new Date(notionGCalEditTime).getTime();
    const difference = Math.abs(updatedTime - notionTime) / 60000; // in minutes
    console.log(
      'EVENT:',
      gCalEvent,
      'GCAL UPDATE TIME:',
      new Date(gCalEvent?.updated as string).toString(),
      'TIME IN NOTION:',
      notionGCalEditTime,
      'DIFFERENCE IN MINUTES:',
      difference
    );

    if (gCalEvent && difference > 1) {
      // update difference is greater than 1 minutes
      res = true;
    }
  }
  return res;
};
export const createNewCalendar = async (calendar: calendar_v3.Calendar, calendarName: string, timeZone: string) => {
  const res = await calendar.calendars.insert({
    requestBody: {
      conferenceProperties: {},
      summary: calendarName,
      timeZone: 'Asia/Kolkata',
    },
  });
  if (res.status === 200) {
    const calendarId = res.data.id as string;
    const getRes = await calendar.calendars.get({ calendarId });
    return getRes.data;
  } else {
    throw res.statusText;
  }
};

export const getEventRequestBody = (
  task: Page
): {
  start: { dateTime: string };
  end: { dateTime: string };
  summary: string;
  description: string;
} | null => {
  const dateProp = task.properties[DUE_DATE_PROP]['date'];
  console.log('dateProp:', dateProp);
  let returnObj: {
    start: { dateTime: string };
    end: { dateTime: string };
    summary: string;
    description: string;
  } | null;
  if (dateProp) {
    // if due date is present
    const title = task.properties[TASK_NAME_PROP]['title'][0]['plain_text'];
    const tags: string[] = [];
    task.properties[TAGS_PROP]?.['multi_select'].forEach((tag) => {
      tags.push(tag['name']);
    });
    const done = task.properties[DONE_PROP]['checkbox'];
    const energyLevel = task.properties[ENERGY_LEVEL_PROP]?.['select']?.['name'] ?? '';

    const startDate = dateProp?.['start'];
    const endDate = dateProp?.['end'];

    const startDateObj = new Date(startDate);
    const startHour = startDateObj.getUTCHours();
    const startMinute = startDateObj.getUTCMinutes();
    if (
      startHour === 0 &&
      startMinute === 0 &&
      (DEFAULT_START_HOUR_UTC as number) !== 0 &&
      (DEFAULT_START_MINUTE_UTC as number) !== 0
    ) {
      // if no time is set, set the hours and minutes defined in enum
      startDateObj.setUTCHours(DEFAULT_START_HOUR_UTC);
      startDateObj.setUTCMinutes(DEFAULT_START_MINUTE_UTC);
    }
    console.log(startDateObj);
    let endDateObj: Date;
    if (!endDate) {
      // if end date is empty, create end date using the interval minutes
      endDateObj = new Date(startDateObj);
      endDateObj.setUTCMinutes(endDateObj.getUTCMinutes() + DEFAULT_INTERVAL);
    } else {
      endDateObj = new Date(endDate);
    }
    console.log(endDateObj);
    const startDateISOString = startDateObj.toISOString();
    const endDateISOString = endDateObj.toISOString();

    const description = getDescription(tags, done, energyLevel);
    returnObj = {
      start: { dateTime: startDateISOString },
      end: { dateTime: endDateISOString },
      summary: title,
      description: description,
    };
  } else {
    returnObj = null;
  }
  return returnObj;
};

export const createNewEventFromNotionTask = async (calendar: calendar_v3.Calendar, calendarId: string, task: Page) => {
  const requestBody = getEventRequestBody(task);
  if (requestBody) {
    const res = await calendar.events.insert({
      calendarId,
      requestBody: requestBody,
    });
    console.log('NEW EVENT:', res.data);
    if (res.status === 200) {
      // fetch the event and add it to the gCalEventsByCalId and allGcalEvents
      // update the notion task
      const event = res.data;
      const title = event.summary as string;
      const tags = event.organizer?.displayName as string;
      const startDate = event.start?.dateTime as string;
      const endDate = event.end?.dateTime as string;
      const updatedTime = event.updated as string;
      const eventId = event.id as string;
      await updateNotionTask(task.id, title, startDate, endDate, tags, calendarId, eventId, updatedTime);
      return true;
    } else {
      throw res.statusText;
    }
  }
};

export const updateGCalEvent = async (calendar: calendar_v3.Calendar, calId: string, eventId: string, task: Page) => {
  const requestBody = getEventRequestBody(task);
  if (requestBody) {
    const res = await calendar.events.update({
      calendarId: calId,
      eventId: eventId,
      requestBody: requestBody,
    });
    console.log('UPDATED EVENT:', res.data);
    if (res.status === 200) {
      // update notion gcal edit time
      const event = res.data;
      const title = event.summary as string;
      const tags = event.organizer?.displayName as string;
      const startDate = event.start?.dateTime as string;
      const endDate = event.end?.dateTime as string;
      let updatedTime = event.updated as string;

      const notionGCalEditTime = task.properties[GCAL_EDIT_PROP]?.['date']?.['start'];
      const difference = Math.abs(new Date(updatedTime).getTime() - new Date(notionGCalEditTime).getTime()) / 60000; // in minutes
      console.log('Difference for notion update:', difference);
      const existingEvent = gCalEventsByEventId.get(eventId);
      if (new Date(existingEvent?.updated as string).getTime() === new Date(updatedTime).getTime()) {
        updatedTime = new Date().toISOString();
      }
      await updateNotionTask(task.id, title, startDate, endDate, tags, calId, eventId, updatedTime);
      if (difference > 1) {
        // if difference is greater than 1 minutes only then update notion task
        // this is needed because google calendar doesn't update the updated time for events that don't change values
      }
      return true;
    } else {
      throw res.statusText;
    }
  }
};

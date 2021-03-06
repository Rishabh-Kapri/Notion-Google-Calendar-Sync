import { calendar_v3 } from 'googleapis';
import { initGCal } from './google-auth';
import * as notionUtils from './utils/notion.utils';
import * as gCalUtils from './utils/google-calendar.utils';
import { Notion } from './constants';
import { logger } from './utils/logger.utils';

const { GCAL_UPDATE_PROP, GCAL_EVENT_ID_PROP, TASK_NAME_PROP, TAGS_PROP } = Notion;
// @TODO
// change this
let {
  calendar,
  gCalEventsByCalId,
  allGcalEvents,
  gCalEventsByEventId,
  notionTasksByEventId,
  calendarList,
  notionTasks,
} = require('./store');

export const init = async () => {
  try {
    calendar = await initGCal();
    const calendarListRes = await calendar.calendarList.list();
    calendarList = calendarListRes.data.items as calendar_v3.Schema$CalendarListEntry[];

    for (let cal of calendarList) {
      const eventsRes = await calendar.events.list({ calendarId: cal.id as string });
      const events = eventsRes.data.items as calendar_v3.Schema$Event[];
      events.forEach((event) => {
        gCalEventsByEventId.set(event.id as string, event);
      });
      gCalEventsByCalId[cal.id as string] = events;
      allGcalEvents = [...allGcalEvents, ...events];
    }

    notionTasks = await notionUtils.getNotionTasks();
    notionTasks.forEach((task) => {
      const eventId = task.properties[GCAL_EVENT_ID_PROP]?.['rich_text']?.[0]?.plain_text ?? '';
      if (eventId) {
        notionTasksByEventId.set(eventId, task);
      }
    });

    /**
     * Tasks that are both in notion and google calendar
     */
    const commonTasks = notionTasks.filter((task) => {
      return gCalEventsByEventId.has(task.properties[GCAL_EVENT_ID_PROP]?.['rich_text']?.[0]?.plain_text);
    });

    /**
     * Tasks that are only in notion
     */
    const tasksOnlyInNotion = notionTasks.filter((task) => {
      return !gCalEventsByEventId.has(task.properties[GCAL_EVENT_ID_PROP]?.['rich_text']?.[0]?.plain_text);
    });

    /**
     * Tasks that are only in google calendar
     */
    const tasksOnlyInGCal = allGcalEvents.filter((event) => {
      return !notionTasksByEventId.has(event.id as string);
    });
    logger.info('COMMON TASKS:', commonTasks.length);
    logger.info('TASK ONLY IN NOTION:', tasksOnlyInNotion.length);
    logger.info('TASK ONLY IN GCAL:', tasksOnlyInGCal.length);

    for (let task of tasksOnlyInNotion) {
      if (!task.properties['Is Recurring?']?.['formula']?.['boolean']) {
        // currently only supporting non-recurring tasks
        const calendarNameFromTag = (task.properties[TAGS_PROP]?.['multi_select']?.[0]?.name as string) ?? '';
        if (calendarNameFromTag) {
          const existingCalId = gCalUtils.calendarAlreadyExist(calendarNameFromTag, calendarList);
          if (existingCalId) {
            // calendar for tag exist, create a new event
            await gCalUtils.createNewEventFromNotionTask(calendar, existingCalId, task);
          } else {
            // create a new calendar with the calendar name
            const timeZone = 'Asia/Kolkata';
            const newCalendar = await gCalUtils.createNewCalendar(calendar, calendarNameFromTag, timeZone);
            calendarList.push(newCalendar);
            await gCalUtils.createNewEventFromNotionTask(calendar, newCalendar.id as string, task);
          }
        } else {
          logger.warn(`No tags to get calendar name for ${task.properties[TASK_NAME_PROP]['title']?.[0]?.plain_text}. Make sure the task is assigned atleast one tag`);
          continue;
        }
      }
    }

    for (let event of tasksOnlyInGCal) {
      // @TODO
      // need to parse description to get all tags and energy level
      // maybe make a separate calendar column in notion because changing calendar will mess up all tags
      const title = event.summary;
      const tags = event.organizer?.displayName as string;
      const startDate = event.start?.dateTime;
      const endDate = event.end?.dateTime;
      const calId = event.organizer?.email;
      const eventId = event.id;
      const updatedTime = event.updated;
      if (startDate && endDate && title && calId && eventId && updatedTime) {
        await notionUtils.createNotionTask(title, startDate, endDate, calId, eventId, updatedTime, tags);
      }
    }

    for (let task of commonTasks) {
      const eventId = task.properties[GCAL_EVENT_ID_PROP]?.['rich_text']?.[0]?.['plain_text'];
      const calId = gCalEventsByEventId.get(eventId)?.organizer?.email as string;
      if (task.properties[GCAL_UPDATE_PROP]?.['formula']?.['boolean']) {
        logger.info(`Updating "${task.properties[TASK_NAME_PROP]['title'][0]['plain_text']}" on google calendar`);
        await gCalUtils.updateGCalEvent(calendar, calId, eventId, task);
      } else if (gCalUtils.checkForGCalUpdateTime(gCalEventsByEventId, task)) {
        logger.info(`Updating "${task.properties[TASK_NAME_PROP]['title'][0]['plain_text']}" on notion`);
        const gCalEvent = gCalEventsByEventId.get(eventId);
        const title = gCalEvent?.summary as string;
        const tags = gCalEvent?.organizer?.displayName as string;
        const startDate = gCalEvent?.start?.dateTime as string;
        const endDate = gCalEvent?.end?.dateTime as string;
        const calId = gCalEvent?.organizer?.email as string;
        const updatedTime = gCalEvent?.updated as string;
        await notionUtils.updateNotionTask(task.id, title, startDate, endDate, tags, calId, eventId, updatedTime);
      } else {
        logger.warn(`Nothing to update for "${task.properties[TASK_NAME_PROP]['title'][0]['plain_text']}"`)
        continue;
      }
    }
  } catch (err) {
    logger.error(err);
  }
};

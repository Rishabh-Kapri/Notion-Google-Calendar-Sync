import { calendar_v3 } from 'googleapis';

import { initGCal } from './app/google-auth';
import { notion } from './app/notion-auth';

import { Notion } from './app/constants';
import { Page } from '@notionhq/client/build/src/api-types';
import { InputPropertyValueMap } from '@notionhq/client/build/src/api-endpoints';

const {
  GCAL_ID_PROP,
  GCAL_SYNC_PROP,
  GCAL_UPDATE_PROP,
  GCAL_EVENT_ID_PROP,
  TAGS_PROP,
  DUE_DATE_PROP,
  DONE_PROP,
  TASK_NAME_PROP,
  ENERGY_LEVEL_PROP,
  DEFAULT_START_HOUR_UTC,
  DEFAULT_START_MINUTE_UTC,
  DEFAULT_INTERVAL,
  DATABASE_ID,
} = Notion;

// app.listen(SERVER_PORT, () => {
//   console.log(`Server listening on port ${SERVER_PORT}`);
// });
let calendar: calendar_v3.Calendar;
let gCalEventsByCalId: Record<string, calendar_v3.Schema$Event[]> = {};
let allGcalEvents: calendar_v3.Schema$Event[] = [];
let calendarList: calendar_v3.Schema$CalendarListEntry[] = [];
let notionTasks = [];

const getNotionTasks = async (): Promise<Page[]> => {
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

const calendarAlreadyExist = (calendarName: string): string => {
  let calId = '';
  const index = calendarList.findIndex((c) => c.summary === calendarName);
  if (index !== -1) {
    calId = calendarList[index].id as string;
  }
  return calId;
};

const createNewCalendar = async (calendarName: string, timeZone: string) => {
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
    calendarList.push(getRes.data);
    return calendarId;
  } else {
    throw res.statusText;
  }
};

const createNewEventFromNotionTask = async (calendarId: string, task: Page) => {
  const title = task.properties[TASK_NAME_PROP]['title'][0]['plain_text'];
  const tags: string[] = [];
  task.properties[TAGS_PROP]?.['multi_select'].forEach((tag) => {
    tags.push(tag['name']);
  });
  const done = task.properties[DONE_PROP]['checkbox'];
  const energyLevel = task.properties[ENERGY_LEVEL_PROP]?.['select']?.['name'] ?? '';

  const dateProp = task.properties[DUE_DATE_PROP];
  console.log(dateProp);
  if (dateProp) {
    // if due date is present
    const startDate = dateProp['date']?.['start'];
    const endDate = dateProp['date']?.['end'];
    console.log(startDate, endDate);

    const startDateObj = new Date(startDate);
    console.log(startDateObj);
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

    // const res = await calendar.events.insert({
    //   calendarId,
    //   requestBody: {
    //     start: { dateTime: startDateISOString },
    //     end: { dateTime: endDateISOString },
    //     summary: title,
    //     description: description,
    //   },
    // });
    // console.log('NEW EVENT:', res.data);
    // if (res.status === 200) {
    //   // fetch the event and add it to the gCalEventsByCalId and allGcalEvents
    //   // update the notion task
    // } else {
    //   throw res.statusText;
    // }
  }
};

const updateNotionTask = async (pageId: string, isTaskOnGCal: boolean, calId: string, gCalEventId: string) => {
  const properties = {
    [GCAL_SYNC_PROP as string]: {
      checkbox: isTaskOnGCal,
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
  } as InputPropertyValueMap;
  const res = await notion.pages.update({
    page_id: pageId,
    properties: properties,
  });
};

const getDescription = (tags: string[], done: boolean, energyLevel: string) => {
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

(async () => {
  calendar = await initGCal();
  const calendarListRes = await calendar.calendarList.list();
  calendarList = calendarListRes.data.items as calendar_v3.Schema$CalendarListEntry[];

  for (let cal of calendarList) {
    const eventsRes = await calendar.events.list({ calendarId: cal.id as string });
    const events = eventsRes.data.items as calendar_v3.Schema$Event[];
    gCalEventsByCalId[cal.id as string] = events;
    allGcalEvents = [...allGcalEvents, ...events];
  }
  console.log(calendarList, allGcalEvents);

  const response = await notion.databases.query({
    database_id: DATABASE_ID as string,
    filter: {
      property: 'Due Date',
      date: {
        equals: new Date().toISOString(),
      },
    },
  });
  let eventInterval;

  // response.results.forEach((result) => {
  //   if (!result.properties[GCAL_SYNC_PROP].checkbox) {
  //     console.log('Not synced with gcal', result.properties['Due Date']);
  //     const dueDate = result.properties['Due Date'];
  //     if (dueDate.date.end) {
  //       const startDate = dueDate.date.start;
  //       const endDate = dueDate.date.end;
  //       const interval = new Date(endDate) - new Date(startDate);
  //       eventInterval = interval ? interval : DEFAULT_INTERVAL;
  //     } else {
  //       eventInterval = DEFAULT_INTERVAL;
  //     }
  //     console.log(eventInterval);
  //   }
  // });
  const tasks = await getNotionTasks();

  /**
   * Tasks that are both in notion and google calendar
   */
  const commonTasks = tasks.filter((task) =>
    allGcalEvents.some((event) => {
      return (
        task?.properties?.[GCAL_EVENT_ID_PROP]?.['rich_text']?.length &&
        event.id === task?.properties?.[GCAL_EVENT_ID_PROP]?.['rich_text']?.[0]?.plain_text
      );
    })
  );

  /**
   * Tasks that are only in notion
   */
  const tasksOnlyInNotion = tasks.filter(
    (task) =>
      !allGcalEvents.some(
        (event) =>
          task.properties[GCAL_EVENT_ID_PROP]?.['rich_text'].length &&
          event.id === task.properties[GCAL_EVENT_ID_PROP]?.['rich_text']?.[0]?.plain_text
      )
  );

  /**
   * Tasks that are only in google calendar
   */
  const tasksOnlyInGCal = allGcalEvents.filter(
    (event) =>
      !tasks.some(
        (task) =>
          task.properties[GCAL_EVENT_ID_PROP]?.['rich_text']?.length &&
          event.id === task.properties[GCAL_EVENT_ID_PROP]?.['rich_text']?.[0]?.plain_text
      )
  );
  // console.log('COMMON TASKS:', commonTasks[0]?.properties['Due Date'], 'TASKS ONLY IN GCAL:', tasksOnlyInGCal);
  // TODO
  // for commonTasks check if update is required on notion or google calendar, prioritse notion update
  // for tasksOnlyInGCal create new task in notion
  // for tasksOnlyInNotion create new event in google calendar
  // tasks.forEach((task) => {
  //   if (task[GCAL_SYNC_PROP]) {
  //     // if task in on google calendar or not
  //     // create event in google calendar
  //   } else if (task[GCAL_UPDATE_PROP] && task[GCAL_EVENT_ID_PROPERTY]) {
  //     // does the existing task on calendar require update
  //     // sync in google calendar
  //   } else if (false) {
  //     // if the task is only on google calendar
  //     // bring it back to notion
  //   } else {
  //     // assume task is updated in google calendar but not in notion
  //     // check if Last GCal Edit Time is different for the google calendar event
  //     // sync it back to notion
  //   }
  // });

  for (let task of tasksOnlyInNotion) {
    if (task.properties[TASK_NAME_PROP]['title']?.[0]?.plain_text === 'test') {
      console.log(task);
      const calendarNameFromTag = (task.properties[TAGS_PROP]?.['multi_select']?.[0]?.name as string) ?? '';
      if (calendarNameFromTag) {
        const existingCalId = calendarAlreadyExist(calendarNameFromTag);
        if (existingCalId) {
          // tag exist, create a new event
          await createNewEventFromNotionTask(existingCalId, task);
        } else {
          // create a new calendar with the calendar name
          const timeZone = 'Asia/Kolkata';
          const calId = await createNewCalendar(calendarNameFromTag, timeZone);
          await createNewEventFromNotionTask(calId, task);
        }
      } else {
        console.log(
          `No tags to get calendar name for ${task.properties[TASK_NAME_PROP]['title']?.[0]?.plain_text}. Make sure the task is assigned atleast one tag`
        );
        continue;
      }
    }
  }
})()
  .then()
  .catch(console.log);

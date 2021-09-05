import { calendar_v3 } from 'googleapis';

import { initGCal } from './app/google-auth';
import { notion } from './app/notion-auth';

import { Notion } from './app/constants';
import { Page } from '@notionhq/client/build/src/api-types';

const {
  GCAL_ID_PROPERTY,
  GCAL_SYNC_PROPERTY,
  GCAL_UPDATE_PROPERTY,
  GCAL_EVENT_ID_PROPERTY,
  TAGS_PROPERTY,
  ENERGY_LEVEL_PROPERTY,
  PROJECT_PROPERTY,
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
/**
 * @type {Calendar}
 */

(async () => {
  try {
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
    // const res = await calendar.events.list({ calendarId });
  } catch (err) {
    console.log(err);
  }
})();

const getNotionTasks = async (): Promise<Page[]> => {
  try {
    const res = await notion.databases.query({
      database_id: DATABASE_ID,
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

(async () => {
  const response = await notion.databases.query({
    database_id: DATABASE_ID,
    filter: {
      property: 'Due Date',
      date: {
        equals: new Date().toISOString(),
      },
    },
  });
  let eventInterval;

  // response.results.forEach((result) => {
  //   if (!result.properties[GCAL_SYNC_PROPERTY].checkbox) {
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

  const commonTasks = tasks.filter((task) =>
    allGcalEvents.some((event) => {
      return (
        task?.properties?.[GCAL_EVENT_ID_PROPERTY]?.['rich_text']?.length &&
        event.id === task?.properties?.[GCAL_EVENT_ID_PROPERTY]?.['rich_text']?.[0]?.plain_text
      );
    })
  );
  const tasksOnlyInNotion = tasks.filter(
    (task) =>
      !allGcalEvents.some(
        (event) =>
          task.properties[GCAL_EVENT_ID_PROPERTY]?.['rich_text'].length &&
          event.id === task.properties[GCAL_EVENT_ID_PROPERTY]?.['rich_text']?.[0]?.plain_text
      )
  );
  const tasksOnlyInGCal = allGcalEvents.filter(
    (event) =>
      !tasks.some(
        (task) =>
          task.properties[GCAL_EVENT_ID_PROPERTY]?.['rich_text']?.length &&
          event.id === task.properties[GCAL_EVENT_ID_PROPERTY]?.['rich_text']?.[0]?.plain_text
      )
  );
  console.log(
    'COMMON TASKS:',
    commonTasks[0]?.properties['Project']['relation'],
    'TASKS ONLY IN GCAL:',
    tasksOnlyInGCal
  );
  // TODO
  // for commonTasks check if update is required on notion or google calendar, prioritse notion update
  // for tasksOnlyInGCal create new task in notion
  // for tasksOnlyInNotion create new event in google calendar
  // tasks.forEach((task) => {
  //   if (task[GCAL_SYNC_PROPERTY]) {
  //     // if task in on google calendar or not
  //     // create event in google calendar
  //   } else if (task[GCAL_UPDATE_PROPERTY] && task[GCAL_EVENT_ID_PROPERTY]) {
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

  tasksOnlyInNotion.forEach(async (task) => {
    // create a new event in google calendar
    console.log(task.properties.Name['title'][0].plain_text);
    if (task.properties.Name['title']?.[0]?.plain_text === 'test') {
      const calendarName = (task.properties[TAGS_PROPERTY]?.['multi_select']?.[0]?.name as string) ?? '';
      if (calendarName) {
        if (calendarAlreadyExist(calendarName)) {
        } else {
          // create a new calendar with the calendar name
          const timeZone = 'Asia/Kolkata';
          const calId = await createNewCalendar(calendarName, timeZone);
          // create a new event
          const title = task.properties['Name']['title'][0]['plain_text'];
          const tags: string[] = [];
          task.properties[TAGS_PROPERTY]?.['multi_select'].forEach((tag) => {
            tags.push(tag['name']);
          });
          const done = task.properties['Done']['checkbox'];
          const energyLevel = task.properties['Enery Level']?.['select'] ?? '';

          const description = getDescription(tags, done, energyLevel);
          await createNewEvent(calId, '', '', title, description);
        }
      } else {
        throw 'No tags to get calendar name. Make sure the task is assigned atleast one tag';
      }
    }
  });
})()
  .then()
  .catch(console.log);

const calendarAlreadyExist = (calendarName: string): boolean => {
  let exist = false;
  const index = calendarList.findIndex((c) => c.summary === calendarName);
  if (index === -1) {
    exist = false;
  } else {
    exist = true;
  }
  return exist;
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

const createNewEvent = async (
  calendarId: string,
  startDate: string,
  endDate: string,
  title: string,
  description: string
) => {
  const res = await calendar.events.insert({
    calendarId,
    requestBody: {
      start: { dateTime: startDate },
      end: { dateTime: endDate },
      summary: title,
      description: description,
    },
  });
  if (res.status === 200) {
    // fetch the event and add it to the gCalEventsByCalId and allGcalEvents
  } else {
    throw res.statusText;
  }
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

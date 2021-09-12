import { Page } from '@notionhq/client/build/src/api-types';
import { calendar_v3 } from 'googleapis';

export const calendar: calendar_v3.Calendar | null = null;
export const gCalEventsByCalId: Record<string, calendar_v3.Schema$Event[]> = {};
export const allGcalEvents: calendar_v3.Schema$Event[] = [];
export const gCalEventsByEventId: Map<string, calendar_v3.Schema$Event> = new Map();
export const notionTasksByEventId: Map<string, Page> = new Map();
export const calendarList: calendar_v3.Schema$CalendarListEntry[] = [];
export const notionTasks: Page[] = [];

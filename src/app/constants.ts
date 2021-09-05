export enum Server {
  SERVER_URL = 'https://localhost:3000',
  SERVER_PORT = 3100,
  REDIRECT_PATH = '/oauth2callback',
}

export enum Google {
  GOOGLE_SCOPES = 'https://www.googleapis.com/auth/calendar',
  TOKEN_PATH = '/home/rishabh/projects/Notion-Google-Calendar-Sync/src/configs/token.json',
}

export enum Notion {
  GCAL_SYNC_PROP = 'Is task on google calendar?',
  GCAL_UPDATE_PROP = 'Update on GCal',
  GCAL_ID_PROP = 'Calendar ID',
  GCAL_EVENT_ID_PROP = 'GCal Event ID',
  DUE_DATE_PROP = 'Due Date',
  TASK_NAME_PROP = 'Name',
  TAGS_PROP = 'Tags',
  DONE_PROP = 'Done',
  ENERGY_LEVEL_PROP = 'Energy Level',
  DATABASE_ID = 'd9bdf793340b4b3eb9a2b837eca48c25',
  DEFAULT_START_HOUR_UTC = 3,
  DEFAULT_START_MINUTE_UTC = 30,
  DEFAULT_INTERVAL = 30, // interval for the event in minutes
}

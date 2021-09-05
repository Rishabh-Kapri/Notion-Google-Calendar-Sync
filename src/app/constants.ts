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
  GCAL_SYNC_PROPERTY = 'Is task on google calendar?',
  GCAL_UPDATE_PROPERTY = 'Update on GCal',
  GCAL_ID_PROPERTY = 'Calendar ID',
  GCAL_EVENT_ID_PROPERTY = 'GCal Event ID',
  TAGS_PROPERTY = 'Tags',
  ENERGY_LEVEL_PROPERTY = 'Energy Level',
  PROJECT_PROPERTY = 'Project',
  DATABASE_ID = 'd9bdf793340b4b3eb9a2b837eca48c25',
}

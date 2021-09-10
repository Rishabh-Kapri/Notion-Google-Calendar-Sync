import { CronJob } from 'cron';

import { init } from '../init';

const initApp = new CronJob(
  '0 */5 * * * *',
  async () => {
    console.log('Initialising app');
    await init();
  },
  'Europe/London'
);

export const initCron = () => {
  initApp.start();
};

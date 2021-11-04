import { CronJob } from 'cron';

import { init } from '../init';
import { logger } from './logger.utils';

const initApp = new CronJob(
  '0 */5 * * * *',
  async () => {
    logger.info('Initialising app');
    await init();
  },
  'Europe/London'
);

export const initCron = () => {
  initApp.start();
};

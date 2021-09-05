import http from 'http';
import url from 'url';
import open from 'open';
import destroyer from 'server-destroy';
import { google, Auth, calendar_v3 } from 'googleapis';
import { Google, Server } from './constants';
const { readFile, writeFile } = require('fs').promises;

const { web: credentials } = require('../configs/client_secret.json');
const { GOOGLE_SCOPES, TOKEN_PATH } = Google;
const { REDIRECT_PATH, SERVER_URL } = Server;

const { client_secret, client_id, redirect_uris } = credentials;

let oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
google.options({ auth: oAuth2Client });

const getAccessToken = (): Promise<Auth.OAuth2Client> => {
  return new Promise(async (resolve, reject) => {
    // grab the url that will be used for authorization
    const authorizeUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: GOOGLE_SCOPES,
    });
    const server = http
      .createServer(async (req, res) => {
        try {
          if (req[url as unknown as string].indexOf(REDIRECT_PATH) > -1) {
            const qs = new url.URL(req.url as string, SERVER_URL).searchParams;
            res.end('Authentication successful! Please return to the console.');
            server.destroy();
            const { tokens } = await oAuth2Client.getToken(qs.get('code') as string);
            oAuth2Client.setCredentials(tokens);
            await writeFile(TOKEN_PATH, JSON.stringify(tokens));
            resolve(oAuth2Client);
          }
        } catch (e) {
          console.log('getAccessToken:', e);
          reject(e);
        }
      })
      .listen(3000, () => {
        // open the browser to the authorize url to start the workflow
        open(authorizeUrl, { wait: false }).then((cp) => cp.unref());
      });
    destroyer(server);
  });
};

const authenticate = async () => {
  try {
    const tokens = await readFile(TOKEN_PATH);
    if (tokens) {
      oAuth2Client.setCredentials(JSON.parse(tokens));
    } else {
      oAuth2Client = await getAccessToken();
    }
    return oAuth2Client;
  } catch (err: any) {
    console.log(err);
    if (err.code === 'ENOENT') {
      return await getAccessToken();
    } else {
      throw err;
    }
  }
};

export const initGCal = async (): Promise<calendar_v3.Calendar> => {
  const oAuth2Client = await authenticate();
  // const calendar = google.calendar({ version: 'v3', oAuth2Client });
  const calendar = google.calendar('v3');
  return calendar;
};

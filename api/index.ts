import type { INestApplication } from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(__filename);
const { createApp } = require('../dist/src/app-factory.js') as {
  createApp: () => Promise<INestApplication>;
};
let appPromise: Promise<INestApplication> | undefined;

function getApp(): Promise<INestApplication> {
  if (appPromise) return appPromise;

  const pendingApp = createApp()
    .then(async (app) => {
      await app.init();
      return app;
    })
    .catch((error: unknown) => {
      appPromise = undefined;
      throw error;
    });
  appPromise = pendingApp;
  return pendingApp;
}

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const app = await getApp();
  app.getHttpAdapter().getInstance().handle(request, response);
}

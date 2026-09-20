import type { Request, Response } from 'express';
import { createApp } from '../src/bootstrap';

let requestHandler: ((req: Request, res: Response) => unknown) | undefined;

export default async function handler(req: Request, res: Response) {
  if (!requestHandler) {
    const app = await createApp();
    await app.init();
    requestHandler = app.getHttpAdapter().getInstance();
  }

  const handler = requestHandler;
  if (!handler) {
    throw new Error('Nest application failed to initialize');
  }

  return handler(req, res);
}

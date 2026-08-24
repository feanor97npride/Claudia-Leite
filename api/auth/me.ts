import type { IncomingMessage, ServerResponse } from 'node:http';
import { getAuthedUser } from '../../server/http.js';
import { sendJson, withErrorHandling, HttpError } from '../../server/http.js';

export default withErrorHandling(async (req: IncomingMessage, res: ServerResponse) => {
  if (req.method !== 'GET') throw new HttpError(405, 'Método não permitido.');
  const user = await getAuthedUser(req);
  sendJson(res, 200, { user });
});

import type { IncomingMessage, ServerResponse } from 'node:http';
import { getAuthedUser } from '../../server/http';
import { sendJson, withErrorHandling, HttpError } from '../../server/http';

export default withErrorHandling(async (req: IncomingMessage, res: ServerResponse) => {
  if (req.method !== 'GET') throw new HttpError(405, 'Método não permitido.');
  const user = await getAuthedUser(req);
  sendJson(res, 200, { user });
});

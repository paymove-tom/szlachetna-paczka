import { allowRequest, clientIp, readBody, sendJson } from '../lib/http.js';
import { getZapisy, zapisz } from '../lib/service.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      return sendJson(res, 200, await getZapisy());
    } catch (error) {
      console.error(error);
      return sendJson(res, 500, {
        error: error.publicMessage || 'Nie udało się odczytać zapisów.',
      });
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'Niedozwolona metoda.' });
  }

  if (!allowRequest(clientIp(req))) {
    return sendJson(res, 429, { error: 'Za dużo prób z rzędu. Odczekaj chwilę i spróbuj ponownie.' });
  }

  const type = String(req.headers['content-type'] || '');
  if (!type.includes('application/json')) {
    return sendJson(res, 415, { error: 'Wyślij dane jako JSON.' });
  }

  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    return sendJson(res, error.statusCode || 400, { error: 'Nie udało się odczytać formularza.' });
  }

  try {
    const result = await zapisz(body || {});
    return sendJson(res, result.status, result.body);
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, {
      error: error.publicMessage || 'Nie udało się zapisać. Spróbuj jeszcze raz.',
    });
  }
}

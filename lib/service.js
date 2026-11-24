import { readPozycje, readZapisy, writeZapisy } from './store.js';
import { validateSignup } from './validate.js';

function assertConfigured() {
  if (process.env.VERCEL && !(process.env.GITHUB_TOKEN || '').trim()) {
    const error = new Error('Brak GITHUB_TOKEN');
    error.publicMessage = 'Zapis jest chwilowo niedostępny. Daj znać opiekunom placówki.';
    throw error;
  }
}

function asMap(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  return data;
}

async function loadPozycje() {
  const data = await readPozycje();
  return Array.isArray(data) ? data : [];
}

export async function getZapisy() {
  assertConfigured();
  const file = await readZapisy();
  return asMap(file.data);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slotIds(item) {
  const count = Number(item.slots) >= 2 ? Math.floor(Number(item.slots)) : 1;
  return Array.from({ length: count }, (_, index) => (index ? `${item.id}-${index + 1}` : item.id));
}

export async function zapisz(input, { gapMs = 0 } = {}) {
  assertConfigured();
  const validation = validateSignup(input);
  if (!validation.ok) {
    return { status: 400, body: { error: validation.message } };
  }

  const pozycje = await loadPozycje();
  const slot = pozycje
    .filter((item) => item && typeof item.id === 'string')
    .flatMap((item) => slotIds(item))
    .find((id) => id === validation.id);
  if (!slot) {
    return { status: 404, body: { error: 'Nie ma takiej pozycji.' } };
  }

  const entry = {
    name: validation.name,
    child: validation.child,
    at: new Date().toISOString(),
  };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const file = await readZapisy();
    const obecne = asMap(file.data);
    if (obecne[validation.id]) {
      return { status: 409, body: { error: 'taken', data: obecne } };
    }
    if (gapMs && attempt === 0) await sleep(gapMs);
    const next = { ...obecne, [validation.id]: entry };
    const written = await writeZapisy(file.sha, next, `chore: zapis na pozycję ${validation.id}`);
    if (written.ok) return { status: 200, body: { ok: true, data: next } };
    if (written.conflict) continue;
  }

  const data = await getZapisy();
  if (data[validation.id]) return { status: 409, body: { error: 'taken', data } };
  return { status: 409, body: { error: 'Nie udało się zapisać. Spróbuj jeszcze raz.', data } };
}

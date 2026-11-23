const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const NAME = /^(?=.{5,80}$)[\p{L}][\p{L}'’.-]*(?:\s+[\p{L}][\p{L}'’.-]*)+$/u;
const CHILD = /^[\p{L}\d][\p{L}\d\s.'’,-]{0,79}$/u;

function clean(value, max) {
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function validateSignup(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, message: 'Uzupełnij formularz.' };
  }

  const honeypot = ['website', 'firma', 'company'].some((key) => String(input[key] || '').trim());
  if (honeypot) return { ok: false, spam: true, message: 'Nie udało się zapisać.' };

  const id = clean(input.id, 64);
  if (!ID.test(id)) return { ok: false, message: 'Wybierz pozycję z listy.' };

  const name = clean(input.name, 80);
  if (/[<>]/.test(name) || !NAME.test(name)) {
    return { ok: false, message: 'Podaj imię i nazwisko — same litery, co najmniej dwa słowa.' };
  }

  const child = clean(input.child, 80);
  if (child && (/[<>]/.test(child) || !CHILD.test(child))) {
    return { ok: false, message: 'Imię dziecka lub grupa zawiera niedozwolone znaki.' };
  }

  return { ok: true, id, name, child };
}

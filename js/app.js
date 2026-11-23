const thanks = document.querySelector('#thanks');
const meter = document.querySelector('#meter');
const list = document.querySelector('#list');
const dialog = document.querySelector('#dialog');
const form = document.querySelector('#form');
const toastNode = document.querySelector('#toast');

let items = [];
let signups = {};

function h(tag, props, ...kids) {
  const node = document.createElement(tag);
  Object.entries(props || {}).forEach(([key, value]) => {
    if (value == null || value === false) return;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, String(value));
  });
  kids.flat().forEach((kid) => {
    if (kid == null || kid === false) return;
    node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  });
  return node;
}

function darow(count) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (count === 1) return 'dar';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'dary';
  return 'darów';
}

function mountSnow() {
  const root = document.querySelector('#snow');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const count = reduce ? 8 : (window.innerWidth < 700 ? 12 : 26);
  for (let index = 0; index < count; index += 1) {
    const flake = document.createElement('span');
    flake.className = reduce ? 'flake is-still' : 'flake';
    flake.textContent = index % 3 === 0 ? '❄' : '•';
    flake.style.left = `${Math.random() * 100}%`;
    flake.style.fontSize = `${8 + (index % 5) * 2}px`;
    flake.style.opacity = String(0.35 + (index % 4) * 0.12);
    if (reduce) flake.style.top = `${8 + (index * 11) % 70}%`;
    else {
      flake.style.animationDuration = `${8 + (index % 6)}s`;
      flake.style.animationDelay = `${-(index * 0.7)}s`;
    }
    root.append(flake);
  }
}

let toastTimer;
function toast(message) {
  toastNode.textContent = message;
  toastNode.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastNode.hidden = true;
  }, 4800);
}

function celebrate() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer = h('div', { class: 'confetti', 'aria-hidden': 'true' });
  const bits = ['❄', '★', '❤', '✦'];
  const colors = ['#e03145', '#1f8a4c', '#f4d35e', '#ffffff', '#ff8fab'];
  const count = window.innerWidth < 700 ? 22 : 40;
  for (let index = 0; index < count; index += 1) {
    const bit = h('span', { text: bits[index % bits.length] });
    bit.style.left = `${(index * 17) % 100}%`;
    bit.style.color = colors[index % colors.length];
    bit.style.fontSize = `${12 + (index % 5) * 3}px`;
    bit.style.animationDelay = `${(index % 6) * 0.04}s`;
    layer.append(bit);
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 2200);
}

function slotIds(item) {
  const count = Number(item.slots) >= 2 ? Math.floor(Number(item.slots)) : 1;
  return Array.from({ length: count }, (_, index) => (index ? `${item.id}-${index + 1}` : item.id));
}

function wolneLabel(count) {
  if (count === 0) return 'wszystko zajęte';
  if (count === 1) return '1 wolne';
  return `${count} wolne`;
}

function render() {
  const rows = Array.isArray(items) ? items : [];
  const places = rows.flatMap(slotIds);
  const taken = places.filter((id) => signups[id]).length;
  thanks.textContent = !places.length
    ? 'Lista darów jest jeszcze pusta.'
    : taken === places.length
      ? '🎉 Wszystkie dary mają już darczyńców, dziękujemy! 🎉'
      : `🎄 Zebraliśmy już ${taken} z ${places.length} ${darow(places.length)}, dziękujemy! 🎄`;
  meter.style.width = places.length ? `${Math.round((taken / places.length) * 100)}%` : '0%';

  const groups = [];
  rows.forEach((item) => {
    const cat = item.cat || 'Inne';
    let group = groups.find((entry) => entry.cat === cat);
    if (!group) {
      group = { cat, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  });

  list.replaceChildren(...groups.map((group) => {
    const free = group.items.flatMap(slotIds).filter((id) => !signups[id]).length;
    const cards = h('div', { class: 'cards' });
    group.items.forEach((item) => {
      const ids = slotIds(item);
      const freeHere = ids.filter((id) => !signups[id]).length;
      const full = freeHere === 0;
      const actions = ids.map((slotId, index) => {
        const signup = signups[slotId];
        const who = signup
          ? `${signup.name || 'Zapisane'}${signup.child ? ` (${signup.child})` : ''}`
          : '';
        const control = signup
          ? h('div', { class: 'who' }, h('span', { class: 'who-name' }, h('span', { class: 'tick', 'aria-hidden': 'true', text: '✓' }), who))
          : h('button', { class: 'btn-join', type: 'button', text: 'Dopisuję się', onclick: () => openDialog(item, slotId) });
        return ids.length > 1
          ? h('div', { class: 'slot' }, h('span', { class: 'slot-label', text: `Miejsce ${index + 1}` }), control)
          : control;
      });
      cards.append(h('article', { class: full ? 'card is-taken' : 'card' },
        h('div', { class: 'icon', 'aria-hidden': 'true', text: item.ico || '🎁' }),
        h('div', {},
          h('h3', { class: 'name', text: item.name || item.id }),
          item.note ? h('p', { class: 'desc', text: item.note }) : null,
          h('p', { class: 'status', text: full ? 'Zajęte, dziękujemy!' : (ids.length > 1 ? `Wolne miejsca: ${freeHere} z ${ids.length}` : 'Wolne, czeka na Ciebie') })),
        h('div', { class: 'action' }, ...actions)));
    });
    return h('section', { class: 'group' },
      h('div', { class: 'group-head' },
        h('h2', { text: group.cat }),
        h('span', { text: wolneLabel(free) })),
      cards);
  }));
}

function openDialog(item, slotId) {
  document.querySelector('#dialog-item').textContent = `${item.ico || ''} ${item.name || ''}`.trim();
  const place = document.querySelector('#dialog-place');
  const ids = slotIds(item);
  if (ids.length > 1) {
    place.hidden = false;
    place.textContent = `Miejsce ${ids.indexOf(slotId) + 1} z ${ids.length}`;
  } else {
    place.hidden = true;
    place.textContent = '';
  }
  document.querySelector('#field-id').value = slotId;
  document.querySelector('#field-name').value = localStorage.getItem('pn') || '';
  document.querySelector('#field-child').value = '';
  document.querySelector('#field-website').value = '';
  document.querySelector('#form-error').textContent = '';
  if (dialog.open) dialog.close();
  dialog.showModal();
  document.querySelector('#field-name').focus();
}

function applySignups(data) {
  if (data && typeof data === 'object' && !Array.isArray(data)) signups = data;
  render();
}

async function load() {
  const [itemsResponse, signupsResponse] = await Promise.all([
    fetch('/data/pozycje.json', { cache: 'no-store' }),
    fetch('/api/zapisy', { cache: 'no-store' }),
  ]);
  if (!itemsResponse.ok || !signupsResponse.ok) throw new Error('load');
  items = await itemsResponse.json();
  applySignups(await signupsResponse.json());
}

document.querySelector('#cancel').addEventListener('click', () => dialog.close());

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = document.querySelector('#submit-signup');
  const previous = button.textContent;
  const id = document.querySelector('#field-id').value;
  const name = document.querySelector('#field-name').value;
  button.disabled = true;
  button.textContent = 'Zapisuję…';
  document.querySelector('#form-error').textContent = '';
  try {
    const response = await fetch('/api/zapisy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        id,
        name,
        child: document.querySelector('#field-child').value,
        website: document.querySelector('#field-website').value,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok && data.ok) {
      localStorage.setItem('pn', name.trim());
      applySignups(data.data);
      dialog.close();
      toast(data.message || 'Dziękujemy! Ten dar jest Wasz.');
      celebrate();
      return;
    }
    if (response.status === 409 && data.error === 'taken') {
      applySignups(data.data);
      dialog.close();
      const who = data.data?.[id]?.name;
      toast(who
        ? `Ktoś właśnie Cię uprzedził. Ta pozycja jest już zapisana na: ${who}.`
        : 'Ktoś właśnie Cię uprzedził. Wybierz proszę inny dar.');
      return;
    }
    document.querySelector('#form-error').textContent = data.error || 'Nie udało się zapisać.';
  } catch {
    document.querySelector('#form-error').textContent = 'Nie udało się połączyć. Sprawdź internet i spróbuj jeszcze raz.';
  } finally {
    button.disabled = false;
    button.textContent = previous;
  }
});

mountSnow();
load().catch(() => {
  thanks.textContent = 'Nie udało się wczytać listy. Odśwież stronę za chwilę.';
});
setInterval(() => {
  fetch('/api/zapisy', { cache: 'no-store' })
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => { if (data) applySignups(data); })
    .catch(() => {});
}, 20000);

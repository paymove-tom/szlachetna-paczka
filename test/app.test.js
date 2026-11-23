import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { zapisz } from '../lib/service.js';
import { validateSignup } from '../lib/validate.js';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('..', import.meta.url));
async function fixture() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'paczka-'));
  await fs.copyFile(path.join(root, 'data', 'pozycje.json'), path.join(dir, 'pozycje.json'));
  await fs.writeFile(path.join(dir, 'zapisy.json'), '{}\n');
  process.env.LOCAL_MODE = '1';
  process.env.DATA_DIR = dir;
  delete process.env.VERCEL;
  delete process.env.GITHUB_TOKEN;
  return dir;
}

test('walidacja odrzuca HTML i przyjmuje polskie imię', () => {
  assert.equal(validateSignup({ id: 'makaron', name: '<script>' }).ok, false);
  assert.equal(validateSignup({ id: 'makaron', name: 'Anna' }).ok, false);
  const ok = validateSignup({ id: 'makaron', name: 'Anna Kowalska', child: 'Zosia, Biedronki' });
  assert.equal(ok.ok, true);
  assert.equal(ok.name, 'Anna Kowalska');
});

test('wyścig dwóch zapisów na tę samą pozycję', async () => {
  const dir = await fixture();
  const [first, second] = await Promise.all([
    zapisz({ id: 'makaron', name: 'Anna Kowalska', child: 'Zosia' }, { gapMs: 250 }),
    zapisz({ id: 'makaron', name: 'Piotr Wiśniewski', child: 'Hania' }, { gapMs: 250 }),
  ]);
  const results = [first, second];
  const won = results.find((item) => item.body.ok);
  const lost = results.find((item) => !item.body.ok);
  assert.equal(won.status, 200);
  assert.equal(won.body.ok, true);
  assert.equal(lost.status, 409);
  assert.equal(lost.body.error, 'taken');
  assert.ok(lost.body.data.makaron.name);
  const saved = JSON.parse(await fs.readFile(path.join(dir, 'zapisy.json'), 'utf8'));
  assert.equal(Object.keys(saved).length, 1);
  assert.equal(typeof saved.makaron.name, 'string');
  assert.equal(typeof saved.makaron.child, 'string');
  assert.equal(typeof saved.makaron.at, 'string');
  assert.equal(saved.zapisy, undefined);
});

test('równoległy zapis dwóch różnych pozycji zachowuje obie', async () => {
  const dir = await fixture();
  const [pasta, cans] = await Promise.all([
    zapisz({ id: 'makaron', name: 'Ewa Nowak', child: '' }, { gapMs: 200 }),
    zapisz({ id: 'ryz', name: 'Jan Zieliński', child: 'Hania' }, { gapMs: 200 }),
  ]);
  assert.equal(pasta.body.ok, true);
  assert.equal(cans.body.ok, true);
  const saved = JSON.parse(await fs.readFile(path.join(dir, 'zapisy.json'), 'utf8'));
  assert.equal(saved.makaron.name, 'Ewa Nowak');
  assert.equal(saved.ryz.name, 'Jan Zieliński');
  assert.equal(saved.ryz.child, 'Hania');
});

test('konflikt sha na GitHubie oddaje pozycję pierwszemu', async () => {
  await fixture();
  process.env.LOCAL_MODE = '0';
  process.env.VERCEL = '1';
  process.env.GITHUB_TOKEN = 'test-token';
  process.env.GITHUB_REPO = 'paymove-tom/szlachetna-paczka';
  process.env.GITHUB_BRANCH = 'main';
  let puts = 0;
  const state = { sha: 'z1', data: {} };
  const original = global.fetch;
  global.fetch = async (_url, options = {}) => {
    if (options.method === 'PUT') {
      puts += 1;
      state.sha = 'z2';
      state.data = { makaron: { name: 'Ewa Malinowska', child: '', at: '2026-11-23T12:00:00.000Z' } };
      return new Response(JSON.stringify({ message: 'sha mismatch' }), { status: 409 });
    }
    return new Response(JSON.stringify({
      sha: state.sha,
      content: Buffer.from(JSON.stringify(state.data)).toString('base64'),
    }), { status: 200 });
  };

  try {
    const result = await zapisz({ id: 'makaron', name: 'Jan Nowak' });
    assert.equal(result.status, 409);
    assert.equal(result.body.error, 'taken');
    assert.equal(result.body.data.makaron.name, 'Ewa Malinowska');
    assert.equal(puts, 1);
  } finally {
    global.fetch = original;
    process.env.LOCAL_MODE = '1';
    delete process.env.VERCEL;
    delete process.env.GITHUB_TOKEN;
  }
});

test('pozycje.json jest listą z produkcji, z miejscami i opisem', async () => {
  const data = JSON.parse(await fs.readFile(path.join(root, 'data', 'pozycje.json'), 'utf8'));
  assert.equal(data.length, 67);
  assert.equal(new Set(data.map((item) => item.cat)).size, 10);
  assert.equal(data.filter((item) => item.slots === 2).length, 25);
  assert.equal(data[0].id, 'odkurzacz');
  assert.equal(data[0].slots, undefined);
  const makaron = data.find((item) => item.id === 'makaron');
  assert.equal(makaron.slots, 2);
  for (const item of data) {
    assert.match(item.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(typeof item.ico, 'string');
    assert.equal(typeof item.name, 'string');
    assert.equal(typeof item.cat, 'string');
    if (item.note != null) assert.equal(typeof item.note, 'string');
    if (item.slots != null) assert.equal(item.slots, 2);
  }
});

test('dwa miejsca są osobnymi kluczami, a produkt bez slots ma tylko jedno', async () => {
  const dir = await fixture();
  const first = await zapisz({ id: 'makaron', name: 'Anna Kowalska', child: '' });
  const second = await zapisz({ id: 'makaron-2', name: 'Piotr Wiśniewski', child: 'Hania' });
  assert.equal(first.body.ok, true);
  assert.equal(second.body.ok, true);
  const saved = JSON.parse(await fs.readFile(path.join(dir, 'zapisy.json'), 'utf8'));
  assert.equal(saved.makaron.name, 'Anna Kowalska');
  assert.equal(saved['makaron-2'].name, 'Piotr Wiśniewski');
  const extra = await zapisz({ id: 'odkurzacz-2', name: 'Ewa Nowak' });
  assert.equal(extra.status, 404);
});

test('ignoreCommand pomija sam plik zapisów', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'paczka-git-'));
  const git = (...args) => exec('git', args, { cwd: dir });
  await git('init', '-b', 'main');
  await git('config', 'user.email', 'test@example.com');
  await git('config', 'user.name', 'Test');
  await git('config', 'commit.gpgsign', 'false');
  await fs.mkdir(path.join(dir, 'data'));
  await fs.writeFile(path.join(dir, 'README.md'), 'start\n');
  await fs.writeFile(path.join(dir, 'data', 'zapisy.json'), '{}\n');
  await git('add', '.');
  await git('commit', '-m', 'init');
  await fs.writeFile(path.join(dir, 'data', 'zapisy.json'), '{"makaron":{"name":"Anna Kowalska","child":"","at":"2026-11-23T12:00:00.000Z"}}\n');
  await git('add', '.');
  await git('commit', '-m', 'zapis');
  const script = path.join(root, 'scripts', 'vercel-ignore-build.sh');
  const skipped = await exec('bash', [script], { cwd: dir }).then(() => 0, (error) => error.code);
  assert.equal(skipped, 0);
  await fs.writeFile(path.join(dir, 'README.md'), 'zmiana\n');
  await git('add', '.');
  await git('commit', '-m', 'readme');
  const built = await exec('bash', [script], { cwd: dir }).then(() => 0, (error) => error.code);
  assert.equal(built, 1);
});

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

let tail = Promise.resolve();

function exclusive(fn) {
  const run = tail.then(fn, fn);
  tail = run.then(
    () => {},
    () => {},
  );
  return run;
}

export function useGithub() {
  return Boolean((process.env.GITHUB_TOKEN || '').trim()) && process.env.LOCAL_MODE !== '1';
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function pozycjeCandidates() {
  if (process.env.DATA_DIR) return [path.join(process.env.DATA_DIR, 'pozycje.json')];
  return [
    path.join(process.cwd(), 'data', 'pozycje.json'),
    path.join(root, 'data', 'pozycje.json'),
  ];
}

export async function readPozycje() {
  let lastError;
  for (const candidate of pozycjeCandidates()) {
    try {
      return JSON.parse(await fs.readFile(candidate, 'utf8'));
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Brak data/pozycje.json');
}

function localZapisyPath() {
  const dir = process.env.DATA_DIR || path.join(root, 'data');
  return path.join(dir, 'zapisy.json');
}

export async function readZapisy() {
  if (useGithub()) return githubRead('data/zapisy.json');
  const text = await fs.readFile(localZapisyPath(), 'utf8');
  return { sha: sha256(text), data: JSON.parse(text) };
}

export async function writeZapisy(expectedSha, data, message) {
  const text = `${JSON.stringify(data, null, 2)}\n`;
  if (useGithub()) return githubWrite('data/zapisy.json', expectedSha, text, message);
  return localCas(localZapisyPath(), expectedSha, text);
}

async function localCas(file, expectedSha, text) {
  return exclusive(async () => {
    const current = await fs.readFile(file, 'utf8');
    if (sha256(current) !== expectedSha) return { conflict: true };
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, text);
    await fs.rename(tmp, file);
    return { ok: true };
  });
}

function githubConfig() {
  const token = (process.env.GITHUB_TOKEN || '').trim();
  const repo = (process.env.GITHUB_REPO || 'paymove-tom/szlachetna-paczka').trim();
  const branch = (process.env.GITHUB_BRANCH || 'main').trim();
  if (!token) throw new Error('Brak GITHUB_TOKEN');
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('Nieprawidłowe GITHUB_REPO');
  if (!/^[\w./-]+$/.test(branch)) throw new Error('Nieprawidłowy GITHUB_BRANCH');
  return { token, repo, branch };
}

function githubHeaders(token) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'czar-bajek-szlachetna-paczka',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function encodeRepoPath(repoPath) {
  return repoPath.split('/').map(encodeURIComponent).join('/');
}

async function githubRead(repoPath) {
  const { token, repo, branch } = githubConfig();
  const url = `https://api.github.com/repos/${repo}/contents/${encodeRepoPath(repoPath)}?ref=${encodeURIComponent(branch)}`;
  const response = await fetch(url, {
    headers: githubHeaders(token),
    signal: AbortSignal.timeout(8000),
  });
  if (response.status === 404) return { sha: null, data: { zapisy: {} } };
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`GitHub odczyt ${response.status}: ${errText.slice(0, 180)}`);
  }
  const json = await response.json();
  const text = Buffer.from(String(json.content || '').replace(/\n/g, ''), 'base64').toString('utf8');
  return { sha: json.sha || null, data: JSON.parse(text) };
}

async function githubWrite(repoPath, sha, text, message) {
  const { token, repo, branch } = githubConfig();
  const url = `https://api.github.com/repos/${repo}/contents/${encodeRepoPath(repoPath)}`;
  const payload = {
    message,
    content: Buffer.from(text, 'utf8').toString('base64'),
    branch,
  };
  if (sha) payload.sha = sha;
  const response = await fetch(url, {
    method: 'PUT',
    headers: githubHeaders(token),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });
  if (response.status === 409) return { conflict: true };
  if (response.status === 422) {
    const errText = await response.text();
    if (/sha/i.test(errText)) return { conflict: true };
    throw new Error(`GitHub zapis ${response.status}: ${errText.slice(0, 180)}`);
  }
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`GitHub zapis ${response.status}: ${errText.slice(0, 180)}`);
  }
  return { ok: true };
}

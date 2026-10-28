import { fileURLToPath, pathToFileURL } from 'node:url';

const DEFAULT_API_BASE_URL = 'https://huggingface.co/api';
const WAKE_STAGES = new Set(['SLEEPING', 'STOPPED']);

function validateSpaceId(spaceId) {
  if (!spaceId || !/^[^/]+\/[^/]+$/.test(spaceId)) {
    throw new Error('HF_SPACE_ID must use the namespace/space-name format, for example Elykia/ek');
  }
}

function apiUrl(apiBaseUrl, spaceId, suffix) {
  const [namespace, name] = spaceId.split('/');
  return `${apiBaseUrl.replace(/\/$/, '')}/spaces/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}${suffix}`;
}

async function requestJson(fetchImpl, url, options) {
  const response = await fetchImpl(url, options);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (!response.ok) {
    const detail = body?.error || body?.message || text.slice(0, 300) || 'no response body';
    throw new Error(`HF API request failed with HTTP ${response.status}: ${detail}`);
  }
  return body;
}

export async function wakeSpace({
  spaceId = process.env.HF_SPACE_ID || 'Elykia/ek',
  token = process.env.HF_TOKEN,
  apiBaseUrl = process.env.HF_API_BASE_URL || DEFAULT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
  logger = console.log,
  wakeStages = WAKE_STAGES
} = {}) {
  validateSpaceId(spaceId);
  if (!token) {
    throw new Error('HF_TOKEN is required');
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('This script requires a fetch implementation');
  }

  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`
  };
  const runtime = await requestJson(
    fetchImpl,
    apiUrl(apiBaseUrl, spaceId, '/runtime'),
    { headers }
  );
  const stage = runtime?.stage || 'UNKNOWN';
  logger(JSON.stringify({
    event: 'space-runtime',
    spaceId,
    stage,
    hardware: runtime?.hardware?.current || runtime?.hardware || null,
    time: new Date().toISOString()
  }));

  if (!wakeStages.has(stage)) {
    return { action: 'skipped', spaceId, stage };
  }

  const restartedRuntime = await requestJson(
    fetchImpl,
    apiUrl(apiBaseUrl, spaceId, '/restart'),
    { method: 'POST', headers }
  );
  logger(JSON.stringify({
    event: 'space-restarted',
    spaceId,
    previousStage: stage,
    stageAfterRequest: restartedRuntime?.stage || null,
    time: new Date().toISOString()
  }));
  return {
    action: 'restarted',
    spaceId,
    stage,
    stageAfterRequest: restartedRuntime?.stage || null
  };
}

const scriptPath = process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(pathToFileURL(process.argv[1]));
if (scriptPath) {
  try {
    const result = await wakeSpace();
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

export { DEFAULT_API_BASE_URL, WAKE_STAGES };

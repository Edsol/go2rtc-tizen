import { AuthError, Camera, Go2rtc } from './api';
import { AvPlayer, avplaySupported } from './avplay';
import { setLanguage, t } from './i18n';
import { Key, registerTvKeys } from './keys';
import { log } from './log';
import { MsePlayer, mseSupported, resetMseBroken } from './mse';
import { loadSettings, saveSettings, serverUrl, Settings } from './settings';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const grid = $('grid');
const statusEl = $('status');
const playerEl = $('player');
const video = $<HTMLVideoElement>('video');
const avObject = $('avplay');
const settingsEl = $('settings');

let settings: Settings = loadSettings();
let api = makeApi();
applySettings();
let streams: Camera[] = [];
let focus = 0;
let current = -1;
/** Bumped on every open/close so a superseded attempt stops instead of racing the new one. */
let session = 0;
let watchdog = 0;
/** Consecutive automatic reopens of the current camera, reset once playback progresses. */
let restarts = 0;
const MAX_RESTARTS = 3;
let refreshTimer = 0;
let retryTimer = 0;
const RETRY_MS = 10000;
const mse = new MsePlayer(video);
const av = new AvPlayer();

type View = 'grid' | 'player' | 'settings';
let view: View = 'grid';

function makeApi(): Go2rtc {
  return new Go2rtc(serverUrl(settings), settings.user, settings.pass);
}

function applySettings(): void {
  document.body.classList.toggle('debug', settings.debug);
  setLanguage(settings.lang);
  setScreenSaver(settings.screensaver);
}

function setScreenSaver(allowed: boolean): void {
  const common = window.webapis?.appcommon;
  if (!common) return;
  const st = common.AppCommonScreenSaverState;
  try {
    common.setScreenSaver(allowed ? st.SCREEN_SAVER_ON : st.SCREEN_SAVER_OFF);
  } catch (e) {
    log(`screensaver: ${(e as Error).message || e}`);
  }
}

function cols(): number {
  return streams.length <= 1 ? 1 : streams.length <= 4 ? 2 : 3;
}

function setStatus(msg: string): void {
  statusEl.textContent = msg;
}

async function loadGrid(): Promise<void> {
  if (!settings.host) return openSettings();
  clearTimeout(retryTimer);
  setStatus('');
  try {
    streams = await api.listCameras();
  } catch (e) {
    if (e instanceof AuthError) {
      setStatus(t('unauthorized'));
      return openSettings();
    }
    setStatus(t('unreachable', { error: (e as Error).message }));
    // Keep the last grid on screen and retry: the server may just be restarting.
    retryTimer = window.setTimeout(() => { if (view === 'grid') loadGrid(); }, RETRY_MS);
    if (streams.length) return;
  }
  grid.className = `grid cols-${cols()}`;
  grid.innerHTML = '';
  for (const { name, audio, online } of streams) {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.innerHTML = `<img alt=""><span></span>`;
    tile.querySelector('span')!.textContent =
      name + (audio === 'aac' ? `  · ${t('audio')}` : '') + (online ? '' : `  · ${t('notConnected')}`);
    if (!online) tile.classList.add('offline');
    grid.appendChild(tile);
  }
  if (!streams.length && !statusEl.textContent) setStatus(t('noCameras'));
  focus = Math.min(focus, Math.max(0, streams.length - 1));
  renderFocus();
  refreshSnapshots();
}

/** Tile widths from style.css (.cols-N .tile), rounded up. */
const SNAPSHOT_WIDTH: Record<number, number> = { 1: 1280, 2: 960, 3: 640 };

function refreshSnapshots(): void {
  clearTimeout(refreshTimer);
  if (view !== 'grid') return;
  Array.from(grid.querySelectorAll('img')).forEach((img, i) => {
    // Load off-screen so a failed or slow frame never blanks the previous one.
    const next = new Image();
    next.onload = () => { img.src = next.src; };
    next.src = api.snapshotUrl(streams[i].sub || streams[i].name, SNAPSHOT_WIDTH[cols()]);
  });
  refreshTimer = window.setTimeout(refreshSnapshots, settings.refreshSec * 1000);
}

function renderFocus(): void {
  Array.from(grid.querySelectorAll('.tile')).forEach((t, i) => t.classList.toggle('focused', i === focus));
  grid.children[focus]?.scrollIntoView({ block: 'nearest' });
}

async function openPlayer(index: number, isRestart = false): Promise<void> {
  if (!streams[index]) return;
  if (!isRestart) restarts = 0;
  clearInterval(watchdog);
  current = index;
  view = 'player';
  clearTimeout(refreshTimer);
  playerEl.hidden = false;
  const cam = streams[index];
  const mine = ++session;
  $('player-label').textContent = cam.name;

  // Main streams can exceed the TV decoder (e.g. 3072x1728), so the sub stream is a fallback.
  const sources = [cam.tv, cam.name, cam.sub].filter((s): s is string => !!s);
  if (cam.audio === 'other') log(`${cam.name}: audio is not AAC, add ${cam.name}_tv with #audio=aac to hear it`);
  for (const src of sources) {
    if (mine !== session) return;
    log(`Opening ${src} (mode ${settings.mode})`);
    try {
      await playSource(src, mine);
      if (mine !== session) return;
      $('player-label').textContent = src === cam.sub ? `${cam.name} (${t('sub')})` : cam.name;
      return;
    } catch (e) {
      if (mine === session) showPlayerError(e as Error);
    }
  }
}

async function playSource(src: string, mine: number): Promise<void> {
  const tryMse = settings.mode !== 'hls' && mseSupported();
  const tryHls = settings.mode !== 'mse' && avplaySupported();
  video.hidden = avObject.hidden = true;
  let lastError = new Error(t('noPlayer'));

  if (tryMse) {
    try {
      video.hidden = false;
      return await mse.play(api.wsUrl(src));
    } catch (e) {
      video.hidden = true;
      lastError = e as Error;
    }
  }
  if (tryHls && mine === session) {
    log('HLS fallback');
    avObject.hidden = false;
    await av.play(api.hlsUrl(src), (msg) => restartPlayer(mine, msg));
    return startWatchdog(mine);
  }
  throw lastError;
}

// AVPlay can keep reporting PLAYING while a live HLS stream has silently stalled (frozen
// frame), so the position is polled and the stream reopened when it stops advancing.
function startWatchdog(mine: number): void {
  let last = -1;
  let still = 0;
  clearInterval(watchdog);
  watchdog = window.setInterval(() => {
    if (mine !== session) return clearInterval(watchdog);
    const pos = av.position();
    if (pos > last) { last = pos; still = 0; restarts = 0; return; }
    if (++still >= 2) restartPlayer(mine, t('stalled'));
  }, 3000);
}

function restartPlayer(mine: number, why: string): void {
  if (mine !== session) return;
  clearInterval(watchdog);
  if (restarts >= MAX_RESTARTS) return showPlayerError(new Error(`${why}, ${t('retryLater')}`));
  restarts++;
  log(`${why}: reopening (${restarts}/${MAX_RESTARTS})`);
  openPlayer(current, true);
}

function showPlayerError(e: Error): void {
  if (view === 'player') $('player-label').textContent = `${streams[current].name} — ${t('error')}: ${e.message}`;
}

function closePlayer(): void {
  session++;
  clearInterval(watchdog);
  mse.stop();
  av.stop();
  playerEl.hidden = true;
  view = 'grid';
  focus = current;
  renderFocus();
  refreshSnapshots();
}

function openSettings(): void {
  view = 'settings';
  settingsEl.hidden = false;
  $<HTMLSelectElement>('cfg-protocol').value = settings.protocol;
  $<HTMLInputElement>('cfg-host').value = settings.host;
  $<HTMLInputElement>('cfg-port').value = settings.port;
  $<HTMLInputElement>('cfg-user').value = settings.user;
  $<HTMLInputElement>('cfg-pass').value = settings.pass;
  $<HTMLSelectElement>('cfg-lang').value = settings.lang;
  $<HTMLSelectElement>('cfg-screensaver').value = settings.screensaver ? '1' : '0';
  $<HTMLSelectElement>('cfg-debug').value = settings.debug ? '1' : '0';
  $<HTMLSelectElement>('cfg-mode').value = settings.mode;
  $<HTMLInputElement>('cfg-refresh').value = String(settings.refreshSec);
  focusField(0);
}

const fields = () => Array.from(settingsEl.querySelectorAll<HTMLElement>('.focusable'));
let fieldIndex = 0;

// Arrows only move a highlight: giving DOM focus to an input opens the TV's on-screen
// keyboard, so focus is given on OK and taken back when the keyboard closes.
function focusField(i: number): void {
  const list = fields();
  fieldIndex = (i + list.length) % list.length;
  list.forEach((f, n) => f.classList.toggle('focused', n === fieldIndex));
  stopEditing();
}

function editing(): HTMLElement | null {
  const el = document.activeElement as HTMLElement | null;
  return el && settingsEl.contains(el) && el.tagName !== 'BUTTON' ? el : null;
}

function stopEditing(): void {
  const el = editing();
  if (el) el.blur();
}

function closeSettings(save: boolean): void {
  if (save) {
    settings = {
      protocol: $<HTMLSelectElement>('cfg-protocol').value as Settings['protocol'],
      host: $<HTMLInputElement>('cfg-host').value.trim(),
      port: $<HTMLInputElement>('cfg-port').value.trim() || '1984',
      user: $<HTMLInputElement>('cfg-user').value.trim(),
      pass: $<HTMLInputElement>('cfg-pass').value,
      lang: $<HTMLSelectElement>('cfg-lang').value as Settings['lang'],
      screensaver: $<HTMLSelectElement>('cfg-screensaver').value === '1',
      debug: $<HTMLSelectElement>('cfg-debug').value === '1',
      mode: $<HTMLSelectElement>('cfg-mode').value as Settings['mode'],
      refreshSec: Math.max(2, Number($<HTMLInputElement>('cfg-refresh').value) || 5),
    };
    saveSettings(settings);
    resetMseBroken();
    api = makeApi();
    applySettings();
  }
  if (!settings.host) return;
  (document.activeElement as HTMLElement | null)?.blur();
  settingsEl.hidden = true;
  view = 'grid';
  loadGrid();
}

function exitApp(): void {
  window.tizen?.application.getCurrentApplication().exit();
}

function onKey(e: KeyboardEvent): void {
  const k = e.keyCode;
  if (view === 'settings') {
    const field = fields()[fieldIndex];
    if (editing()) {
      // The keyboard or the select picker owns the keys until it is closed.
      if (k === Key.ImeDone || k === Key.ImeCancel || k === Key.Back || k === Key.Escape) stopEditing();
      else if (k === Key.Enter && field.tagName === 'INPUT') stopEditing();
      else return;
    } else if (k === Key.Up || k === Key.Left) focusField(fieldIndex - 1);
    else if (k === Key.Down || k === Key.Right) focusField(fieldIndex + 1);
    else if (k === Key.Enter && field.id === 'cfg-save') closeSettings(true);
    else if (k === Key.Enter) return field.focus(); // default action opens the keyboard/picker
    else if (k === Key.Back || k === Key.Escape) closeSettings(false);
    else return;
  } else if (view === 'player') {
    const n = streams.length;
    if (k === Key.Back || k === Key.Escape || k === Key.Enter) closePlayer();
    else if (k === Key.Right || k === Key.Down) openPlayer((current + 1) % n);
    else if (k === Key.Left || k === Key.Up) openPlayer((current - 1 + n) % n);
    else return;
  } else {
    const c = cols();
    const last = streams.length - 1;
    if (k === Key.Right) focus = Math.min(last, focus + 1);
    else if (k === Key.Left) focus = Math.max(0, focus - 1);
    else if (k === Key.Down) focus = Math.min(last, focus + c);
    else if (k === Key.Up) {
      if (focus < c) return void openSettings();
      focus -= c;
    }
    else if (k === Key.Enter) return void openPlayer(focus);
    else if (k === Key.Menu || k === Key.ColorRed) return void openSettings();
    else if (k === Key.Back || k === Key.Exit) return exitApp();
    else return;
    renderFocus();
  }
  e.preventDefault();
}

registerTvKeys();
document.addEventListener('keydown', onKey);
$('cfg-save').addEventListener('click', () => closeSettings(true));
// Back to arrow navigation once a value is picked from a select.
Array.from(settingsEl.querySelectorAll('select')).forEach((sel) => sel.addEventListener('change', () => sel.blur()));
loadGrid();

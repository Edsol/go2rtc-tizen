import { Camera, Go2rtc } from './api';
import { AvPlayer, avplaySupported } from './avplay';
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
let api = new Go2rtc(serverUrl(settings));
document.body.classList.toggle('debug', settings.debug);
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
const mse = new MsePlayer(video);
const av = new AvPlayer();

type View = 'grid' | 'player' | 'settings';
let view: View = 'grid';

function cols(): number {
  return streams.length <= 1 ? 1 : streams.length <= 4 ? 2 : 3;
}

function setStatus(msg: string): void {
  statusEl.textContent = msg;
}

async function loadGrid(): Promise<void> {
  if (!settings.host) return openSettings();
  setStatus('');
  try {
    streams = await api.listCameras();
  } catch (e) {
    setStatus(`Server non raggiungibile: ${(e as Error).message}`);
    streams = [];
  }
  grid.className = `grid cols-${cols()}`;
  grid.innerHTML = '';
  for (const { name } of streams) {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.innerHTML = `<img alt=""><span></span>`;
    tile.querySelector('span')!.textContent = name;
    grid.appendChild(tile);
  }
  if (!streams.length && !statusEl.textContent) setStatus('Nessuna camera configurata in go2rtc');
  focus = Math.min(focus, Math.max(0, streams.length - 1));
  renderFocus();
  refreshSnapshots();
}

function refreshSnapshots(): void {
  clearTimeout(refreshTimer);
  if (view !== 'grid') return;
  Array.from(grid.querySelectorAll('img')).forEach((img, i) => {
    // Load off-screen so a failed or slow frame never blanks the previous one.
    const next = new Image();
    next.onload = () => { img.src = next.src; };
    next.src = api.snapshotUrl(streams[i].sub || streams[i].name);
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
  for (const src of cam.sub ? [cam.name, cam.sub] : [cam.name]) {
    if (mine !== session) return;
    log(`Apro ${src} (modalità ${settings.mode})`);
    try {
      await playSource(src, mine);
      if (mine !== session) return;
      $('player-label').textContent = src === cam.name ? cam.name : `${cam.name} (sub)`;
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
  let lastError = new Error('Nessun player disponibile');

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
    log('Fallback HLS');
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
    if (++still >= 2) restartPlayer(mine, 'stream bloccato');
  }, 3000);
}

function restartPlayer(mine: number, why: string): void {
  if (mine !== session) return;
  clearInterval(watchdog);
  if (restarts >= MAX_RESTARTS) return showPlayerError(new Error(`${why}, riprova più tardi`));
  restarts++;
  log(`${why}: riapro (${restarts}/${MAX_RESTARTS})`);
  openPlayer(current, true);
}

function showPlayerError(e: Error): void {
  if (view === 'player') $('player-label').textContent = `${streams[current].name} — errore: ${e.message}`;
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
  $<HTMLSelectElement>('cfg-debug').value = settings.debug ? '1' : '0';
  $<HTMLSelectElement>('cfg-mode').value = settings.mode;
  $<HTMLInputElement>('cfg-refresh').value = String(settings.refreshSec);
  focusField(0);
}

const fields = () => Array.from(settingsEl.querySelectorAll<HTMLElement>('.focusable'));
let fieldIndex = 0;

function focusField(i: number): void {
  const list = fields();
  fieldIndex = (i + list.length) % list.length;
  list.forEach((f, n) => f.classList.toggle('focused', n === fieldIndex));
  list[fieldIndex].focus();
}

function closeSettings(save: boolean): void {
  if (save) {
    settings = {
      protocol: $<HTMLSelectElement>('cfg-protocol').value as Settings['protocol'],
      host: $<HTMLInputElement>('cfg-host').value.trim(),
      port: $<HTMLInputElement>('cfg-port').value.trim() || '1984',
      debug: $<HTMLSelectElement>('cfg-debug').value === '1',
      mode: $<HTMLSelectElement>('cfg-mode').value as Settings['mode'],
      refreshSec: Math.max(2, Number($<HTMLInputElement>('cfg-refresh').value) || 5),
    };
    saveSettings(settings);
    resetMseBroken();
    api = new Go2rtc(serverUrl(settings));
    document.body.classList.toggle('debug', settings.debug);
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
    if (k === Key.Up) focusField(fieldIndex - 1);
    else if (k === Key.Down) focusField(fieldIndex + 1);
    else if (k === Key.Enter && document.activeElement?.id === 'cfg-save') closeSettings(true);
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
loadGrid();

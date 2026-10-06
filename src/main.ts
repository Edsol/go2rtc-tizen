import { Go2rtc } from './api';
import { AvPlayer, avplaySupported } from './avplay';
import { Key, registerTvKeys } from './keys';
import { MsePlayer, mseSupported } from './mse';
import { loadSettings, saveSettings, Settings } from './settings';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const grid = $('grid');
const statusEl = $('status');
const playerEl = $('player');
const video = $<HTMLVideoElement>('video');
const avObject = $('avplay');
const settingsEl = $('settings');

let settings: Settings = loadSettings();
let api = new Go2rtc(settings.url);
let streams: string[] = [];
let focus = 0;
let current = -1;
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
  if (!settings.url) return openSettings();
  setStatus('');
  try {
    streams = await api.listStreams();
  } catch (e) {
    setStatus(`Server non raggiungibile: ${(e as Error).message}`);
    streams = [];
  }
  grid.style.setProperty('--cols', String(cols()));
  grid.innerHTML = '';
  for (const name of streams) {
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
  grid.querySelectorAll('img').forEach((img, i) => {
    // Load off-screen so a failed or slow frame never blanks the previous one.
    const next = new Image();
    next.onload = () => { img.src = next.src; };
    next.src = api.snapshotUrl(streams[i]);
  });
  refreshTimer = window.setTimeout(refreshSnapshots, settings.refreshSec * 1000);
}

function renderFocus(): void {
  grid.querySelectorAll('.tile').forEach((t, i) => t.classList.toggle('focused', i === focus));
  grid.children[focus]?.scrollIntoView({ block: 'nearest' });
}

async function openPlayer(index: number): Promise<void> {
  if (!streams[index]) return;
  current = index;
  view = 'player';
  clearTimeout(refreshTimer);
  playerEl.hidden = false;
  const name = streams[index];
  $('player-label').textContent = name;

  const tryMse = settings.mode !== 'hls' && mseSupported();
  const tryHls = settings.mode !== 'mse' && avplaySupported();
  video.hidden = avObject.hidden = true;

  if (tryMse) {
    try {
      video.hidden = false;
      await mse.play(api.wsUrl(name));
      return;
    } catch (e) {
      video.hidden = true;
      if (!tryHls) return showPlayerError(e as Error);
    }
  }
  if (tryHls) {
    try {
      avObject.hidden = false;
      await av.play(api.hlsUrl(name), (msg) => showPlayerError(new Error(msg)));
      return;
    } catch (e) {
      return showPlayerError(e as Error);
    }
  }
  showPlayerError(new Error('Nessun player disponibile'));
}

function showPlayerError(e: Error): void {
  if (view === 'player') $('player-label').textContent = `${streams[current]} — errore: ${e.message}`;
}

function closePlayer(): void {
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
  $<HTMLInputElement>('cfg-url').value = settings.url;
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
      url: $<HTMLInputElement>('cfg-url').value.trim(),
      mode: $<HTMLSelectElement>('cfg-mode').value as Settings['mode'],
      refreshSec: Math.max(2, Number($<HTMLInputElement>('cfg-refresh').value) || 5),
    };
    saveSettings(settings);
    api = new Go2rtc(settings.url);
  }
  if (!settings.url) return;
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
    else if (k === Key.Up) focus = Math.max(0, focus - c);
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

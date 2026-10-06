export type PlayerMode = 'auto' | 'mse' | 'hls';

export interface Settings {
  url: string;
  mode: PlayerMode;
  refreshSec: number;
}

const KEY = 'go2rtc-tizen.settings';
const DEFAULTS: Settings = { url: '', mode: 'auto', refreshSec: 5 };

export function loadSettings(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

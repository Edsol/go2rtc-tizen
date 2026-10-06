import { LangSetting } from './i18n';

export type PlayerMode = 'auto' | 'mse' | 'hls';

export interface Settings {
  protocol: 'http' | 'https';
  host: string;
  port: string;
  /** go2rtc `api: username/password` (HTTP Basic); empty when the API is open. */
  user: string;
  pass: string;
  mode: PlayerMode;
  refreshSec: number;
  /** Shows the player log and JS errors on screen. */
  debug: boolean;
  lang: LangSetting;
  /** False keeps the TV screen saver off while the app is open (wall-monitor use). */
  screensaver: boolean;
}

const KEY = 'go2rtc-tizen.settings';
const DEFAULTS: Settings = {
  protocol: 'http', host: '', port: '1984', user: '', pass: '',
  mode: 'auto', refreshSec: 5, debug: false, lang: 'auto', screensaver: true,
};

export function loadSettings(): Settings {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || '{}');
    // 0.1.0 stored a single `url`; split it so existing installs keep their server.
    const m = typeof stored.url === 'string' && stored.url.match(/^(https?):\/\/([^:/]+)(?::(\d+))?/);
    if (m) Object.assign(stored, { protocol: m[1], host: m[2], port: m[3] || DEFAULTS.port });
    delete stored.url;
    return { ...DEFAULTS, ...stored };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function serverUrl(s: Settings): string {
  return s.host ? `${s.protocol}://${s.host}:${s.port || DEFAULTS.port}` : '';
}

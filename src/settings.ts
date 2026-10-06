export type PlayerMode = 'auto' | 'mse' | 'hls';

export interface Settings {
  protocol: 'http' | 'https';
  host: string;
  port: string;
  mode: PlayerMode;
  refreshSec: number;
  /** Shows the player log and JS errors on screen. */
  debug: boolean;
}

const KEY = 'go2rtc-tizen.settings';
const DEFAULTS: Settings = { protocol: 'http', host: '', port: '1984', mode: 'auto', refreshSec: 5, debug: false };

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

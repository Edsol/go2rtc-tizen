export const enum Key {
  Left = 37, Up = 38, Right = 39, Down = 40, Enter = 13,
  Back = 10009, Escape = 27, Menu = 18, ColorRed = 403, Exit = 10182,
}

export function registerTvKeys(): void {
  const input = window.tizen?.tvinputdevice;
  if (!input) return;
  for (const k of ['ColorF0Red', 'MediaPlayPause', 'ChannelUp', 'ChannelDown']) {
    try { input.registerKey(k); } catch { /* key not available on this model */ }
  }
}

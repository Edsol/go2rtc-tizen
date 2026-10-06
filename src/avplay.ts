// Native Samsung player: more codecs (HEVC) and robust HLS, but only on a real TV.

export function avplaySupported(): boolean {
  return !!window.webapis?.avplay;
}

export class AvPlayer {
  play(url: string, onError: (e: string) => void): Promise<void> {
    const av = window.webapis!.avplay;
    this.stop();
    av.open(url);
    av.setDisplayRect(0, 0, 1920, 1080);
    av.setDisplayMethod('PLAYER_DISPLAY_MODE_LETTER_BOX');
    av.setStreamingProperty('ADAPTIVE_INFO', 'FIXED_MAX_RESOLUTION=1920X1080');
    av.setListener({ onerror: onError, onstreamcompleted: () => onError('stream ended') });
    return new Promise((resolve, reject) => {
      av.prepareAsync(() => { av.play(); resolve(); }, (e) => reject(new Error(String(e))));
    });
  }

  stop(): void {
    const av = window.webapis?.avplay;
    if (!av) return;
    try {
      if (av.getState() !== 'NONE') { av.stop(); av.close(); }
    } catch { /* already closed */ }
  }
}

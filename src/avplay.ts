import { log } from './log';

// Native Samsung player: renders on a video plane *behind* the web page, so the page
// must be transparent where the video is (see body.avplay in style.css).

/** Hides `user:pass@` so credentials never reach the on-screen log. */
function redact(url: string): string {
  return url.replace(/\/\/[^/@]*@/, '//***@');
}

export function avplaySupported(): boolean {
  return !!window.webapis?.avplay;
}

export class AvPlayer {
  play(url: string, onError: (e: string) => void): Promise<void> {
    const av = window.webapis!.avplay;
    this.stop();
    log(`AVPlay: opening ${redact(url)}`);
    document.body.classList.add('avplay');
    document.documentElement.style.background = 'transparent';
    return new Promise((resolve, reject) => {
      try {
        av.open(url);
        av.setDisplayRect(0, 0, 1920, 1080);
        av.setDisplayMethod('PLAYER_DISPLAY_MODE_LETTER_BOX');
        av.setListener({
          onerror: (e) => { log(`AVPlay: ${e}`); onError(e); },
          onstreamcompleted: () => onError('stream ended'),
        });
        av.prepareAsync(
          () => { log('AVPlay: playing'); av.play(); resolve(); },
          (e) => { log(`AVPlay: prepare failed ${JSON.stringify(e)}`); this.stop(); reject(new Error(String(e))); },
        );
      } catch (e) {
        // Tizen throws WebAPIException synchronously, e.g. PLAYER_ERROR_INVALID_OPERATION
        const msg = (e as { name?: string }).name || String(e);
        log(`AVPlay: ${msg}`);
        this.stop();
        reject(new Error(msg));
      }
    });
  }

  /** Playback position in ms, or -1 when nothing is playing. */
  position(): number {
    try { return window.webapis!.avplay.getCurrentTime(); } catch { return -1; }
  }

  stop(): void {
    document.body.classList.remove('avplay');
    document.documentElement.style.background = '';
    const av = window.webapis?.avplay;
    if (!av) return;
    // stop() throws in IDLE (opened, not prepared), so close() must run regardless.
    try { av.stop(); } catch { /* not playing */ }
    try { av.close(); } catch { /* not open */ }
  }
}

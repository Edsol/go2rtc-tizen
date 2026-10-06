// go2rtc MSE over WebSocket: the client sends the codecs it can decode,
// the server answers with the chosen mime type and then streams fMP4 segments.

import { log } from './log';

// Video only: Tizen 3.0 fails with MEDIA_ERR_DECODE on the cameras' 16 kHz AAC track,
// and a camera viewer does not need audio.
const CODECS = ['avc1.640029', 'avc1.64002A', 'avc1.640033', 'hvc1.1.6.L153.B0'];

export function mseSupported(): boolean {
  return typeof MediaSource !== 'undefined';
}

export class MsePlayer {
  private ws?: WebSocket;
  private ms?: MediaSource;
  private sb?: SourceBuffer;
  private queue: ArrayBuffer[] = [];
  private timer = 0;

  constructor(private video: HTMLVideoElement) {}

  /** Resolves once frames are actually decoded, rejects if the stream fails first. */
  play(wsUrl: string, timeoutMs = 8000): Promise<void> {
    this.stop();
    return new Promise((resolve, reject) => {
      let started = false;
      const ms = (this.ms = new MediaSource());
      const fail = (why: string) => {
        if (started || this.ms !== ms) return; // a newer play() or stop() owns the player
        log(`MSE: ${why}`);
        this.stop();
        reject(new Error(`MSE ${why}`));
      };
      this.timer = window.setTimeout(() => fail('timeout'), timeoutMs);

      this.video.src = URL.createObjectURL(ms);
      ms.addEventListener('sourceopen', () => {
        const ws = (this.ws = new WebSocket(wsUrl));
        ws.binaryType = 'arraybuffer';
        ws.onopen = () => {
          const codecs = CODECS.filter((c) => MediaSource.isTypeSupported(`video/mp4; codecs="${c}"`));
          log(`MSE: ws aperto, codec supportati: ${codecs.join(',') || 'nessuno'}`);
          ws.send(JSON.stringify({ type: 'mse', value: codecs.join(',') }));
        };
        ws.onerror = () => fail('WebSocket error');
        ws.onclose = () => fail('WebSocket closed');
        ws.onmessage = (ev) => {
          if (this.ws !== ws) return;
          if (typeof ev.data === 'string') {
            const msg = JSON.parse(ev.data);
            if (msg.type === 'mse') {
              log(`MSE: server propone ${msg.value}`);
              if (!MediaSource.isTypeSupported(msg.value)) return fail(`codec non supportato: ${msg.value}`);
              this.sb = ms.addSourceBuffer(msg.value);
              this.sb.mode = 'segments';
              this.sb.addEventListener('updateend', () => this.flush());
            } else if (msg.type === 'error') {
              fail(msg.value);
            }
            return;
          }
          this.queue.push(ev.data);
          this.flush();
        };
        const onPlaying = () => {
          if (this.ms !== ms) return this.video.removeEventListener('timeupdate', onPlaying);
          if (started || this.video.currentTime <= 0) return;
          started = true;
          clearTimeout(this.timer);
          this.video.removeEventListener('timeupdate', onPlaying);
          log(`MSE: in riproduzione ${this.video.videoWidth}x${this.video.videoHeight}`);
          resolve();
        };
        this.video.addEventListener('timeupdate', onPlaying);
        this.video.onerror = () => fail(`errore video ${this.video.error ? this.video.error.code : '?'}`);
        // Chromium 47: play() returns undefined, not a Promise
        const p = this.video.play() as Promise<void> | undefined;
        if (p && p.catch) p.catch(() => undefined);
      });
    });
  }

  private flush(): void {
    const sb = this.sb;
    if (!sb || sb.updating || !this.queue.length) return;
    // Keep latency low: trim old buffer and jump to the live edge if we fall behind.
    const b = sb.buffered;
    if (b.length) {
      const end = b.end(b.length - 1);
      if (end - this.video.currentTime > 2) this.video.currentTime = end - 0.5;
      if (this.video.currentTime - b.start(0) > 30) {
        sb.remove(b.start(0), this.video.currentTime - 10);
        return;
      }
    }
    try {
      sb.appendBuffer(this.queue.shift()!);
    } catch {
      this.queue = [];
    }
  }

  stop(): void {
    clearTimeout(this.timer);
    if (this.ws) {
      this.ws.onclose = this.ws.onerror = this.ws.onmessage = null;
      this.ws.close();
    }
    this.ws = this.sb = undefined;
    this.video.onerror = null;
    this.queue = [];
    if (this.ms) {
      this.video.removeAttribute('src');
      this.video.load();
      this.ms = undefined;
    }
  }
}

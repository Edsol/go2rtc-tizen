// go2rtc MSE over WebSocket: the client sends the codecs it can decode,
// the server answers with the chosen mime type and then streams fMP4 segments.

const CODECS = [
  'avc1.640029', 'avc1.64002A', 'avc1.640033',
  'hvc1.1.6.L153.B0',
  'mp4a.40.2', 'mp4a.40.5', 'flac', 'opus',
];

export function mseSupported(): boolean {
  return typeof MediaSource !== 'undefined';
}

export class MsePlayer {
  private ws?: WebSocket;
  private ms?: MediaSource;
  private sb?: SourceBuffer;
  private queue: ArrayBuffer[] = [];

  constructor(private video: HTMLVideoElement) {}

  /** Resolves once the first segment is appended, rejects if the stream fails first. */
  play(wsUrl: string, timeoutMs = 8000): Promise<void> {
    this.stop();
    return new Promise((resolve, reject) => {
      let started = false;
      const fail = (why: string) => { if (!started) { this.stop(); reject(new Error(why)); } };
      const timer = setTimeout(() => fail('MSE timeout'), timeoutMs);

      const ms = (this.ms = new MediaSource());
      this.video.src = URL.createObjectURL(ms);
      ms.addEventListener('sourceopen', () => {
        const ws = (this.ws = new WebSocket(wsUrl));
        ws.binaryType = 'arraybuffer';
        ws.onopen = () => {
          const codecs = CODECS.filter((c) => MediaSource.isTypeSupported(`video/mp4; codecs="${c}"`));
          ws.send(JSON.stringify({ type: 'mse', value: codecs.join(',') }));
        };
        ws.onerror = () => fail('WebSocket error');
        ws.onclose = () => fail('WebSocket closed');
        ws.onmessage = (ev) => {
          if (typeof ev.data === 'string') {
            const msg = JSON.parse(ev.data);
            if (msg.type === 'mse') {
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
          if (!started) {
            started = true;
            clearTimeout(timer);
            this.video.play().catch(() => undefined);
            resolve();
          }
        };
      }, { once: true });
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
    if (this.ws) {
      this.ws.onclose = this.ws.onerror = this.ws.onmessage = null;
      this.ws.close();
    }
    this.ws = this.sb = undefined;
    this.queue = [];
    if (this.ms) {
      this.video.removeAttribute('src');
      this.video.load();
      this.ms = undefined;
    }
  }
}

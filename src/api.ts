// go2rtc HTTP API: https://github.com/AlexxIT/go2rtc#module-api

export class Go2rtc {
  readonly base: string;

  constructor(url: string) {
    this.base = url.replace(/\/+$/, '');
  }

  async listStreams(): Promise<string[]> {
    const res = await fetch(`${this.base}/api/streams`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Object.keys(await res.json()).sort();
  }

  snapshotUrl(src: string): string {
    return `${this.base}/api/frame.jpeg?src=${encodeURIComponent(src)}&t=${Date.now()}`;
  }

  hlsUrl(src: string): string {
    return `${this.base}/api/stream.m3u8?src=${encodeURIComponent(src)}&mp4`;
  }

  wsUrl(src: string): string {
    return `${this.base.replace(/^http/, 'ws')}/api/ws?src=${encodeURIComponent(src)}`;
  }
}

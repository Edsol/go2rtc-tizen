// go2rtc HTTP API: https://github.com/AlexxIT/go2rtc#module-api

const SUB = '_sub';

export interface Camera {
  name: string;
  /** Lower-resolution stream, used for snapshots and as playback fallback. */
  sub?: string;
}

export class Go2rtc {
  readonly base: string;

  constructor(url: string) {
    this.base = url.replace(/\/+$/, '');
  }

  /** Groups `name` and `name_sub` (Frigate convention) into one camera. */
  async listCameras(): Promise<Camera[]> {
    const res = await fetch(`${this.base}/api/streams`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const names = Object.keys(await res.json());
    const set = new Set(names);
    return names
      .filter((n) => !(n.endsWith(SUB) && set.has(n.slice(0, -SUB.length))))
      .sort()
      .map((name) => ({ name, sub: set.has(name + SUB) ? name + SUB : undefined }));
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

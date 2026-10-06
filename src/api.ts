// go2rtc HTTP API: https://github.com/AlexxIT/go2rtc#module-api

const SUB = '_sub';
/** Optional TV-friendly variant, e.g. `cam_tv: ffmpeg:cam#video=copy#audio=aac/48000`. */
const TV = '_tv';

export type Audio = 'aac' | 'other' | 'none' | 'unknown';

export interface Camera {
  name: string;
  /** Lower-resolution stream, used for snapshots and as playback fallback. */
  sub?: string;
  /** Preferred playback stream when the config defines one. */
  tv?: string;
  audio: Audio;
  /** False when go2rtc has no live connection to the source right now. go2rtc connects
   *  lazily, so an idle stream may still work: this is a hint, not a verdict. */
  online: boolean;
}

interface Producer {
  remote_addr?: string;
  medias?: string[];
}

function audioOf(producers: Producer[]): Audio {
  const medias = producers.reduce<string[]>((all, p) => all.concat(p.medias || []), []);
  if (!medias.length) return 'unknown';
  const audio = medias.filter((m) => m.indexOf('audio') === 0);
  if (!audio.length) return 'none';
  // HLS (MPEG-TS) on the TV only carries AAC; PCMA/PCMU would need transcoding
  return audio.some((m) => /MPEG4-GENERIC|AAC/i.test(m)) ? 'aac' : 'other';
}

export class Go2rtc {
  readonly base: string;

  constructor(url: string) {
    this.base = url.replace(/\/+$/, '');
  }

  /** Groups `name`, `name_sub` (Frigate convention) and `name_tv` into one camera. */
  async listCameras(): Promise<Camera[]> {
    const res = await fetch(`${this.base}/api/streams`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const info: Record<string, { producers?: Producer[] | null }> = await res.json();
    const names = Object.keys(info);
    const set = new Set(names);
    const isVariant = (n: string) =>
      [SUB, TV].some((sfx) => n.endsWith(sfx) && set.has(n.slice(0, -sfx.length)));
    const producers = (n?: string) => (n && info[n] && info[n].producers) || [];
    return names
      .filter((n) => !isVariant(n))
      .sort()
      .map((name) => {
        const tv = set.has(name + TV) ? name + TV : undefined;
        return {
          name,
          sub: set.has(name + SUB) ? name + SUB : undefined,
          tv,
          audio: audioOf(producers(tv).length ? producers(tv) : producers(name)),
          online: producers(name).some((p) => !!p.remote_addr),
        };
      });
  }

  snapshotUrl(src: string): string {
    return `${this.base}/api/frame.jpeg?src=${encodeURIComponent(src)}&t=${Date.now()}`;
  }

  hlsUrl(src: string): string {
    // MPEG-TS segments: Tizen 3.0 AVPlay does not reliably handle fMP4 HLS
    return `${this.base}/api/stream.m3u8?src=${encodeURIComponent(src)}`;
  }

  wsUrl(src: string): string {
    return `${this.base.replace(/^http/, 'ws')}/api/ws?src=${encodeURIComponent(src)}`;
  }
}

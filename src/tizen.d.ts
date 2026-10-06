// Minimal typings for the Tizen TV APIs this app uses.

interface AVPlayListener {
  onbufferingstart?(): void;
  onbufferingcomplete?(): void;
  onstreamcompleted?(): void;
  onerror?(error: string): void;
}

interface AVPlay {
  open(url: string): void;
  close(): void;
  prepareAsync(onSuccess: () => void, onError: (e: unknown) => void): void;
  play(): void;
  stop(): void;
  setDisplayRect(x: number, y: number, w: number, h: number): void;
  setDisplayMethod(method: 'PLAYER_DISPLAY_MODE_LETTER_BOX' | 'PLAYER_DISPLAY_MODE_FULL_SCREEN'): void;
  setListener(listener: AVPlayListener): void;
  setStreamingProperty(prop: string, value: string): void;
  /** Playback position in ms. */
  getCurrentTime(): number;
  getState(): 'NONE' | 'IDLE' | 'READY' | 'PLAYING' | 'PAUSED';
}

interface Window {
  webapis?: {
    avplay: AVPlay;
    appcommon?: {
      setScreenSaver(state: number, onSuccess?: () => void, onError?: (e: unknown) => void): void;
      AppCommonScreenSaverState: { SCREEN_SAVER_OFF: number; SCREEN_SAVER_ON: number };
    };
  };
  tizen?: {
    tvinputdevice: { registerKey(name: string): void };
    application: { getCurrentApplication(): { exit(): void } };
  };
}

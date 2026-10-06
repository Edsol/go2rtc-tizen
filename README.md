# go2rtc-tizen

Samsung Smart TV (Tizen) app for watching the cameras of a [go2rtc](https://go2rtc.org/) server,
including the go2rtc instance embedded in [Frigate](https://frigate.video/).

## Features

- Camera grid with periodically refreshed previews (`/api/frame.jpeg`, scaled server-side)
- Full-screen live view via **MSE** over WebSocket (`/api/ws`), falling back to **HLS** on the
  TV's native AVPlay player (`/api/stream.m3u8`)
- Remote control navigation: arrows, OK, Back; **red key (A)** or **▲** from the top row opens
  settings; in the player, arrows switch to the previous/next camera
- Languages: English (default), Italian, Spanish, German; "Automatic" follows the TV language
- HTTP Basic authentication (go2rtc `api: username/password`)
- Stream variants: `<camera>_sub` for previews and as playback fallback, `<camera>_tv` as the
  preferred playback stream (e.g. with audio transcoded to AAC)
- Automatic reopen when a stream stalls; automatic retry when the server is unreachable
- Optional screen saver suppression while the app is open
- Debug mode with an on-screen log

## Build

```bash
npm install
npm run build   # → dist/
npm run wgt     # → go2rtc-tizen.wgt (unsigned)
```

`npm run watch` rebuilds on every change.

## Install

Install `go2rtc-tizen.wgt` with [Apps2Samsung](https://github.com/Apps2Samsung) ("Custom WGT
File"), which signs it with its own certificate. Alternatively, with the Tizen CLI and a Samsung
certificate profile: `TIZEN_PROFILE=my-profile npm run package`.

On first launch the app opens the settings: enter the go2rtc IP address (port defaults to `1984`).

## go2rtc / Frigate setup

- The go2rtc API port (`1984`) must be reachable from the TV. With Frigate, publish it in
  `docker-compose.yml`.
- Previews need ffmpeg in go2rtc (bundled with Frigate).
- The TV plays AAC audio only. For cameras with PCMA/PCMU audio, add a `_tv` variant:

  ```yaml
  go2rtc:
    streams:
      doorbell_tv: ffmpeg:doorbell#video=copy#audio=aac
  ```

- The go2rtc API exposes the camera RTSP URLs, credentials included: protect it with
  `api: username/password` and enter the same credentials in the app settings.

## Compatibility

- Tested on a 2017 Samsung TV (Tizen 3.0, Chromium 47). The bundle is compiled to ES5 and the CSS
  avoids grid, custom properties and `inset` for that reason.
- On Tizen 3.0, MSE fails to decode the camera streams; the app detects it once and uses HLS from
  then on (saving the settings resets the detection).
- TVs have few hardware decoders and AVPlay plays one video at a time, so the grid uses JPEG
  previews and live video only runs full screen.

## Credits

The icon is based on the [go2rtc](https://github.com/AlexxIT/go2rtc) logo by AlexxIT, released
under the MIT license. This app is an independent project, not affiliated with go2rtc, Frigate
or Samsung.

## License

[MIT](LICENSE)

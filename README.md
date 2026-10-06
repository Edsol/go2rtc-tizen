<div align="center">

<img src="static/icon.png" alt="go2rtc-tizen" width="180">

# go2rtc-tizen

**Your security cameras, on the big screen.**

A lightweight Samsung Smart TV app for watching the cameras of a [go2rtc](https://go2rtc.org/)
server — including the one built into [Frigate](https://frigate.video/).

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Tizen 3.0+](https://img.shields.io/badge/Tizen-3.0%2B-1428A0)
![Samsung TV 2017+](https://img.shields.io/badge/Samsung%20TV-2017%2B-black)
![go2rtc](https://img.shields.io/badge/go2rtc-1.9-red)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)

</div>

---

## ✨ Features

| | |
|---|---|
| 📺 **Camera grid** | Live-refreshing previews of every camera, scaled server-side to stay light |
| ▶️ **Full-screen live view** | MSE over WebSocket, with automatic fallback to the TV's native HLS player |
| 🎮 **Remote-first** | Arrows, OK and Back — no mouse, no pointer, no fuss |
| 🔀 **Smart streams** | Uses `_sub` streams for previews and `_tv` variants for playback, automatically |
| 🔄 **Self-healing** | Reopens stalled streams and reconnects when the server comes back |
| 🔒 **Authentication** | Works with go2rtc `api: username/password` (HTTP Basic) |
| 🌍 **4 languages** | English, Italiano, Español, Deutsch — or follow the TV language |
| 🖥️ **Wall-monitor mode** | Optionally keeps the screen saver off while the app is open |
| 🐞 **Debug overlay** | On-screen log for when something does not play |

## 🚀 Quick start

1. **Expose the go2rtc API** (port `1984`) on your LAN. With Frigate, publish it in `docker-compose.yml`:
   ```yaml
   ports:
     - "1984:1984"
   ```
2. **Download** `go2rtc-tizen.wgt` from the [latest release](../../releases/latest).
3. **Install it** with [Apps2Samsung](https://github.com/Apps2Samsung): choose *Custom WGT File*, pick your TV, install.
   Your TV must be in *Developer Mode* with this computer's IP as host.
4. **Open the app**, enter the go2rtc IP address — the port defaults to `1984` — and press *Save*.

That's it. 🎉

## 🎮 Remote control

| Where | Key | Action |
|---|---|---|
| Grid | ◀ ▶ ▲ ▼ | Move between cameras |
| Grid | **OK** | Open the camera full screen |
| Grid | 🔴 **Red (A)** · ▲ on the top row | Settings |
| Grid | **Back** | Exit |
| Player | ◀ ▶ ▲ ▼ | Previous / next camera |
| Player | **OK** · **Back** | Back to the grid |

## ⚙️ go2rtc / Frigate tips

<details>
<summary><b>Hear the audio of every camera</b></summary>

The TV only plays **AAC** audio. Cameras sending PCMA/PCMU (common on doorbells and TP-Link
cameras) need a `_tv` variant, which the app picks automatically:

```yaml
go2rtc:
  streams:
    doorbell_tv: ffmpeg:doorbell#video=copy#audio=aac
```
</details>

<details>
<summary><b>Lighter previews with sub streams</b></summary>

If a camera has a `<name>_sub` stream (the Frigate convention), the grid uses it for previews and
the player falls back to it when the main stream cannot be played. The `_sub` and `_tv` entries
are hidden from the grid.
</details>

<details>
<summary><b>🔒 Protect the API</b></summary>

The go2rtc API exposes your camera RTSP URLs, **passwords included**, to anyone on the network.
Enable authentication and enter the same credentials in the app settings:

```yaml
go2rtc:
  api:
    username: admin
    password: change-me
```
</details>

## 📟 Compatibility

| | |
|---|---|
| **Tested on** | Samsung UE55MU6120 (2017, Tizen 3.0, Chromium 47) |
| **Video** | H.264 via HLS (AVPlay) or MSE where supported; H.265 untested |
| **Audio** | AAC |
| **go2rtc** | 1.9.14 embedded in Frigate 0.18; standalone go2rtc should work the same |

<details>
<summary>Why some things work the way they do</summary>

- The bundle is compiled down to **ES5** and the CSS avoids grid, custom properties and `inset`:
  Tizen 3.0 ships Chromium 47.
- On Tizen 3.0, MSE accepts the camera codecs but fails to decode them. The app detects this once
  and goes straight to HLS from then on; saving the settings resets the detection.
- TVs have few hardware decoders and AVPlay plays one video at a time, so the grid shows JPEG
  previews and live video runs full screen only.
</details>

## 🛠️ Development

```bash
npm install
npm run build   # → dist/
npm run watch   # rebuild on every change
npm run wgt     # → go2rtc-tizen.wgt (unsigned, Apps2Samsung signs it on install)
```

With the Tizen CLI and a Samsung certificate profile you can also sign it yourself:
`TIZEN_PROFILE=my-profile npm run package`.

Turn on **Debug** in the settings to see the player log on screen while testing.

## 🙏 Credits

The icon is based on the [go2rtc](https://github.com/AlexxIT/go2rtc) logo by AlexxIT (MIT).
This is an independent project, not affiliated with go2rtc, Frigate or Samsung.

## 📄 License

[MIT](LICENSE) © Edoardo Soloperto

# go2rtc-tizen

Web app per TV Samsung (Tizen) che mostra le camere di un server [go2rtc](https://go2rtc.org/).

- Griglia con anteprime (`/api/frame.jpeg`, aggiornate ogni N secondi)
- Schermo intero via **MSE** su WebSocket (`/api/ws`), con fallback a **HLS** sul player nativo AVPlay (`/api/stream.m3u8`)
- Navigazione da telecomando: frecce, OK, Indietro; **MENU** o **tasto rosso** per le impostazioni
- Nel player le frecce passano alla camera precedente/successiva
- Lingue: inglese (predefinita), italiano, spagnolo, tedesco; "Automatica" segue la lingua della TV
- Autenticazione HTTP Basic (`api: username/password` di go2rtc)
- Varianti `<camera>_sub` (anteprime e fallback) e `<camera>_tv` (riproduzione, es. audio convertito in AAC)
- Riapertura automatica se lo stream si blocca; nuovi tentativi se il server non risponde
- Salvaschermo disattivabile mentre l'app è aperta
- Modalità debug con log a schermo

## Build

```bash
npm install
npm run build        # → dist/
```

`npm run watch` ricompila a ogni modifica.

## Pacchetto e installazione

Serve la Tizen CLI (Tizen Studio) con un profilo di certificati Samsung:

```bash
TIZEN_PROFILE=mio-profilo npm run package   # → dist/go2rtc.wgt
```

Il `.wgt` si installa con Apps2Samsung oppure con `sdb` + `tizen install -n go2rtc.wgt`.

## Requisiti go2rtc

- `frame.jpeg` richiede ffmpeg nel container go2rtc (serve per le anteprime).
- Per H.265 usa la modalità **HLS (AVPlay)**: MSE su Tizen in genere decodifica solo H.264.
- La TV deve raggiungere go2rtc in HTTP sulla LAN (porta predefinita `1984`).

## Note

- Target `es2017` / Chromium 56: gira anche sulle TV 2018–2019.
- Le TV hanno pochi decoder hardware, quindi la griglia usa solo JPEG e lo streaming video parte solo a schermo intero.

## Crediti

L'icona usa il logo di [go2rtc](https://github.com/AlexxIT/go2rtc) di AlexxIT, distribuito con licenza MIT.
Questa app è un progetto indipendente, non affiliato a go2rtc.

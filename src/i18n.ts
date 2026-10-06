// UI strings. The debug log stays in English on purpose: it is meant for bug reports.

export type Lang = 'en' | 'it' | 'es' | 'de';
export type LangSetting = Lang | 'auto';

const en = {
  hint: 'Red key (A) or ▲ = settings',
  settings: 'Settings',
  protocol: 'Protocol',
  host: 'IP address',
  port: 'Port',
  username: 'Username (optional)',
  password: 'Password (optional)',
  playerMode: 'Player mode',
  modeAuto: 'Auto (MSE → HLS)',
  refresh: 'Preview refresh (s)',
  language: 'Language',
  langAuto: 'Automatic (TV)',
  screensaver: 'Screen saver',
  screensaverOn: 'Allowed',
  screensaverOff: 'Disabled while the app is open',
  debug: 'Debug (log and errors on screen)',
  save: 'Save',
  unreachable: 'Server unreachable ({error}), retrying…',
  unauthorized: 'Wrong username or password',
  noCameras: 'No cameras configured in go2rtc',
  audio: 'audio',
  notConnected: 'not connected',
  sub: 'sub',
  error: 'error',
  noPlayer: 'No player available',
  stalled: 'stream stalled',
  retryLater: 'try again later',
};

type Strings = typeof en;

const it: Strings = {
  hint: 'Tasto rosso (A) o ▲ = impostazioni',
  settings: 'Impostazioni',
  protocol: 'Protocollo',
  host: 'Indirizzo IP',
  port: 'Porta',
  username: 'Utente (facoltativo)',
  password: 'Password (facoltativa)',
  playerMode: 'Modalità player',
  modeAuto: 'Auto (MSE → HLS)',
  refresh: 'Refresh anteprime (s)',
  language: 'Lingua',
  langAuto: 'Automatica (TV)',
  screensaver: 'Salvaschermo',
  screensaverOn: 'Consentito',
  screensaverOff: "Disattivato con l'app aperta",
  debug: 'Debug (log ed errori a schermo)',
  save: 'Salva',
  unreachable: 'Server non raggiungibile ({error}), riprovo…',
  unauthorized: 'Utente o password errati',
  noCameras: 'Nessuna camera configurata in go2rtc',
  audio: 'audio',
  notConnected: 'non connessa',
  sub: 'sub',
  error: 'errore',
  noPlayer: 'Nessun player disponibile',
  stalled: 'stream bloccato',
  retryLater: 'riprova più tardi',
};

const es: Strings = {
  hint: 'Botón rojo (A) o ▲ = ajustes',
  settings: 'Ajustes',
  protocol: 'Protocolo',
  host: 'Dirección IP',
  port: 'Puerto',
  username: 'Usuario (opcional)',
  password: 'Contraseña (opcional)',
  playerMode: 'Modo de reproducción',
  modeAuto: 'Auto (MSE → HLS)',
  refresh: 'Actualizar vistas previas (s)',
  language: 'Idioma',
  langAuto: 'Automático (TV)',
  screensaver: 'Salvapantallas',
  screensaverOn: 'Permitido',
  screensaverOff: 'Desactivado con la app abierta',
  debug: 'Depuración (registro y errores en pantalla)',
  save: 'Guardar',
  unreachable: 'Servidor no disponible ({error}), reintentando…',
  unauthorized: 'Usuario o contraseña incorrectos',
  noCameras: 'No hay cámaras configuradas en go2rtc',
  audio: 'audio',
  notConnected: 'no conectada',
  sub: 'sub',
  error: 'error',
  noPlayer: 'Ningún reproductor disponible',
  stalled: 'transmisión detenida',
  retryLater: 'inténtalo más tarde',
};

const de: Strings = {
  hint: 'Rote Taste (A) oder ▲ = Einstellungen',
  settings: 'Einstellungen',
  protocol: 'Protokoll',
  host: 'IP-Adresse',
  port: 'Port',
  username: 'Benutzer (optional)',
  password: 'Passwort (optional)',
  playerMode: 'Player-Modus',
  modeAuto: 'Auto (MSE → HLS)',
  refresh: 'Vorschau-Aktualisierung (s)',
  language: 'Sprache',
  langAuto: 'Automatisch (TV)',
  screensaver: 'Bildschirmschoner',
  screensaverOn: 'Erlaubt',
  screensaverOff: 'Aus, solange die App offen ist',
  debug: 'Debug (Log und Fehler auf dem Bildschirm)',
  save: 'Speichern',
  unreachable: 'Server nicht erreichbar ({error}), neuer Versuch…',
  unauthorized: 'Benutzer oder Passwort falsch',
  noCameras: 'Keine Kameras in go2rtc konfiguriert',
  audio: 'Audio',
  notConnected: 'nicht verbunden',
  sub: 'Sub',
  error: 'Fehler',
  noPlayer: 'Kein Player verfügbar',
  stalled: 'Stream hängt',
  retryLater: 'später erneut versuchen',
};

const DICTS: Record<Lang, Strings> = { en, it, es, de };
let dict: Strings = en;

/** The TV menu language, as exposed by its browser (e.g. "it-IT"). */
function tvLanguage(): Lang {
  const code = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return code in DICTS ? (code as Lang) : 'en';
}

export function setLanguage(setting: LangSetting): void {
  const lang = setting === 'auto' ? tvLanguage() : setting;
  dict = DICTS[lang];
  document.documentElement.lang = lang;
  // Static markup: <x data-i18n="key"> sets text, data-i18n-placeholder sets placeholder.
  Array.from(document.querySelectorAll<HTMLElement>('[data-i18n]')).forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n') as keyof Strings);
  });
}

export function t(key: keyof Strings, vars: Record<string, string> = {}): string {
  return dict[key].replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? vars[k] : ''));
}

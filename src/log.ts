// On-screen log: retail TVs expose no console, so the player shows the last lines.
const lines: string[] = [];

export function log(msg: string): void {
  const t = new Date().toTimeString().slice(0, 8);
  lines.push(`${t} ${msg}`);
  if (lines.length > 12) lines.shift();
  const el = document.getElementById('log');
  if (el) el.textContent = lines.join('\n');
}

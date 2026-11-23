// Conversión de hora local de una zona horaria (con horario de verano) a UTC.

function desfase(ms: number, zona: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: zona, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(ms)).map((x) => [x.type, Number(x.value)]),
  );
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - ms;
}

/** `2026-07-01`, `15:00`, `Europe/London` → `2026-07-01T14:00:00.000Z`. */
export function horaLocalAUTC(dia: string, hora: string, zona: string): string {
  const [y, m, d] = dia.split('-').map(Number);
  const [h, mi] = (hora || '12:00').split(':').map(Number);
  const supuesto = Date.UTC(y, m - 1, d, h, mi);
  let ms = supuesto - desfase(supuesto, zona);
  ms = supuesto - desfase(ms, zona);
  return new Date(ms).toISOString();
}

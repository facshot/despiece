import assert from 'node:assert/strict';
import { test } from 'node:test';
import { leerCSV } from '../server/util/csv';
import { mismoEquipo } from '../server/util/nombres';
import { horaLocalAUTC } from '../server/util/zona';

test('CSV: comillas, comas internas, CRLF y BOM', () => {
  const filas = leerCSV('﻿a,b,c\r\n1,"x, y",3\r\n"con ""comillas""",,9\r\n\r\n');
  assert.deepEqual(filas, [
    { a: '1', b: 'x, y', c: '3' },
    { a: 'con "comillas"', b: '', c: '9' },
  ]);
});

test('Nombres: reconoce el mismo equipo escrito distinto', () => {
  const iguales: [string, string][] = [
    ['Man United', 'Manchester United'], ["Nott'm Forest", 'Nottingham Forest'], ['Ath Madrid', 'Atletico Madrid'],
    ['Ath Bilbao', 'Athletic Club'], ['Sociedad', 'Real Sociedad'], ['Betis', 'Real Betis'], ['Milan', 'AC Milan'],
    ['Inter', 'Inter'], ['Celta', 'Celta Vigo'], ['Bayern Munich', 'Bayern München'], ["M'gladbach", 'Borussia Mönchengladbach'],
    ['Dortmund', 'Borussia Dortmund'], ['Paris SG', 'Paris Saint Germain'], ['Mainz', 'FSV Mainz 05'], ['Wolves', 'Wolverhampton Wanderers'],
    ['Espanol', 'Espanyol'], ['Leverkusen', 'Bayer Leverkusen'], ['Sp Lisbon', 'Sporting CP'],
  ];
  for (const [a, b] of iguales) assert.ok(mismoEquipo(a, b), `${a} = ${b}`);
});

test('Nombres: no confunde equipos distintos', () => {
  const distintos: [string, string][] = [
    ['Man United', 'Man City'], ['Real Madrid', 'Atletico Madrid'], ['Inter', 'Milan'], ['Sheffield United', 'Sheffield Weds'],
    ['Everton', 'Liverpool'], ['Betis', 'Sevilla'], ['Real Sociedad', 'Real Betis'], ['Atletico Madrid', 'Real Madrid'],
  ];
  for (const [a, b] of distintos) assert.ok(!mismoEquipo(a, b), `${a} ≠ ${b}`);
});

test('Zona horaria: hora del Reino Unido con y sin horario de verano', () => {
  assert.equal(horaLocalAUTC('2026-07-01', '15:00', 'Europe/London'), '2026-07-01T14:00:00.000Z');
  assert.equal(horaLocalAUTC('2026-12-01', '15:00', 'Europe/London'), '2026-12-01T15:00:00.000Z');
  assert.equal(horaLocalAUTC('2026-12-01', '21:00', 'America/Argentina/Buenos_Aires'), '2026-12-02T00:00:00.000Z');
});

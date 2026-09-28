import { it, expect } from 'vitest';
import { toCsv } from './csv';

it('escapes commas, quotes and line breaks so each record stays one row', () => {
    const csv = toCsv(['nama', 'catatan', 'jumlah'], [
        ['Siti, S.Kep', 'kata "penting"', 3],
        ['Budi', 'baris1\nbaris2', null],
    ]);
    expect(csv).toBe('nama,catatan,jumlah\r\n"Siti, S.Kep","kata ""penting""",3\r\nBudi,"baris1\nbaris2",');
});

it('writes dates as ISO strings', () => {
    expect(toCsv(['t'], [[new Date('2026-01-02T03:04:05Z')]])).toBe('t\r\n2026-01-02T03:04:05.000Z');
});

import type { Response } from 'express';

export type CsvCell = string | number | Date | null | undefined;

/** RFC 4180 cell: quoted when it contains a comma, quote, or line break; quotes doubled. */
function csvCell(value: CsvCell): string {
    const s = value instanceof Date ? value.toISOString() : String(value ?? '');
    return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function toCsv(header: string[], rows: CsvCell[][]): string {
    return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

/** Sends `rows` as a CSV download. Cells are escaped here; callers pass raw values. */
export function sendCsv(res: Response, filename: string, header: string[], rows: CsvCell[][]): void {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    // BOM so Excel opens UTF-8 names (e.g. patient names with accents) correctly.
    res.send('\uFEFF' + toCsv(header, rows));
}

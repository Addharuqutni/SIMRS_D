/**
 * e-Recipe Kemenkes generator.
 *
 * Generates a structured payload + QR-encodable string for each prescription,
 * following the Kemenkes e-Recipe format (data tersandi). The QR payload
 * encodes: doctor info, patient info, prescription items, and a signed
 * timestamp — so the pharmacy can verify authenticity by scanning.
 *
 * Format: pipe-delimited string, similar to Kemenkes e-Recipe spec:
 *   KodeUnik|NoResep|Dokter(SIP)|Pasien(RM,NIK)|Items|Timestamp|Signature
 *
 * The QR payload is also stored as JSON for auditability.
 */

import { createHmac } from 'crypto';

export interface ERecipeItem {
    namaObat: string;
    kodeObat: string;
    dosis: string;
    jumlah: number;
    satuan?: string;
    signa?: string; // e.g. "3x1"
}

export interface ERecipePayload {
    kodeUnik: string;
    noResep: string;
    dokter: { nama: string; sip: string };
    pasien: { nama: string; rm: string; nik?: string; tanggalLahir?: string };
    items: ERecipeItem[];
    timestamp: string;
    signature: string;
}

/**
 * Build the e-Recipe payload and the QR-encodable string.
 * The signature is HMAC-SHA256 of the pipe-joined fields, keyed by a server
 * secret — so tampering with any field invalidates the QR on scan.
 */
export function generateERecipe(
    input: Omit<ERecipePayload, 'kodeUnik' | 'timestamp' | 'signature'>,
    secret: string,
): { payload: ERecipePayload; qrString: string } {
    const kodeUnik = `R-${Date.now()}-${Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, '0')}`;
    const timestamp = new Date().toISOString();

    const itemsStr = input.items
        .map((i) => `${i.kodeObat}:${i.namaObat}:${i.dosis}:${i.jumlah}:${i.signa || ''}`)
        .join('~');

    const pipeStr = [
        kodeUnik,
        input.noResep,
        `${input.dokter.nama}(${input.dokter.sip})`,
        `${input.pasien.nama}#${input.pasien.rm}${input.pasien.nik ? `#${input.pasien.nik}` : ''}`,
        itemsStr,
        timestamp,
    ].join('|');

    const signature = createHmac('sha256', secret).update(pipeStr).digest('hex').slice(0, 16);

    const payload: ERecipePayload = {
        ...input,
        kodeUnik,
        timestamp,
        signature,
    };

    // Final QR string includes the signature for verification
    const qrString = `${pipeStr}|${signature}`;

    return { payload, qrString };
}

/**
 * Verify a scanned e-Recipe QR string against the server secret.
 * Returns the parsed payload if valid, null if the signature doesn't match.
 */
export function verifyERecipe(
    qrString: string,
    secret: string,
): ERecipePayload | null {
    const parts = qrString.split('|');
    if (parts.length < 7) return null;

    const [kodeUnik, noResep, dokterStr, pasienStr, itemsStr, timestamp, signature] = parts;
    const expectedSig = createHmac('sha256', secret).update(qrString.slice(0, -(signature.length + 1))).digest('hex').slice(0, 16);

    if (signature !== expectedSig) return null;

    // Parse back to structured payload
    const dokterMatch = dokterStr.match(/^(.+)\((.+)\)$/);
    const [pasienNama, pasienRm, pasienNik] = pasienStr.split('#');
    const items = itemsStr.split('~').map((s) => {
        const [kodeObat, namaObat, dosis, jumlah, signa] = s.split(':');
        return { kodeObat, namaObat, dosis, jumlah: Number(jumlah), signa: signa || undefined };
    });

    return {
        kodeUnik,
        noResep,
        dokter: { nama: dokterMatch?.[1] || '', sip: dokterMatch?.[2] || '' },
        pasien: { nama: pasienNama, rm: pasienRm, nik: pasienNik || undefined },
        items,
        timestamp,
        signature,
    };
}

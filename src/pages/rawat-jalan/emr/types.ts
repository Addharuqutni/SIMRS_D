export const SOAP_TABS = [
    { key: 'subjektif', label: 'S — Subjektif' },
    { key: 'objektif', label: 'O — Objektif' },
    { key: 'assessment', label: 'A — Assessment' },
    { key: 'plan', label: 'P — Plan' },
    { key: 'cppt', label: 'CPPT Timeline' },
    { key: 'riwayat', label: 'Riwayat' },
] as const;

export type SoapTabKey = (typeof SOAP_TABS)[number]['key'];

export interface SoapForm {
    subjektif: string;
    objektif: string;
    asesmen: string;
    planning: string;
}

export interface MedRow {
    /** Medicine id as typed in the `<select>`; '' until a medicine is picked. */
    obat: string;
    dosis: string;
    jumlah: string;
    keterangan: string;
}

export interface DdiAlert {
    severity: string;
    drugA: string;
    drugB: string;
    description: string;
    recommendation: string;
}

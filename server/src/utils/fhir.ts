/**
 * FHIR R4 (HL7) export builder for SIMRS.
 *
 * Produces a FHIR Bundle (type: collection) containing resources for a
 * given visit: Patient, Encounter, Composition (RME), Observation (vital
 * signs), and MedicationRequest (prescriptions).
 *
 * Reference: https://hl7.org/fhir/R4/
 *
 * Each resource carries the official FHIR resourceType and follows R4
 * cardinality rules so downstream systems (SATUSEHAT, KMS, etc.) can
 * ingest the bundle without re-mapping.
 */

import { db } from '../db';
import { visits, patients } from '../db/schemas/patient';
import { emrSoap, vitalSigns, emrProgressNotes } from '../db/schemas/clinical';
import { prescriptions, prescriptionItems } from '../db/schemas/services';
import { medicines } from '../db/schemas/inventory';
import { users } from '../db/schemas/auth';
import { eq } from 'drizzle-orm';

interface FhirResource {
    resourceType: string;
    id?: string;
    [key: string]: unknown;
}

interface FhirBundle {
    resourceType: 'Bundle';
    type: 'collection';
    timestamp: string;
    entry: Array<{ resource: FhirResource }>;
}

function fhirPatient(p: typeof patients.$inferSelect): FhirResource {
    return {
        resourceType: 'Patient',
        id: p.id,
        identifier: [
            { system: 'http://simrs.local/patient/rm', value: p.rm },
            ...(p.nik ? [{ system: 'http://hl7.org/fhir/sid/wn-indonesia-nik', value: p.nik }] : []),
        ],
        name: [{ use: 'official', text: p.nama }],
        gender: p.gender === 'L' ? 'male' : p.gender === 'P' ? 'female' : 'unknown',
        birthDate: p.tanggalLahir || undefined,
        address: p.alamat ? [{ text: p.alamat }] : undefined,
        telecom: p.telepon ? [{ system: 'phone', value: p.telepon }] : undefined,
    };
}

function fhirEncounter(v: typeof visits.$inferSelect, patientId: string): FhirResource {
    const codeMap: Record<string, string> = {
        rawat_jalan: 'AMB',
        igd: 'EMER',
        rawat_inap: 'IMP',
    };
    return {
        resourceType: 'Encounter',
        id: v.id,
        status: v.status === 'selesai' ? 'finished' : 'in-progress',
        class: {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            code: codeMap[v.tipeKunjungan] || 'AMB',
            display: v.tipeKunjungan,
        },
        subject: { reference: `Patient/${patientId}` },
        period: {
            start: v.waktuDaftar.toISOString(),
            end: v.waktuSelesai?.toISOString(),
        },
        serviceProvider: { display: 'SIMRS Hospital' },
    };
}

function fhirComposition(visitId: string, patientId: string, soap: typeof emrSoap.$inferSelect | undefined, dokterName: string): FhirResource {
    return {
        resourceType: 'Composition',
        id: `composition-${visitId}`,
        status: 'final',
        type: {
            coding: [{
                system: 'http://loinc.org',
                code: '11506-3',
                display: 'Progress note',
            }],
        },
        subject: { reference: `Patient/${patientId}` },
        date: soap?.updatedAt?.toISOString() || new Date().toISOString(),
        author: [{ display: dokterName }],
        title: 'Rekam Medis Elektronik (SOAP)',
        section: [
            soap?.subjektif ? { title: 'Subjektif', text: { status: 'generated', div: `<div>${soap.subjektif}</div>` } } : null,
            soap?.objektif ? { title: 'Objektif', text: { status: 'generated', div: `<div>${soap.objektif}</div>` } } : null,
            soap?.asesmen ? { title: 'Asesmen', text: { status: 'generated', div: `<div>${soap.asesmen}</div>` } } : null,
            soap?.planning ? { title: 'Plan', text: { status: 'generated', div: `<div>${soap.planning}</div>` } } : null,
        ].filter(Boolean),
    };
}

function fhirObservationVitals(vs: typeof vitalSigns.$inferSelect, patientId: string): FhirResource[] {
    const obs: FhirResource[] = [];
    const baseId = `obs-vitals-${vs.id}`;

    const pushObs = (code: string, display: string, value: number, unit: string, suffix: string) => {
        obs.push({
            resourceType: 'Observation',
            id: `${baseId}-${suffix}`,
            status: 'final',
            category: [{
                coding: [{
                    system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                    code: 'vital-signs',
                    display: 'Vital Signs',
                }],
            }],
            code: { coding: [{ system: 'http://loinc.org', code, display }] },
            subject: { reference: `Patient/${patientId}` },
            effectiveDateTime: vs.createdAt.toISOString(),
            valueQuantity: { value, unit, system: 'http://unitsofmeasure.org', code: unit },
        });
    };

    if (vs.sistolik != null) pushObs('8480-6', 'Systolic blood pressure', vs.sistolik, 'mmHg', 'sys');
    if (vs.diastolik != null) pushObs('8462-4', 'Diastolic blood pressure', vs.diastolik, 'mmHg', 'dia');
    if (vs.nadi != null) pushObs('8867-4', 'Heart rate', vs.nadi, '/min', 'hr');
    if (vs.suhu != null) pushObs('8310-5', 'Body temperature', vs.suhu, 'Cel', 'temp');
    if (vs.pernapasan != null) pushObs('9279-1', 'Respiratory rate', vs.pernapasan, '/min', 'rr');
    if (vs.spo2 != null) pushObs('59408-5', 'Oxygen saturation', vs.spo2, '%', 'spo2');
    if (vs.gcs != null) pushObs('35088-4', 'Glasgow coma scale', vs.gcs, '{score}', 'gcs');

    return obs;
}

function fhirMedicationRequest(
    item: typeof prescriptionItems.$inferSelect & { medicineName?: string },
    patientId: string,
    dokterId: string,
): FhirResource {
    return {
        resourceType: 'MedicationRequest',
        id: `medreq-${item.id}`,
        status: 'active',
        intent: 'order',
        medicationCodeableConcept: {
            text: item.medicineName || item.obatId,
        },
        subject: { reference: `Patient/${patientId}` },
        requester: { reference: `Practitioner/${dokterId}` },
        dosageInstruction: [{
            text: item.dosis,
            doseAndRate: item.jumlah ? { doseQuantity: { value: item.jumlah } } : undefined,
        }],
    };
}

/**
 * Build a complete FHIR R4 Bundle for a visit — ready to POST to a
 * SATUSEHAT or other FHIR-compliant endpoint.
 */
export async function buildVisitFhirBundle(visitId: string): Promise<FhirBundle> {
    const visitRows = await db.select().from(visits).where(eq(visits.id, visitId)).limit(1);
    if (!visitRows.length) throw new Error('Visit not found');
    const visit = visitRows[0];

    const patientRows = await db.select().from(patients).where(eq(patients.id, visit.patientId)).limit(1);
    const patient = patientRows[0];
    if (!patient) throw new Error('Patient not found');

    const soapRows = await db.select().from(emrSoap).where(eq(emrSoap.visitId, visitId)).limit(1);
    const soap = soapRows[0];

    const dokterRows = await db.select({ name: users.name }).from(users).where(eq(users.id, visit.dokterId)).limit(1);
    const dokterName = dokterRows[0]?.name || 'Dokter';

    const vitals = await db.select().from(vitalSigns).where(eq(vitalSigns.visitId, visitId));
    const prescRows = await db.select().from(prescriptions).where(eq(prescriptions.visitId, visitId));
    const items: (typeof prescriptionItems.$inferSelect & { medicineName?: string })[] = [];
    for (const p of prescRows) {
        const itemRows = await db.select().from(prescriptionItems).where(eq(prescriptionItems.prescriptionId, p.id));
        for (const ir of itemRows) {
            const medRows = await db.select({ nama: medicines.nama }).from(medicines).where(eq(medicines.id, Number(ir.obatId))).limit(1);
            items.push({ ...ir, medicineName: medRows[0]?.nama });
        }
    }

    const resources: FhirResource[] = [
        fhirPatient(patient),
        fhirEncounter(visit, patient.id),
        fhirComposition(visitId, patient.id, soap, dokterName),
    ];

    for (const v of vitals) {
        resources.push(...fhirObservationVitals(v, patient.id));
    }

    for (const item of items) {
        resources.push(fhirMedicationRequest(item, patient.id, visit.dokterId));
    }

    return {
        resourceType: 'Bundle',
        type: 'collection',
        timestamp: new Date().toISOString(),
        entry: resources.map((r) => ({ resource: r })),
    };
}

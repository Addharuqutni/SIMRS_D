/**
 * Clinical Decision Support System (CDSS) — lightweight, rule-based.
 *
 * 1. ICD-10 auto-suggest: matches free-text SOAP (Indonesian clinical
 *    terms) to ICD-10 codes using a curated keyword map. Not a full NLP,
 *    but a pragmatic "if text contains X, suggest Y" matcher that covers
 *    the top outpatient diagnoses in Indonesian primary care.
 *
 * 2. Drug-drug interaction (DDI) checker: flags known major/severe
 *    interactions between prescribed medicines. Uses a curated table
 *    of pairs (by active ingredient class) — extendable via DB later.
 *
 * 3. Dose-range check: simple pediatric/geriatric dose guard (placeholder
 *    — wire to a drug database for production).
 */

export interface IcdSuggestion {
    code: string;
    description: string;
    matchedKeywords: string[];
    confidence: number; // 0-1
}

/**
 * Keyword → ICD-10 code map (Indonesian clinical terms).
 * Covers the most common outpatient diagnoses. Extend as needed.
 */
const ICD10_KEYWORD_MAP: Array<{ code: string; description: string; keywords: string[] }> = [
    // Infectious
    { code: 'A09', description: 'Diare & gastroenteritis infeksius', keywords: ['diare', 'mencret', 'gastroenteritis', 'tinja encer'] },
    { code: 'J00', description: 'Nasofaringitis akut (pilek)', keywords: ['pilek', 'rhinitis', 'hidung tersumbat', 'nasofaringitis'] },
    { code: 'J06.9', description: 'Infeksi saluran napas atas akut', keywords: ['ispa', 'batuk pilek', 'saluran napas atas'] },
    { code: 'J03.9', description: 'Tonsilitis akut', keywords: ['tonsilitis', 'amandel', 'tenggorokan nyeri'] },
    { code: 'J20.9', description: 'Bronkitis akut', keywords: ['bronkitis', 'batuk berdahak akut'] },
    { code: 'J45.9', description: 'Asma bronkial', keywords: ['asma', 'bunyi napas', 'mengi', 'wheezing'] },
    { code: 'J11.9', description: 'Influenza', keywords: ['flu', 'influenza', 'demam flu'] },
    { code: 'A41.9', description: 'Sepsis', keywords: ['sepsis', 'syawal', 'infeksi sistemik'] },
    // Chronic
    { code: 'E11.9', description: 'Diabetes mellitus tipe 2', keywords: ['diabetes', 'diabet', 'kencing manis', 'gula darah tinggi', 'dm tipe 2', 'dm2'] },
    { code: 'E10.9', description: 'Diabetes mellitus tipe 1', keywords: ['diabetes tipe 1', 'dm tipe 1', 'dm1', 'insulin dependent'] },
    { code: 'I10', description: 'Hipertensi esensial', keywords: ['hipertensi', 'tekanan darah tinggi', 'darah tinggi', 'ht'] },
    { code: 'I20.9', description: 'Angina pektoris', keywords: ['angina', 'nyeri dada angina', 'ap'] },
    { code: 'I50.9', description: 'Gagal jantung', keywords: ['gagal jantung', 'jantung bengkak', 'chf', 'heart failure'] },
    { code: 'I63.9', description: 'Stroke', keywords: ['stroke', 'cerebrovascular', 'serebrovaskuler', 'cedera otak'] },
    // GI
    { code: 'K29.7', description: 'Gastritis', keywords: ['gastritis', 'maag', 'lambung', 'nyeri ulu hati', 'asam lambung'] },
    { code: 'K59.0', description: 'Konstipasi', keywords: ['konstipasi', 'sembelit', 'susah buang air'] },
    { code: 'K35.9', description: 'Apendisitis akut', keywords: ['apendisitis', 'usus buntu', 'appendicitis'] },
    // Derm
    { code: 'L20.9', description: 'Dermatitis atopik', keywords: ['dermatitis', 'eksim', 'biduran', 'gatal'] },
    { code: 'L40.9', description: 'Psoriasis', keywords: ['psoriasis'] },
    // Mental
    { code: 'F32.9', description: 'Depresi', keywords: ['depresi', 'tekanan batin', 'sedih berlebihan'] },
    { code: 'F41.1', description: 'Gangguan cemas', keywords: ['cemas', 'ansietas', 'gelisah'] },
    // Misc
    { code: 'M54.5', description: 'Nyeri punggung', keywords: ['nyeri punggung', 'sakit pinggang', 'low back pain', 'lumbago'] },
    { code: 'M25.5', description: 'Nyeri sendi', keywords: ['nyeri sendi', 'artralgia', 'sakit sendi'] },
    { code: 'R51', description: 'Sakit kepala', keywords: ['sakit kepala', 'kepala pusing', 'headache', 'cephalgia'] },
    { code: 'R10.4', description: 'Nyeri abdomen', keywords: ['nyeri perut', 'sakit perut', 'abdomen', 'perut melilit'] },
    { code: 'R50.9', description: 'Demam', keywords: ['demam', 'panas', 'febris', 'fever'] },
];

/**
 * Suggest ICD-10 codes based on free-text SOAP content.
 * Returns matches sorted by confidence (keyword hit count / total keywords).
 */
export function suggestIcd10(text: string): IcdSuggestion[] {
    const lower = text.toLowerCase();
    const suggestions: IcdSuggestion[] = [];

    for (const entry of ICD10_KEYWORD_MAP) {
        const matched: string[] = [];
        for (const kw of entry.keywords) {
            if (lower.includes(kw.toLowerCase())) {
                matched.push(kw);
            }
        }
        if (matched.length > 0) {
            suggestions.push({
                code: entry.code,
                description: entry.description,
                matchedKeywords: matched,
                confidence: Math.min(1, matched.length / entry.keywords.length + 0.2),
            });
        }
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

// ==========================================
// DRUG-DRUG INTERACTION CHECKER
// ==========================================

export interface DdiAlert {
    severity: 'contraindicated' | 'major' | 'moderate' | 'minor';
    drugA: string;
    drugB: string;
    description: string;
    recommendation: string;
}

/**
 * Curated drug-drug interaction table (by active ingredient / class name).
 * For production, replace with a DB-backed interaction table or call an
 * external API (e.g. RxNorm / DrugBank).
 */
const DDI_TABLE: Array<{
    triggerA: string[]; triggerB: string[];
    severity: DdiAlert['severity'];
    description: string; recommendation: string;
}> = [
    {
        triggerA: ['warfarin', 'aspirin', 'asam asetilsalisilat'],
        triggerB: ['ibuprofen', 'naproxen', 'diklofenak', 'ketorolak', 'meloksikam'],
        severity: 'major',
        description: 'Antikoagulan + NSAID meningkatkan risiko perdarahan GI.',
        recommendation: 'Pertimbangkan PPI pelindung lambung atau ganti NSAID dengan parasetamol.',
    },
    {
        triggerA: ['metformin'],
        triggerB: ['kontras media', 'cetrakat', 'ioheksol', 'iodixanol'],
        severity: 'major',
        description: 'Metformin + kontras media → risiko asidosis laktat (terutama bila eGFR turun).',
        recommendation: 'Hentikan metformin 48 jam sebelum & setelah pemberian kontras media.',
    },
    {
        triggerA: ['simvastatin', 'atorvastatin', 'lovastatin'],
        triggerB: ['klaritromisin', 'eritromisin', 'ketokonazol', 'itrakonazol'],
        severity: 'contraindicated',
        description: 'Penghambat CYP3A4 meningkatkan kadar statin → risiko miopati/rabdomiolisis.',
        recommendation: 'Hindari kombinasi; ganti antibiotik atau jeda statin selama terapi.',
    },
    {
        triggerA: ['ACE inhibitor', 'kaptopril', 'enalapril', 'lisinopril', 'valsartan', 'losartan'],
        triggerB: ['spironolakton', 'amilorid'],
        severity: 'major',
        description: 'ACEi/ARB + potassium-sparing diuretic → risiko hiperkalemia.',
        recommendation: 'Pantau kalium serum berkala; batasi dosis.',
    },
    {
        triggerA: ['parasetamol', 'asetaminofen'],
        triggerB: ['warfarin'],
        severity: 'moderate',
        description: 'Parasetamol dosis tinggi meningkatkan INR pada pemakai warfarin.',
        recommendation: 'Batasi parasetamol ≤2g/hari; pantau INR.',
    },
    {
        triggerA: ['klonidin'],
        triggerB: ['propranolol', 'atenolol', 'metoprolol'],
        severity: 'major',
        description: 'Beta-blocker + klonidin → risiko hipertensi rebound bila dihentikan mendadak.',
        recommendation: 'Hentikan klonidin perlahan sebelum beta-blocker.',
    },
    {
        triggerA: ['tramadol', 'kodein'],
        triggerB: ['fluoksetin', 'sertralin', 'paroksetin', 'escitalopram'],
        severity: 'major',
        description: 'Opioid + SSRI → risiko sindrom serotonin.',
        recommendation: 'Gunakan analgesik non-serotonergik; atau turunkan dosis.',
    },
];

/**
 * Check for drug-drug interactions among a list of prescribed medicines.
 * `medicineNames` should be lowercase nama_obat from the medicines table.
 */
export function checkDrugInteractions(medicineNames: string[]): DdiAlert[] {
    const alerts: DdiAlert[] = [];

    for (let i = 0; i < medicineNames.length; i++) {
        for (let j = i + 1; j < medicineNames.length; j++) {
            const a = medicineNames[i].toLowerCase();
            const b = medicineNames[j].toLowerCase();

            for (const rule of DDI_TABLE) {
                const aTriggersA = rule.triggerA.some(t => a.includes(t.toLowerCase()));
                const aTriggersB = rule.triggerB.some(t => a.includes(t.toLowerCase()));
                const bTriggersA = rule.triggerA.some(t => b.includes(t.toLowerCase()));
                const bTriggersB = rule.triggerB.some(t => b.includes(t.toLowerCase()));

                if ((aTriggersA && bTriggersB) || (aTriggersB && bTriggersA)) {
                    alerts.push({
                        severity: rule.severity,
                        drugA: medicineNames[i],
                        drugB: medicineNames[j],
                        description: rule.description,
                        recommendation: rule.recommendation,
                    });
                }
            }
        }
    }

    return alerts;
}

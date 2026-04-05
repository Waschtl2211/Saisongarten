import { findPflanze } from '../data/plantDatabase.js';

const MONATE = {
  Jan: 1, Feb: 2, 'Mär': 3, Apr: 4, Mai: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Okt: 10, Nov: 11, Dez: 12,
};

/**
 * Parst "Aug–Okt" → ["2026-08","2026-09","2026-10"].
 * Unterstützt jahresübergreifende Bereiche wie "Nov–Jan".
 */
export function parseErntbarIm(ernteText, jahr) {
  if (!ernteText) return [];
  const text = ernteText.trim();
  const rangeMatch = text.match(/([A-Za-zÄÖÜäöüß]+)\s*[–-]\s*([A-Za-zÄÖÜäöüß]+)/);
  if (rangeMatch) {
    const start = MONATE[rangeMatch[1]];
    const end = MONATE[rangeMatch[2]];
    if (!start || !end) return [];
    const result = [];
    if (start <= end) {
      for (let m = start; m <= end; m++)
        result.push(`${jahr}-${String(m).padStart(2, '0')}`);
    } else {
      for (let m = start; m <= 12; m++)
        result.push(`${jahr}-${String(m).padStart(2, '0')}`);
      for (let m = 1; m <= end; m++)
        result.push(`${jahr + 1}-${String(m).padStart(2, '0')}`);
    }
    return result;
  }
  const single = MONATE[text];
  if (single) return [`${jahr}-${String(single).padStart(2, '0')}`];
  return [];
}

/**
 * Sicherer Name-Accessor: funktioniert für string und PlantEntry.
 */
export function pflanzeName(p) {
  return typeof p === 'string' ? p : p.name;
}

/**
 * Migriert pflanzen: string[] → pflanzen: PlantEntry[] in allen Beeten.
 * Idempotent: bereits migrierte Beete werden übersprungen.
 */
export function migratePflanzenZuObjekte(beete) {
  return beete.map(beet => {
    const pfl = beet.pflanzen;
    if (!pfl || pfl.length === 0) return beet;
    if (typeof pfl[0] !== 'string') return beet; // bereits migriert
    const jahr = beet.gepflanzt ? new Date(beet.gepflanzt).getFullYear() : new Date().getFullYear();
    const migrated = pfl.map((name, idx) => {
      const db = findPflanze(name);
      const ernte = db?.ernteBeschreibung || '';
      return {
        id: `${name.toLowerCase().replace(/\s+/g, '_')}_${idx}`,
        name,
        icon: db?.icon || '🌱',
        gepflanzt: beet.gepflanzt || '',
        faellig: beet.faellig || '',
        ernte,
        erntbarIm: parseErntbarIm(ernte, jahr),
        giessIntervall: db?.giessIntervall ?? 3,
        giessIntensitaet: db?.giessIntensität || 'mittel',
        naechsteKultur: db?.naechsteKultur || '',
        hinweis: db?.hinweis || '',
      };
    });
    return { ...beet, pflanzen: migrated };
  });
}

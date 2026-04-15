import { describe, expect, it } from 'vitest';
import { pflanzDatenbank, findPflanze, computeErntbarIm, getNeighborRelation } from './plantDatabase.js';

// ── Data integrity ────────────────────────────────────────────────────────────

describe('pflanzDatenbank – data integrity', () => {
  it('contains at least one plant', () => {
    expect(pflanzDatenbank.length).toBeGreaterThan(0);
  });

  it('has no duplicate plant names', () => {
    const names = pflanzDatenbank.map(p => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('every plant has all required fields', () => {
    for (const p of pflanzDatenbank) {
      expect(p.name, `${p.name}: name`).toBeTruthy();
      expect(p.icon, `${p.name}: icon`).toBeTruthy();
      expect(Array.isArray(p.pflanzMonate), `${p.name}: pflanzMonate`).toBe(true);
      expect(typeof p.ernteanfangOffset, `${p.name}: ernteanfangOffset`).toBe('number');
      expect(typeof p.erntedauer, `${p.name}: erntedauer`).toBe('number');
      expect(Array.isArray(p.gut), `${p.name}: gut`).toBe(true);
      expect(Array.isArray(p.schlecht), `${p.name}: schlecht`).toBe(true);
    }
  });

  it('pflanzMonate values are between 1 and 12', () => {
    for (const p of pflanzDatenbank) {
      for (const m of p.pflanzMonate) {
        expect(m, `${p.name}: month ${m}`).toBeGreaterThanOrEqual(1);
        expect(m, `${p.name}: month ${m}`).toBeLessThanOrEqual(12);
      }
    }
  });

  it('ernteanfangOffset is non-negative', () => {
    for (const p of pflanzDatenbank) {
      expect(p.ernteanfangOffset, `${p.name}: ernteanfangOffset`).toBeGreaterThanOrEqual(0);
    }
  });

  it('erntedauer is at least 1', () => {
    for (const p of pflanzDatenbank) {
      expect(p.erntedauer, `${p.name}: erntedauer`).toBeGreaterThanOrEqual(1);
    }
  });

  it('giessIntervall is a positive integer where defined', () => {
    for (const p of pflanzDatenbank) {
      if (p.giessIntervall !== undefined) {
        expect(Number.isInteger(p.giessIntervall), `${p.name}: giessIntervall must be integer`).toBe(true);
        expect(p.giessIntervall, `${p.name}: giessIntervall`).toBeGreaterThan(0);
      }
    }
  });
});

// ── findPflanze ───────────────────────────────────────────────────────────────

describe('findPflanze', () => {
  it('finds a plant by its canonical name', () => {
    expect(findPflanze('Tomaten')?.name).toBe('Tomaten');
  });

  it('finds by canonical name case-insensitively', () => {
    expect(findPflanze('tomaten')?.name).toBe('Tomaten');
    expect(findPflanze('TOMATEN')?.name).toBe('Tomaten');
  });

  it('finds by exact alias', () => {
    expect(findPflanze('tomate')?.name).toBe('Tomaten');
  });

  it('finds when alias is a substring of the query (lc.includes(a))', () => {
    // 'cherry tomate' contains alias 'cherry'
    expect(findPflanze('cherry tomate')?.name).toBe('Tomaten');
  });

  it('finds when query is a substring of an alias (a.includes(lc))', () => {
    // alias 'cherry tomate' contains 'cherry'
    expect(findPflanze('cherry')?.name).toBe('Tomaten');
  });

  it('returns null for a completely unknown name', () => {
    expect(findPflanze('XYZ_UNBEKANNTE_PFLANZE_123')).toBeNull();
  });

  it('finds Karotten by German umlaut alias', () => {
    expect(findPflanze('möhre')?.name).toBe('Karotten');
  });

  it('finds Feldsalat by alias', () => {
    expect(findPflanze('rapunzel')?.name).toBe('Feldsalat');
  });

  it('returned object has the required shape', () => {
    const p = findPflanze('Tomaten');
    expect(p).not.toBeNull();
    expect(p).toHaveProperty('name');
    expect(p).toHaveProperty('icon');
    expect(p).toHaveProperty('pflanzMonate');
    expect(p).toHaveProperty('ernteanfangOffset');
    expect(p).toHaveProperty('erntedauer');
    expect(p).toHaveProperty('gut');
    expect(p).toHaveProperty('schlecht');
  });

  it('empty string returns first aliased plant (documents known behaviour)', () => {
    // a.includes('') is always true, so the first plant with aliases is returned
    // This is a known quirk of the fuzzy-match logic.
    const result = findPflanze('');
    expect(result).not.toBeNull();
  });
});

// ── computeErntbarIm ──────────────────────────────────────────────────────────

describe('computeErntbarIm', () => {
  it('computes the correct harvest months for Tomaten planted in May', () => {
    // Tomaten: ernteanfangOffset 3, erntedauer 3
    // Planted 2026-05-01 → harvest: 2026-08, 2026-09, 2026-10
    expect(computeErntbarIm('2026-05-01', ['Tomaten'])).toEqual(['2026-08', '2026-09', '2026-10']);
  });

  it('handles year-spanning harvest (Feldsalat planted in September)', () => {
    // Feldsalat: ernteanfangOffset 2, erntedauer 4
    // Planted 2026-09-01 → harvest: 2026-11, 2026-12, 2027-01, 2027-02
    const result = computeErntbarIm('2026-09-01', ['Feldsalat']);
    expect(result).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
  });

  it('returns empty array for an unknown plant name', () => {
    expect(computeErntbarIm('2026-05-01', ['UNBEKANNT'])).toEqual([]);
  });

  it('returns empty array for an empty plant list', () => {
    expect(computeErntbarIm('2026-05-01', [])).toEqual([]);
  });

  it('deduplicates overlapping harvest months from multiple plants', () => {
    // Tomaten and Paprika both have offset 3 and duration 3 planted in May
    const result = computeErntbarIm('2026-05-01', ['Tomaten', 'Paprika']);
    expect(new Set(result).size).toBe(result.length);
  });

  it('returns months in ascending sort order', () => {
    const result = computeErntbarIm('2026-03-01', ['Tomaten', 'Zucchini']);
    expect(result).toEqual([...result].sort());
  });

  it('skips unknown plants but still processes known ones', () => {
    const withUnknown = computeErntbarIm('2026-05-01', ['Tomaten', 'UNBEKANNT']);
    const withoutUnknown = computeErntbarIm('2026-05-01', ['Tomaten']);
    expect(withUnknown).toEqual(withoutUnknown);
  });
});

// ── getNeighborRelation ───────────────────────────────────────────────────────

describe('getNeighborRelation', () => {
  it('returns neutral when the plant is alone in the bed', () => {
    const result = getNeighborRelation('Tomaten', ['Tomaten']);
    expect(result).toEqual({ relation: 'neutral', gutMit: [], schlechtMit: [] });
  });

  it('returns gut for a known good pair: Tomaten + Basilikum', () => {
    const result = getNeighborRelation('Tomaten', ['Tomaten', 'Basilikum']);
    expect(result.relation).toBe('gut');
    expect(result.gutMit).toContain('Basilikum');
    expect(result.schlechtMit).toEqual([]);
  });

  it('returns schlecht for a known bad pair: Tomaten + Fenchel', () => {
    const result = getNeighborRelation('Tomaten', ['Tomaten', 'Fenchel']);
    expect(result.relation).toBe('schlecht');
    expect(result.schlechtMit).toContain('Fenchel');
  });

  it('is bidirectional: Fenchel + Tomaten is also schlecht', () => {
    const result = getNeighborRelation('Fenchel', ['Fenchel', 'Tomaten']);
    expect(result.relation).toBe('schlecht');
    expect(result.schlechtMit).toContain('Tomaten');
  });

  it('schlecht takes precedence over gut when both are present', () => {
    const result = getNeighborRelation('Tomaten', ['Tomaten', 'Basilikum', 'Fenchel']);
    expect(result.relation).toBe('schlecht');
    expect(result.gutMit).toContain('Basilikum');
    expect(result.schlechtMit).toContain('Fenchel');
  });

  it('returns neutral for an unknown plant name', () => {
    const result = getNeighborRelation('UNBEKANNT', ['UNBEKANNT', 'Tomaten']);
    expect(result).toEqual({ relation: 'neutral', gutMit: [], schlechtMit: [] });
  });

  it('has the correct shape { relation, gutMit, schlechtMit }', () => {
    const result = getNeighborRelation('Tomaten', ['Tomaten']);
    expect(result).toHaveProperty('relation');
    expect(result).toHaveProperty('gutMit');
    expect(result).toHaveProperty('schlechtMit');
    expect(Array.isArray(result.gutMit)).toBe(true);
    expect(Array.isArray(result.schlechtMit)).toBe(true);
  });
});

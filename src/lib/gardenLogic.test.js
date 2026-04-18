import { describe, expect, it } from 'vitest';
import {
  getWetterFuerTag,
  berechneGiessIntervall,
  berechneRegenCredits,
  brauchtGiessen,
  brauchtDuengen,
} from './gardenLogic.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeWetter(overrides = {}) {
  const base = {
    daily: {
      time: [],
      temperature_2m_max: [],
      temperature_2m_min: [],
      precipitation_sum: [],
      precipitation_probability_max: [],
    },
  };
  if (overrides.entries) {
    for (const e of overrides.entries) {
      base.daily.time.push(e.date);
      base.daily.temperature_2m_max.push(e.maxTemp ?? 20);
      base.daily.temperature_2m_min.push(e.minTemp ?? 10);
      base.daily.precipitation_sum.push(e.rain ?? 0);
      base.daily.precipitation_probability_max.push(e.rainProb ?? 0);
    }
  }
  return base;
}

const pastDate = new Date('2024-06-01');
const futureDate = new Date('2099-06-01');

// ── getWetterFuerTag ──────────────────────────────────────────────────────────

describe('getWetterFuerTag', () => {
  it('returns null for null wetterDaten', () => {
    expect(getWetterFuerTag(pastDate, null)).toBeNull();
  });

  it('returns null for missing date in wetterDaten', () => {
    const w = makeWetter({ entries: [{ date: '2024-06-02', maxTemp: 22 }] });
    expect(getWetterFuerTag(pastDate, w)).toBeNull();
  });

  it('returns correct values for a known date', () => {
    const w = makeWetter({ entries: [{ date: '2024-06-01', maxTemp: 25, minTemp: 15, rain: 3, rainProb: 20 }] });
    const result = getWetterFuerTag(pastDate, w);
    expect(result.maxTemp).toBe(25);
    expect(result.minTemp).toBe(15);
    expect(result.precipitation).toBe(3);
    expect(result.precipProb).toBe(20);
  });

  it('sets isForecast=false for past dates', () => {
    const w = makeWetter({ entries: [{ date: '2024-06-01' }] });
    expect(getWetterFuerTag(pastDate, w).isForecast).toBe(false);
  });

  it('sets isForecast=true for future dates', () => {
    const dateStr = '2099-06-01';
    const w = makeWetter({ entries: [{ date: dateStr }] });
    expect(getWetterFuerTag(futureDate, w).isForecast).toBe(true);
  });
});

// ── berechneGiessIntervall ────────────────────────────────────────────────────

describe('berechneGiessIntervall', () => {
  it('returns 3 for empty plant list', () => {
    expect(berechneGiessIntervall([])).toBe(3);
  });

  it('returns minimum interval across multiple plants', () => {
    // Tomaten=2, Kürbis=4 → minimum is 2
    expect(berechneGiessIntervall(['Tomaten', 'Kürbis'])).toBe(2);
  });

  it('returns 3 for unknown plants', () => {
    expect(berechneGiessIntervall(['Unbekannt'])).toBe(3);
  });
});

// ── berechneRegenCredits ──────────────────────────────────────────────────────

describe('berechneRegenCredits', () => {
  it('returns 0 for null wetterDaten', () => {
    expect(berechneRegenCredits(new Date('2024-06-01'), new Date('2024-06-05'), null)).toBe(0);
  });

  it('returns 1 credit for a day with ≥15mm rain', () => {
    const von = new Date('2024-06-01');
    const bis = new Date('2024-06-02');
    const w = makeWetter({ entries: [{ date: '2024-06-01', rain: 15 }] });
    expect(berechneRegenCredits(von, bis, w)).toBe(1);
  });

  it('returns 0.5 credit for a day with ≥5mm but <15mm rain', () => {
    const von = new Date('2024-06-01');
    const bis = new Date('2024-06-02');
    const w = makeWetter({ entries: [{ date: '2024-06-01', rain: 5 }] });
    expect(berechneRegenCredits(von, bis, w)).toBe(0.5);
  });

  it('returns 0 for a day with <5mm rain', () => {
    const von = new Date('2024-06-01');
    const bis = new Date('2024-06-02');
    const w = makeWetter({ entries: [{ date: '2024-06-01', rain: 3 }] });
    expect(berechneRegenCredits(von, bis, w)).toBe(0);
  });

  it('does not count forecast days', () => {
    const von = futureDate;
    const bis = new Date('2099-06-02');
    const w = makeWetter({ entries: [{ date: '2099-06-01', rain: 20 }] });
    expect(berechneRegenCredits(von, bis, w)).toBe(0);
  });

  it('accumulates credits over multiple days', () => {
    const von = new Date('2024-06-01');
    const bis = new Date('2024-06-04');
    const w = makeWetter({
      entries: [
        { date: '2024-06-01', rain: 15 },
        { date: '2024-06-02', rain: 7 },
        { date: '2024-06-03', rain: 2 },
      ],
    });
    expect(berechneRegenCredits(von, bis, w)).toBe(1.5);
  });
});

// ── brauchtGiessen ────────────────────────────────────────────────────────────

describe('brauchtGiessen', () => {
  const gepflanzt = '2024-06-01';
  const baseBeet = { beet: 1, pflanzen: ['Tomaten'], gepflanzt };

  it('returns noetig:false for empty pflanzen list', () => {
    const result = brauchtGiessen({ ...baseBeet, pflanzen: [] }, new Date('2024-06-05'), {}, null);
    expect(result.noetig).toBe(false);
  });

  it('returns nochNichtGepflanzt for date before planting', () => {
    const result = brauchtGiessen(baseBeet, new Date('2024-05-31'), {}, null);
    expect(result.nochNichtGepflanzt).toBe(true);
    expect(result.noetig).toBe(false);
  });

  it('returns noetig:true when interval exceeded with no rain', () => {
    // Tomaten: interval=2, planted 2024-06-01, check on 2024-06-04 = 3 days later
    const result = brauchtGiessen(baseBeet, new Date('2024-06-04'), {}, null);
    expect(result.noetig).toBe(true);
  });

  it('returns noetig:false when interval not reached', () => {
    const giessenLog = { 1: ['2024-06-04'] };
    // last watered 2024-06-04, checking 2024-06-05 = 1 day, interval=2
    const result = brauchtGiessen(baseBeet, new Date('2024-06-05'), giessenLog, null);
    expect(result.noetig).toBe(false);
  });

  it('rain credits reduce the effective days needing watering', () => {
    // planted 2024-06-01, check 2024-06-04 (3 raw days), 15mm rain on 06-01 = 1 credit → 2 effective days = interval
    const w = makeWetter({ entries: [{ date: '2024-06-01', rain: 15 }, { date: '2024-06-02', rain: 0 }, { date: '2024-06-03', rain: 0 }] });
    const result = brauchtGiessen(baseBeet, new Date('2024-06-04'), {}, w);
    // 3 raw - 1 rain credit = 2 effective = interval → noetig:true (≥)
    expect(result.regenCredits).toBe(1);
    expect(result.noetig).toBe(true);
  });
});

// ── brauchtDuengen ────────────────────────────────────────────────────────────

describe('brauchtDuengen', () => {
  const gepflanzt = '2024-06-01';
  const baseBeet = { beet: 1, pflanzen: ['Tomaten'], gepflanzt };

  it('returns noetig:false for empty pflanzen list', () => {
    const result = brauchtDuengen({ ...baseBeet, pflanzen: [] }, new Date('2024-06-20'), {});
    expect(result.noetig).toBe(false);
  });

  it('returns noetig:false for plants without duenger.intervallWochen', () => {
    // Use a plant without a duenger field (if any) or override
    // Feldsalat has no duenger field based on the database
    const result = brauchtDuengen({ ...baseBeet, pflanzen: ['Feldsalat'] }, new Date('2024-06-20'), {});
    expect(result.noetig).toBe(false);
  });

  it('returns noetig:false if not yet planted', () => {
    const result = brauchtDuengen(baseBeet, new Date('2024-05-31'), {});
    expect(result.noetig).toBe(false);
    expect(result.nochNichtGepflanzt).toBe(true);
  });

  it('returns noetig:true when never fertilized', () => {
    // Tomaten has intervallWochen:3
    const result = brauchtDuengen(baseBeet, new Date('2024-06-20'), {});
    expect(result.noetig).toBe(true);
    expect(result.letztesDuengen).toBeNull();
  });

  it('returns noetig:false when recently fertilized', () => {
    const duengenLog = { 1: ['2024-06-18'] };
    // fertilized 2024-06-18, checking 2024-06-19 → only 1 day, interval=21
    const result = brauchtDuengen(baseBeet, new Date('2024-06-19'), duengenLog);
    expect(result.noetig).toBe(false);
  });

  it('returns noetig:true when interval exceeded', () => {
    const duengenLog = { 1: ['2024-05-01'] };
    // fertilized 2024-05-01, checking 2024-06-20 → 50 days > 21 days (3 weeks)
    const result = brauchtDuengen(baseBeet, new Date('2024-06-20'), duengenLog);
    expect(result.noetig).toBe(true);
    expect(result.tageSeit).toBeGreaterThanOrEqual(21);
  });
});

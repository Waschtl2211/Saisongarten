import { describe, it, expect } from 'vitest';
import { parseErntbarIm, migratePflanzenZuObjekte, pflanzeName } from './plantMigration.js';

describe('parseErntbarIm', () => {
  it('parst einen normalen Monatsbereich', () => {
    expect(parseErntbarIm('Aug–Okt', 2026)).toEqual(['2026-08', '2026-09', '2026-10']);
  });

  it('parst einen einzelnen Monat', () => {
    expect(parseErntbarIm('Jun', 2026)).toEqual(['2026-06']);
  });

  it('parst einen jahresübergreifenden Bereich', () => {
    expect(parseErntbarIm('Nov–Jan', 2026)).toEqual(['2026-11', '2026-12', '2027-01']);
  });

  it('gibt [] zurück bei leerem String', () => {
    expect(parseErntbarIm('', 2026)).toEqual([]);
  });

  it('gibt [] zurück bei unbekanntem Monat', () => {
    expect(parseErntbarIm('k.A.', 2026)).toEqual([]);
  });

  it('parst Mai–Jul korrekt', () => {
    expect(parseErntbarIm('Mai–Jul', 2026)).toEqual(['2026-05', '2026-06', '2026-07']);
  });
});

describe('pflanzeName', () => {
  it('gibt String direkt zurück', () => {
    expect(pflanzeName('Tomaten')).toBe('Tomaten');
  });

  it('gibt .name aus PlantEntry zurück', () => {
    expect(pflanzeName({ name: 'Basilikum', icon: '🌿' })).toBe('Basilikum');
  });
});

describe('migratePflanzenZuObjekte', () => {
  it('gibt Beete mit PlantEntry-Arrays zurück', () => {
    const beete = [{
      beet: 1,
      pflanzen: ['Tomaten'],
      gepflanzt: '2026-04-19',
      faellig: '2026-10-31',
    }];
    const result = migratePflanzenZuObjekte(beete);
    expect(typeof result[0].pflanzen[0]).toBe('object');
    expect(result[0].pflanzen[0].name).toBe('Tomaten');
    expect(result[0].pflanzen[0].gepflanzt).toBe('2026-04-19');
  });

  it('lässt bereits migrierte Beete unverändert', () => {
    const beete = [{
      beet: 1,
      pflanzen: [{ name: 'Tomaten', icon: '🍅', gepflanzt: '2026-04-19', faellig: '2026-10-31', ernte: 'Aug–Okt', erntbarIm: [], giessIntervall: 2, giessIntensitaet: 'hoch', naechsteKultur: '', hinweis: '' }],
      gepflanzt: '2026-04-19',
      faellig: '2026-10-31',
    }];
    const result = migratePflanzenZuObjekte(beete);
    expect(result[0].pflanzen[0]).toEqual(beete[0].pflanzen[0]);
  });

  it('setzt sinnvolle Defaults für unbekannte Pflanzen', () => {
    const beete = [{ beet: 1, pflanzen: ['XYZ-Unbekannt'], gepflanzt: '2026-04-19', faellig: '2026-10-31' }];
    const result = migratePflanzenZuObjekte(beete);
    const entry = result[0].pflanzen[0];
    expect(entry.giessIntervall).toBe(3);
    expect(entry.giessIntensitaet).toBe('mittel');
    expect(entry.icon).toBe('🌱');
  });

  it('überspringt Beete mit leerer pflanzen-Liste', () => {
    const beete = [{ beet: 2, pflanzen: [], gepflanzt: '2026-09-01', faellig: '2026-09-01' }];
    const result = migratePflanzenZuObjekte(beete);
    expect(result[0].pflanzen).toEqual([]);
  });
});

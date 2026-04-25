import { format, parseISO, differenceInDays } from 'date-fns';
import { findPflanze } from '../data/plantDatabase.js';

export function getWetterFuerTag(date, wetterDaten) {
  if (!wetterDaten?.daily) return null;
  const dateStr = format(date, 'yyyy-MM-dd');
  const idx = wetterDaten.daily.time.indexOf(dateStr);
  if (idx === -1) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  return {
    maxTemp: wetterDaten.daily.temperature_2m_max[idx],
    minTemp: wetterDaten.daily.temperature_2m_min[idx],
    precipitation: wetterDaten.daily.precipitation_sum[idx] ?? 0,
    precipProb: wetterDaten.daily.precipitation_probability_max[idx] ?? 0,
    isForecast: d > now,
  };
}

export function berechneGiessIntervall(pflanzen) {
  const intervalle = pflanzen.map(p => findPflanze(p)?.giessIntervall ?? null).filter(v => v !== null);
  return intervalle.length ? Math.min(...intervalle) : 3;
}

export function berechneRegenCredits(vonDatum, bisDatum, wetterDaten) {
  if (!wetterDaten?.daily) return 0;
  let credits = 0;
  const current = new Date(vonDatum); current.setHours(0, 0, 0, 0);
  const end = new Date(bisDatum); end.setHours(0, 0, 0, 0);
  while (current < end) {
    const w = getWetterFuerTag(current, wetterDaten);
    if (w && !w.isForecast) {
      if (w.precipitation >= 15) credits += 1;
      else if (w.precipitation >= 5) credits += 0.5;
    }
    current.setDate(current.getDate() + 1);
  }
  return credits;
}

export function brauchtGiessen(beet, date, giessenLog, wetterDaten) {
  const allePflanzen = beet.pflanzen?.length
    ? beet.pflanzen
    : (beet.reihen?.flatMap(r => r.kulturen || []) ?? []);
  if (!allePflanzen.length) return { noetig: false };
  const dateCopy = new Date(date); dateCopy.setHours(0, 0, 0, 0);
  const gepflanzt = parseISO(beet.gepflanzt);
  gepflanzt.setHours(0, 0, 0, 0);
  if (dateCopy < gepflanzt) return { noetig: false, nochNichtGepflanzt: true, grund: 'Noch nicht gepflanzt' };

  const log = (giessenLog[beet.beet] || [])
    .map(d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; })
    .filter(d => d <= dateCopy)
    .sort((a, b) => b - a);

  const letzteGiessung = log[0] || null;
  const basisIntervall = berechneGiessIntervall(allePflanzen);

  if (!letzteGiessung) {
    const rawDays = differenceInDays(dateCopy, gepflanzt);
    const regenCredits = berechneRegenCredits(gepflanzt, dateCopy, wetterDaten);
    const effektiveTage = Math.max(0, rawDays - regenCredits);
    return {
      noetig: effektiveTage >= basisIntervall,
      tageSeit: rawDays,
      regenCredits: Math.round(regenCredits * 10) / 10,
      effektiveTage: Math.round(effektiveTage * 10) / 10,
      intervall: basisIntervall,
      letzteGiessung: null,
      grund: effektiveTage >= basisIntervall
        ? 'Noch nie gegossen'
        : `${Math.round(effektiveTage)} von ${basisIntervall} Tagen`,
    };
  }

  const rawDays = differenceInDays(dateCopy, letzteGiessung);
  const regenCredits = berechneRegenCredits(letzteGiessung, dateCopy, wetterDaten);
  const effektiveTage = Math.max(0, rawDays - regenCredits);

  let intervall = basisIntervall;
  const wetter = getWetterFuerTag(dateCopy, wetterDaten);
  if (wetter?.maxTemp >= 28) intervall = Math.max(1, intervall - 1);

  const noetig = effektiveTage >= intervall;
  const naechstesGiessen = new Date(letzteGiessung);
  naechstesGiessen.setDate(naechstesGiessen.getDate() + intervall);

  return {
    noetig,
    tageSeit: rawDays,
    regenCredits: Math.round(regenCredits * 10) / 10,
    effektiveTage: Math.round(effektiveTage * 10) / 10,
    intervall,
    letzteGiessung,
    naechstesGiessen,
    grund: noetig
      ? `Seit ${rawDays} Tagen nicht gegossen`
      : `Nächstes Gießen: ${format(naechstesGiessen, 'dd.MM.')}`,
  };
}

export function brauchtDuengen(beet, date, duengenLog) {
  const allePflanzen = beet.pflanzen?.length
    ? beet.pflanzen
    : (beet.reihen?.flatMap(r => r.kulturen || []) ?? []);
  if (!allePflanzen.length) return { noetig: false };
  if (parseISO(beet.gepflanzt) > date) return { noetig: false, nochNichtGepflanzt: true };

  const relevanteIntervalle = allePflanzen.map(p => {
    const info = findPflanze(p);
    return info?.duenger?.intervallWochen ?? null;
  }).filter(v => v !== null);

  if (relevanteIntervalle.length === 0) return { noetig: false };

  const intervallTage = Math.min(...relevanteIntervalle) * 7;

  const log = (duengenLog[beet.beet] || [])
    .map(d => parseISO(d))
    .filter(d => !isNaN(d))
    .sort((a, b) => b - a);

  const letztesDuengen = log[0] || null;

  if (!letztesDuengen) {
    return {
      noetig: true,
      letztesDuengen: null,
      naechstesDuengen: null,
      tageSeit: null,
      intervall: intervallTage,
      grund: 'Noch nicht gedüngt',
    };
  }

  const tageSeit = differenceInDays(date, letztesDuengen);
  const naechstesDuengen = new Date(letztesDuengen);
  naechstesDuengen.setDate(naechstesDuengen.getDate() + intervallTage);

  return {
    noetig: tageSeit >= intervallTage,
    letztesDuengen,
    naechstesDuengen,
    tageSeit,
    intervall: intervallTage,
    grund: tageSeit >= intervallTage
      ? `Seit ${tageSeit} Tagen nicht gedüngt (Intervall: ${intervallTage} Tage)`
      : `Nächstes Düngen: ${format(naechstesDuengen, 'dd.MM.')}`,
  };
}

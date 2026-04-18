import React, { useState, useEffect, useMemo, useRef } from 'react';
import { gardenData as initialGardenData, GARDEN_DATA_VERSION } from './data/gardenData';
import { pflanzDatenbank, findPflanze, getNeighborRelation, computeErntbarIm } from './data/plantDatabase';
import { format, parseISO, differenceInDays, addMonths } from 'date-fns';
const DE_MONATE = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
const DE_MONATE_LANG = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
function deMonat(date) { return `${DE_MONATE[date.getMonth()]} ${date.getFullYear()}`; }
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Chatbot from './components/Chatbot';
import { lsGet, lsSet, exportProfileData, importProfileData } from './lib/storage.js';
import { getWetterFuerTag, berechneGiessIntervall, berechneRegenCredits, brauchtGiessen, brauchtDuengen } from './lib/gardenLogic.js';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { migratePflanzenZuObjekte, pflanzeName } from './lib/plantMigration.js';
import PflanzenGrid from './components/PflanzenGrid.jsx';
import PflanzeEditDialog from './components/PflanzeEditDialog.jsx';


// Anbaubeginn
const ANBAU_START = new Date('2026-04-19');
// Aktuelles Datum dynamisch
const today = new Date();

function SortableBeetSlot({ id, children, kartenLayout }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group ${
        kartenLayout === 'list' ? 'w-full' :
        kartenLayout === 'grid' ? 'w-auto min-w-0' :
        'w-72 flex-none snap-start'
      }`}
      {...attributes}
    >
      {children(listeners)}
    </div>
  );
}

// Status-Priorität für Sortierung (0 = höchste Priorität)
function getStatusPrio(beet, selectedDate) {
  const faelligTage = differenceInDays(parseISO(beet.faellig), selectedDate);
  if (faelligTage >= 0 && faelligTage <= 14) return 0;
  if (beet.erntbarIm.includes(format(selectedDate, 'yyyy-MM'))) return 1;
  if (parseISO(beet.gepflanzt) <= selectedDate) return 2;
  return 3;
}

// Hilfsfunktion für Status-Badge
function getStatusBadge(beet, selectedDate) {
  const faelligTage = differenceInDays(parseISO(beet.faellig), selectedDate);
  if (faelligTage <= 14 && faelligTage >= 0) {
    return <span className="ml-2 inline-block px-2 py-0.5 rounded bg-red-600 text-white text-xs">Fällig am {format(parseISO(beet.faellig), 'dd.MM.')}</span>;
  }
  if (beet.erntbarIm.includes(format(selectedDate, 'yyyy-MM'))) {
    return <span className="ml-2 inline-block px-2 py-0.5 rounded bg-green-600 text-white text-xs">Ernte</span>;
  }
  if (parseISO(beet.gepflanzt) <= selectedDate) {
    return <span className="ml-2 inline-block px-2 py-0.5 rounded bg-gray-300 text-gray-800 text-xs">Gepflanzt</span>;
  }
  return null;
}

function getStatusSnapshot(beet, selectedDate) {
  const faelligTage = differenceInDays(parseISO(beet.faellig), selectedDate);
  if (faelligTage <= 14 && faelligTage >= 0) {
    return {
      typ: 'faellig',
      text: `Fällig am ${format(parseISO(beet.faellig), 'dd.MM.')}`,
    };
  }
  if (beet.erntbarIm.includes(format(selectedDate, 'yyyy-MM'))) {
    return { typ: 'ernte', text: 'Ernte' };
  }
  if (parseISO(beet.gepflanzt) <= selectedDate) {
    return { typ: 'gepflanzt', text: 'Gepflanzt' };
  }
  return { typ: 'geplant', text: 'Geplant' };
}

function getFrozenStatusBadge(snapshot) {
  if (!snapshot) return null;
  const classesByType = {
    faellig: 'bg-red-600 text-white',
    ernte: 'bg-green-600 text-white',
    gepflanzt: 'bg-gray-300 text-gray-800',
    geplant: 'bg-blue-200 text-blue-900',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs ${classesByType[snapshot.typ] || classesByType.geplant}`}>
      {snapshot.text}
    </span>
  );
}

const WDAY_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const STAEDTE = [
  { name: 'Wien',      lat: 48.2083, lon: 16.3731 },
  { name: 'München',   lat: 48.1374, lon: 11.5755 },
  { name: 'Berlin',    lat: 52.5200, lon: 13.4050 },
  { name: 'Frankfurt', lat: 50.1109, lon: 8.6821  },
  { name: 'Stuttgart', lat: 48.7758, lon: 9.1829  },
  { name: 'Zürich',    lat: 47.3769, lon: 8.5417  },
  { name: 'Hamburg',   lat: 53.5753, lon: 10.0153 },
  { name: 'Köln',      lat: 50.9333, lon: 6.9500  },
  { name: 'Graz',      lat: 47.0707, lon: 15.4395 },
  { name: 'Salzburg',  lat: 47.8095, lon: 13.0550 },
];

function fetchWetter(lat, lon, onData, onLaden, onFehler) {
  onLaden(true);
  fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&hourly=temperature_2m,precipitation,weathercode&timezone=Europe%2FBerlin&past_days=14&forecast_days=7`
  )
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(data => { onData(data); onLaden(false); })
    .catch(() => { onFehler('Wetter konnte nicht geladen werden'); onLaden(false); });
}

function ReihenAnzeige({ beet }) {
  const reihen = beet.reihen;
  // Kein reihen-Feld → Fallback auf PflanzenBadges
  if (!reihen || reihen.length === 0) return <PflanzenBadges pflanzen={beet.pflanzen} />;
  return (
    <div className="mt-1 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {reihen.map((r, i) => {
        const isLast = i === reihen.length - 1;
        const borderClass = isLast ? '' : 'border-b border-gray-200 dark:border-gray-700';
        if (r.aussaat) {
          return (
            <div key={i} className={`flex items-start gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 ${borderClass}`}>
              <span className="shrink-0 mt-0.5 text-xs font-bold bg-amber-400 dark:bg-amber-600 text-white rounded-full w-5 h-5 flex items-center justify-center">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">🌱 Aussaat</span>
                  {r.kulturen?.length > 0 && (
                    <span className="text-xs text-gray-700 dark:text-gray-200">{r.kulturen.join(' · ')}</span>
                  )}
                </div>
                {r.hinweis && (
                  <div className="text-xs text-amber-600 dark:text-amber-400 italic mt-0.5">{r.hinweis}</div>
                )}
              </div>
            </div>
          );
        }
        if (r.abstand) {
          return (
            <div key={i} className={`flex items-start gap-2 px-3 py-2 ${borderClass}`}>
              <span className="shrink-0 mt-0.5 text-xs font-bold bg-blue-500 dark:bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="shrink-0 text-xs font-mono font-semibold text-blue-700 dark:text-blue-300">{r.abstand} cm Abstand</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {r.kulturen.map(k => (
                    <span key={k} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded px-1.5 py-0.5">{k}</span>
                  ))}
                </div>
              </div>
            </div>
          );
        }
        if (r.hinweis) {
          return (
            <div key={i} className={`px-3 py-2 text-xs text-gray-500 dark:text-gray-400 italic ${borderClass}`}>{r.hinweis}</div>
          );
        }
        return r.kulturen?.length > 0 ? (
          <div key={i} className={`flex flex-wrap gap-1 px-3 py-2 ${borderClass}`}>
            {r.kulturen.map(k => (
              <span key={k} className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded px-1.5 py-0.5">{k}</span>
            ))}
          </div>
        ) : null;
      })}
    </div>
  );
}

function PflanzenBadges({ pflanzen, gepflanzt, selectedDate }) {
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {pflanzen.map((p) => {
        const name = pflanzeName(p);
        const { relation, gutMit, schlechtMit } = getNeighborRelation(name, pflanzen.map(pflanzeName));
        let ringClass = '';
        let tooltipParts = [];
        if (relation === 'gut') {
          ringClass = 'ring-2 ring-green-500';
          if (gutMit.length) tooltipParts.push(`✓ Gut mit: ${gutMit.join(', ')}`);
        } else if (relation === 'schlecht') {
          ringClass = 'ring-2 ring-red-500';
          if (schlechtMit.length) tooltipParts.push(`✗ Nicht mit: ${schlechtMit.join(', ')}`);
        }
        const info = findPflanze(name);
        let erntereif = false;
        if (info && gepflanzt && selectedDate) {
          const ernteStart = addMonths(parseISO(gepflanzt), info.ernteanfangOffset);
          const ernteEnde = addMonths(ernteStart, info.erntedauer);
          erntereif = selectedDate >= ernteStart && selectedDate <= ernteEnde;
        }
        const title = (erntereif ? '🌾 Erntereif! ' : '') +
          (tooltipParts.join(' · ') || (info ? `${info.icon} ${name}` : name));
        return (
          <span
            key={name}
            title={title}
            className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-medium cursor-default transition-colors ${ringClass} ${
              erntereif
                ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200'
                : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            }`}
          >
            {erntereif ? '🌾' : (info ? info.icon : '')}{' '}{name}
          </span>
        );
      })}
    </div>
  );
}

function DialogPlantManager({ beet, selectedDate, onUpdate, giessenLog, wetterDaten, onGiessen }) {
  const [pflanzen, setPflanzen] = useState(() => (beet.pflanzen || []).map(pflanzeName));
  const [newPlant, setNewPlant] = useState('');
  const [naechste, setNaechste] = useState(beet.naechste || '');
  const [naechsteInput, setNaechsteInput] = useState('');
  const [gepflanztVal, setGepflanztVal] = useState(beet.gepflanzt);
  const [faelligVal, setFaelligVal] = useState(beet.faellig);

  function updatePflanzen(next) {
    setPflanzen(next);
    onUpdate?.({ pflanzen: next, naechste, gepflanzt: gepflanztVal, faellig: faelligVal });
  }

  function updateNaechste(val) {
    setNaechste(val);
    setNaechsteInput('');
    onUpdate?.({ pflanzen, naechste: val, gepflanzt: gepflanztVal, faellig: faelligVal });
  }

  function updateGepflanzt(val) {
    setGepflanztVal(val);
    const auto = berechneFaelligAusPflanzen(val, pflanzen);
    const newFaellig = auto || faelligVal;
    setFaelligVal(newFaellig);
    onUpdate?.({ pflanzen, naechste, gepflanzt: val, faellig: newFaellig });
  }

  function updateFaellig(val) {
    setFaelligVal(val);
    onUpdate?.({ pflanzen, naechste, gepflanzt: gepflanztVal, faellig: val });
  }

  const allePflanzenDB = pflanzDatenbank.map(p => p.name);
  const erkannt = newPlant.trim() ? findPflanze(newPlant.trim()) : null;
  const suchErgebnisse = newPlant.trim().length >= 1
    ? allePflanzenDB.filter(p =>
        !pflanzen.includes(p) &&
        (p.toLowerCase().includes(newPlant.trim().toLowerCase()) ||
         (findPflanze(p)?.aliases || []).some(a => a.includes(newPlant.trim().toLowerCase())))
      ).slice(0, 8)
    : [];

  function handleAddPlant() {
    const trimmed = newPlant.trim();
    if (!trimmed) return;
    const gefunden = findPflanze(trimmed);
    const name = gefunden ? gefunden.name : trimmed;
    if (!pflanzen.includes(name)) {
      updatePflanzen([...pflanzen, name]);
    }
    setNewPlant('');
  }

  function handleRemovePlant(p) {
    updatePflanzen(pflanzen.filter(x => x !== p));
  }

  // Nachkultur-Vorschläge aus der Pflanzendatenbank berechnen
  const vorschlaege = Array.from(new Set(
    pflanzen.flatMap(p => {
      const info = findPflanze(p);
      return info ? [info.naechsteKultur] : [];
    })
  )).filter(Boolean);

  // Erntereife Pflanzen für das gewählte Datum berechnen
  const erntereifHeute = pflanzen.filter(p => {
    const info = findPflanze(p);
    if (!info) return false;
    const ernteStart = addMonths(parseISO(beet.gepflanzt), info.ernteanfangOffset);
    const ernteEnde = addMonths(ernteStart, info.erntedauer);
    return selectedDate >= ernteStart && selectedDate <= ernteEnde;
  });

  // Gieß-Status berechnen
  const giessDateStr = format(selectedDate, 'yyyy-MM-dd');
  const bereitsGegossen = (giessenLog?.[beet.beet] || []).includes(giessDateStr);
  const giessStatus = brauchtGiessen({ ...beet, pflanzen }, selectedDate, giessenLog || {}, wetterDaten);

  // Nachbarschaftsmatrix
  const konfliktPaare = [];
  const gutPaare = [];
  for (let i = 0; i < pflanzen.length; i++) {
    for (let j = i + 1; j < pflanzen.length; j++) {
      const a = pflanzen[i], b = pflanzen[j];
      const infoA = findPflanze(a);
      if (infoA) {
        const isGut = infoA.gut.some(g => g.toLowerCase() === b.toLowerCase());
        const isSchlecht = infoA.schlecht.some(s => s.toLowerCase() === b.toLowerCase());
        if (isSchlecht) konfliktPaare.push([a, b]);
        else if (isGut) gutPaare.push([a, b]);
      }
    }
  }

  return (
    <div>
      {/* Ernte-Abschnitt – datumsbezogen */}
      {erntereifHeute.length > 0 ? (
        <div className="mb-4 rounded-lg border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/30 px-3 py-2.5">
          <div className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1.5 uppercase tracking-wide">
            🌾 Jetzt erntereif am {format(selectedDate, 'dd.MM.yyyy')}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {erntereifHeute.map(p => {
              const info = findPflanze(p);
              return (
                <span key={p} className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-800/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-600 rounded px-2 py-0.5 text-xs font-medium">
                  {info?.icon} {p}
                </span>
              );
            })}
          </div>
        </div>
      ) : pflanzen.length > 0 && (
        <div className="mb-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
          📅 Am {format(selectedDate, 'dd.MM.yyyy')} keine Pflanzen erntereif
        </div>
      )}

      {/* Gieß-Status */}
      {pflanzen.length > 0 && (
        <div className={`mb-4 rounded-lg border px-3 py-2.5 ${
          bereitsGegossen
            ? 'border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20'
            : giessStatus.noetig
            ? 'border-cyan-300 dark:border-cyan-600 bg-cyan-50 dark:bg-cyan-900/30'
            : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <div className={`text-xs font-semibold uppercase tracking-wide ${
              bereitsGegossen
                ? 'text-blue-700 dark:text-blue-300'
                : giessStatus.noetig
                ? 'text-cyan-700 dark:text-cyan-300'
                : 'text-gray-500 dark:text-gray-400'
            }`}>
              💧 Gießen am {format(selectedDate, 'dd.MM.yyyy')}
            </div>
            {!giessStatus.nochNichtGepflanzt && (
              <button
                onClick={() => onGiessen?.(beet.beet, selectedDate)}
                className={`text-xs px-2 py-0.5 rounded font-medium transition-colors ${
                  bereitsGegossen
                    ? 'bg-blue-200 dark:bg-blue-700 text-blue-800 dark:text-blue-100 hover:bg-red-100 dark:hover:bg-red-900/50 hover:text-red-600'
                    : 'bg-cyan-100 dark:bg-cyan-800/50 text-cyan-700 dark:text-cyan-200 hover:bg-cyan-200 dark:hover:bg-cyan-700'
                }`}
                title={bereitsGegossen ? 'Klick zum Rükgängigmachen' : 'Als gegossen markieren'}
              >
                {bereitsGegossen ? '✓ Gegossen' : '💧 Jetzt gießen'}
              </button>
            )}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-300">{giessStatus.grund || '–'}</div>
          {(giessStatus.regenCredits ?? 0) > 0 && (
            <div className="text-xs text-blue-500 dark:text-blue-400 mt-0.5">
              🌧 {giessStatus.regenCredits} Regen-Credits abgezogen
            </div>
          )}
          <div className="flex flex-wrap gap-1 mt-1.5">
            {[...new Set(pflanzen)].map(p => {
              const info = findPflanze(p);
              if (!info?.giessIntervall) return null;
              return (
                <span key={p} className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-700">
                  {info.icon} alle {info.giessIntervall}d
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-2 font-semibold text-gray-900 dark:text-gray-100">Pflanzen:</div>
      <div className="flex flex-wrap gap-1 mt-2 mb-3">
        {[...new Set(pflanzen)].map((p) => {
          const info = findPflanze(p);
          return (
            <span key={p} className="inline-flex items-center gap-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-0.5 rounded text-xs font-medium">
              {info ? `${info.icon} ` : ''}{p}
              <button onClick={() => handleRemovePlant(p)} className="ml-1 text-green-600 hover:text-red-600 font-bold">×</button>
            </span>
          );
        })}
      </div>

      <div className="flex gap-2 mt-2">
        <div className="flex-1 relative">
          <input
            type="text"
            className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            placeholder="Pflanze suchen oder neu eingeben…"
            value={newPlant}
            onChange={e => setNewPlant(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddPlant()}
          />
          {suchErgebnisse.length > 0 && (
            <div className="absolute z-20 mt-0.5 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg max-h-48 overflow-y-auto">
              {suchErgebnisse.map(s => {
                const info = findPflanze(s);
                const faelligMonat = info && gepflanztVal
                  ? deMonat(addMonths(selectedDate, info.ernteanfangOffset + info.erntedauer))
                  : null;
                return (
                  <button
                    key={s}
                    type="button"
                    onMouseDown={e => { e.preventDefault(); updatePflanzen([...pflanzen, s]); setNewPlant(''); }}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-green-50 dark:hover:bg-green-900/30 text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-wrap"
                  >
                    <span>{info?.icon}</span>
                    <span className="font-medium">{s}</span>
                    {info && <span className="text-xs text-gray-500 dark:text-gray-400">Ernte: {info.ernteBeschreibung}</span>}
                    {faelligMonat && <span className="text-xs text-orange-500 dark:text-orange-400 ml-auto">→ Räumen: {faelligMonat}</span>}
                  </button>
                );
              })}
            </div>
          )}
          {erkannt && suchErgebnisse.length === 0 && (
            <div className="text-xs mt-1 text-green-700 dark:text-green-300">
              ✓ Erkannt: {erkannt.icon} {erkannt.name} · Ernte: {erkannt.ernteBeschreibung}
              {selectedDate && <span className="text-orange-500 dark:text-orange-400 ml-2">→ Räumen: {deMonat(addMonths(selectedDate, erkannt.ernteanfangOffset + erkannt.erntedauer))}</span>}
            </div>
          )}
        </div>
        <button
          className="bg-green-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-green-700 self-start"
          onClick={handleAddPlant}
        >
          Hinzufügen
        </button>
      </div>

      {/* Nachbarschaft */}
      {pflanzen.length > 1 && (gutPaare.length > 0 || konfliktPaare.length > 0) && (
        <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-3">
          <div className="font-semibold text-sm mb-2 text-gray-900 dark:text-gray-100">Nachbarschaft im Beet</div>
          {gutPaare.length > 0 && (
            <div className="mb-2">
              <div className="text-xs font-medium text-green-700 dark:text-green-300 mb-1">✅ Gute Kombis:</div>
              {gutPaare.map(([a, b]) => {
                const ia = findPflanze(a), ib = findPflanze(b);
                return (
                  <div key={a + b} className="text-xs text-green-800 dark:text-green-200 bg-green-50 dark:bg-green-900/30 rounded px-2 py-0.5 mb-0.5">
                    {ia?.icon} {a} + {ib?.icon} {b}
                  </div>
                );
              })}
            </div>
          )}
          {konfliktPaare.length > 0 && (
            <div>
              <div className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">⚠️ Konflikte:</div>
              {konfliktPaare.map(([a, b]) => {
                const ia = findPflanze(a), ib = findPflanze(b);
                return (
                  <div key={a + b} className="text-xs text-red-800 dark:text-red-200 bg-red-50 dark:bg-red-900/30 rounded px-2 py-0.5 mb-0.5">
                    {ia?.icon} {a} + {ib?.icon} {b} – nicht zusammen pflanzen
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 space-y-2 border-t border-gray-200 dark:border-gray-700 pt-3">
        <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-1">📅 Termine</div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600 dark:text-gray-400 w-24 shrink-0">Pflanzdatum</label>
          <input
            type="date"
            value={gepflanztVal}
            onChange={e => updateGepflanzt(e.target.value)}
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-green-400"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600 dark:text-gray-400 w-24 shrink-0">Fällig am</label>
          <input
            type="date"
            value={faelligVal}
            onChange={e => updateFaellig(e.target.value)}
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-green-400"
          />
        </div>
        <div className="text-xs text-gray-600 dark:text-gray-300">Ernte: {beet.ernte}</div>
      </div>

      {/* Nächste Bepflanzung */}
      <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-3">
        <div className="font-semibold text-sm mb-2 text-gray-900 dark:text-gray-100">🔄 Nächste Bepflanzung</div>
        {naechste && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700 rounded px-2 py-0.5">{naechste}</span>
            <button onClick={() => updateNaechste('')} className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400" title="Auswahl löschen">×</button>
          </div>
        )}
        {vorschlaege.length > 0 && (
          <div className="mb-2">
            <div className="text-xs text-gray-600 dark:text-gray-300 mb-1">💡 Vorschläge:</div>
            <div className="flex flex-wrap gap-1">
              {vorschlaege.map(v => (
                <button
                  key={v}
                  onClick={() => updateNaechste(v)}
                  className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                    naechste === v
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-gray-800 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2 mt-1">
          <select
            className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            value=""
            onChange={e => e.target.value && updateNaechste(e.target.value)}
          >
            <option value="" disabled>Aus Datenbank wählen…</option>
            {pflanzDatenbank.map(p => (
              <option key={p.name} value={p.name}>{p.icon} {p.name} – Pflanz: {p.pflanzMonate.map(m => ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'][m-1]).join(', ')}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="Eigene Eingabe…"
              value={naechsteInput}
              onChange={e => setNaechsteInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && naechsteInput.trim() && updateNaechste(naechsteInput.trim())}
            />
            <button
              onClick={() => naechsteInput.trim() && updateNaechste(naechsteInput.trim())}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-medium"
            >
              Setzen
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3">{getStatusBadge(beet, selectedDate)}</div>
    </div>
  );
}

function wmoIcon(code) {
  if (code == null) return '?';
  if (code === 0) return '☀️';
  if (code <= 3) return code <= 1 ? '🌤️' : '⛅';
  if (code <= 48) return '🌫️';
  if (code <= 57) return '🌦️';
  if (code <= 67) return code <= 63 ? '🌧️' : '🌧️';
  if (code <= 77) return '❄️';
  if (code <= 82) return '🌧️';
  if (code <= 86) return '🌨️';
  if (code <= 99) return '⛈️';
  return '🌡️';
}

function getStundenFuerTag(date, wetterDaten) {
  if (!wetterDaten?.hourly) return [];
  const dateStr = format(date, 'yyyy-MM-dd');
  const result = [];
  for (let i = 0; i < wetterDaten.hourly.time.length; i++) {
    const t = wetterDaten.hourly.time[i];
    if (t.startsWith(dateStr)) {
      const hour = parseInt(t.slice(11, 13), 10);
      if (hour >= 5 && hour <= 22) {
        result.push({
          hour,
          temp: wetterDaten.hourly.temperature_2m[i],
          prec: wetterDaten.hourly.precipitation[i],
          code: wetterDaten.hourly.weathercode?.[i] ?? wetterDaten.hourly.weather_code?.[i],
        });
      }
    }
  }
  return result;
}

function WetterStreifen({ wetterDaten, wetterLaedt, wetterFehler, standort, selectedDate, onRetry, onOrtsWahl }) {
  const [stadtPickerOffen, setStadtPickerOffen] = useState(false);
  const [zugeklappt, setZugeklappt] = useState(false);
  const [stundenTag, setStundenTag] = useState(null); // dStr of selected day for hourly view
  const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
  const tage = Array.from({ length: 11 }, (_, i) => {
    const d = new Date(todayDate); d.setDate(d.getDate() + i - 3); return d;
  });
  const selectedStr = format(selectedDate, 'yyyy-MM-dd');
  const todayStr = format(todayDate, 'yyyy-MM-dd');
  const standortName = standort?.name || (standort ? 'GPS' : null);

  if (wetterFehler) {
    return (
      <div className="max-w-7xl mx-auto px-4 mb-4">
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-4 py-3">
          <div className="text-xs text-amber-700 dark:text-amber-300 mb-2 flex items-center gap-2">
            <span>📍 Standort nicht verfügbar – Stadt wählen für Wetterdaten:</span>
            <button onClick={onRetry} className="underline text-amber-600 dark:text-amber-400 hover:text-amber-500 whitespace-nowrap">GPS erneut</button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STAEDTE.map(s => (
              <button
                key={s.name}
                onClick={() => onOrtsWahl(s)}
                className="text-xs px-2.5 py-1 rounded-full border border-amber-300 dark:border-amber-600 bg-white dark:bg-gray-800 text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors font-medium"
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!wetterDaten || wetterLaedt) {
    return (
      <div className="max-w-7xl mx-auto px-4 mb-4">
        <div className="rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
          <span className="inline-block animate-spin select-none">⟳</span>
          <span>{standort ? 'Wetterdaten werden geladen…' : 'Standort wird ermittelt…'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 mb-6">
      {/* Header-Zeile mit Standort + Stadt-Wähler */}
      <div className="flex items-center justify-between mb-1.5 px-0.5">
        <button
          onClick={() => setZugeklappt(z => !z)}
          className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5 hover:text-gray-700 dark:hover:text-white transition-colors"
        >
          <span className={`inline-block transition-transform duration-150 text-[9px] ${zugeklappt ? '' : 'rotate-90'}`}>▶</span>
          <span>🌤️ Wetter</span>
          {standortName && <span className="font-medium text-gray-700 dark:text-gray-200">· {standortName}</span>}
        </button>
        {!zugeklappt && (
          <button
            onClick={() => setStadtPickerOffen(o => !o)}
            className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
          >
            {stadtPickerOffen ? '✕ Schließen' : '📍 Standort ändern'}
          </button>
        )}
      </div>
      {zugeklappt && null}

      {/* Stadtauswahl-Dropdown */}
      {!zugeklappt && stadtPickerOffen && (
        <div className="mb-2 rounded-xl border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 px-3 py-2.5">
          <div className="text-[11px] text-blue-700 dark:text-blue-300 mb-1.5 font-medium flex items-center justify-between">
            <span>Stadt wählen oder GPS verwenden:</span>
            <button onClick={() => { onRetry(); setStadtPickerOffen(false); }} className="underline text-blue-500 dark:text-blue-400">GPS</button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STAEDTE.map(s => (
              <button
                key={s.name}
                onClick={() => { onOrtsWahl(s); setStadtPickerOffen(false); }}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors font-medium ${
                  standort?.name === s.name
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-800 text-blue-800 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {!zugeklappt && <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
        <div className="flex min-w-max">
          {tage.map(d => {
            const w = getWetterFuerTag(d, wetterDaten);
            const dStr = format(d, 'yyyy-MM-dd');
            const isToday = dStr === todayStr;
            const isSelected = dStr === selectedStr;
            const bg = isSelected
              ? 'bg-green-50 dark:bg-green-900/30 border-b-2 border-green-500'
              : isToday
              ? 'bg-blue-50 dark:bg-blue-900/20'
              : w?.isForecast ? 'bg-gray-50/50 dark:bg-gray-900/20' : '';
            return (
              <div
                key={dStr}
                onClick={() => setStundenTag(prev => prev === dStr ? null : dStr)}
                className={`relative flex flex-col items-center px-2.5 py-2 min-w-[72px] border-r border-gray-100 dark:border-gray-700 last:border-r-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors ${bg}`}>
                <div className={`text-[10px] font-semibold uppercase tracking-wide mb-0.5 ${isToday ? 'text-blue-600 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'}`}>
                  {isToday ? 'Heute' : WDAY_SHORT[d.getDay()]}
                </div>
                <div className={`text-xs font-medium mb-1 ${isSelected ? 'text-green-700 dark:text-green-300' : 'text-gray-700 dark:text-gray-200'}`}>
                  {format(d, 'dd.MM.')}
                </div>
                {w ? (
                  <>
                    <div className="text-[11px] font-semibold text-orange-500 dark:text-orange-300">{w.maxTemp != null ? `${Math.round(w.maxTemp)}°` : '–'}</div>
                    <div className="text-[10px] text-blue-400 dark:text-blue-300">{w.minTemp != null ? `${Math.round(w.minTemp)}°` : ''}</div>
                    <div className="flex flex-col items-center mt-1 min-h-[28px] justify-center">
                      {w.precipitation > 0.1 ? (
                        <>
                          <span className="text-[10px] font-medium text-blue-600 dark:text-blue-300">💧{w.precipitation.toFixed(1)}</span>
                          {w.isForecast && w.precipProb > 0 && (
                            <span className="text-[9px] text-blue-400 dark:text-blue-400">~{w.precipProb}%</span>
                          )}
                        </>
                      ) : (
                        <span className="text-[10px] text-gray-300 dark:text-gray-600">☔️​–</span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-[10px] text-gray-300 dark:text-gray-600 mt-2">–</div>
                )}
                {w?.isForecast && (
                  <div className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5">prog.</div>
                )}
                {stundenTag === dStr && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 w-2 h-2 rotate-45 bg-white dark:bg-gray-800 border-l border-t border-gray-200 dark:border-gray-600 z-10" />
                )}
              </div>
            );
          })}
        </div>
      </div>}

      {/* Stunden-Vorschau */}
      {!zugeklappt && stundenTag && (() => {
        const stundenDatum = new Date(stundenTag);
        const stunden = getStundenFuerTag(stundenDatum, wetterDaten);
        if (stunden.length === 0) return null;
        return (
          <div className="mt-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-x-auto">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 dark:border-gray-700">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                🕐 Stundenvorschau – {format(stundenDatum, 'dd.MM.yyyy')}
              </span>
              <button onClick={() => setStundenTag(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm">✕</button>
            </div>
            <div className="flex min-w-max px-1 py-2 gap-0.5">
              {stunden.map(s => (
                <div key={s.hour} className="flex flex-col items-center px-2 min-w-[44px]">
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{String(s.hour).padStart(2,'0')}h</div>
                  <div className="text-base my-0.5">{wmoIcon(s.code)}</div>
                  <div className="text-xs font-semibold text-orange-500 dark:text-orange-300">{s.temp != null ? `${Math.round(s.temp)}°` : '–'}</div>
                  {s.prec > 0.05 ? (
                    <div className="text-[10px] text-blue-500 dark:text-blue-400 mt-0.5">💧{s.prec.toFixed(1)}</div>
                  ) : (
                    <div className="text-[10px] text-transparent mt-0.5">–</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function TagesAufgaben({ beete, selectedDate, giessenLog, duengenLog, wetterDaten, onGiessenAlle, onDuengen }) {
  const [eingeklappt, setEingeklappt] = useState(new Set());
  const [aufgeklappt, setAufgeklappt] = useState(null);
  const toggleSektion = (prio) => setEingeklappt(prev => {
    const n = new Set(prev); n.has(prio) ? n.delete(prio) : n.add(prio); return n;
  });
  const toggleAufgabe = (idx) => setAufgeklappt(prev => prev === idx ? null : idx);
  const monat = selectedDate.getMonth() + 1;
  const gepflanztBeete = beete.filter(b => b.pflanzen?.length > 0 && parseISO(b.gepflanzt) <= selectedDate);
  const KRAEUTER = new Set(['Basilikum','Schnittlauch','Petersilie','Dill','Koriander','Pimpinelle','Blutampfer','Wilde Rauke','Barbarakraut','Hirschhornwegerich','Borretsch']);
  const bereitsGepflanzt = new Set(beete.flatMap(b => (b.pflanzen || []).map(pflanzeName)));

  const aufgaben = [];

  // 0. Überfällige Beete
  beete.forEach(beet => {
    if (!beet.pflanzen?.length) return;
    const tage = differenceInDays(parseISO(beet.faellig), selectedDate);
    if (tage < 0 && tage >= -14) {
      aufgaben.push({
        typ: 'warnung', icon: '⚠️', prio: 0,
        text: `Beet ${beet.beet} räumen!`,
        sub: `Seit ${Math.abs(tage)} Tagen fällig${beet.naechste ? ` · Nachkultur: ${beet.naechste}` : ''}`,
        details: [
          `📅 Fällig seit: ${format(parseISO(beet.faellig), 'dd.MM.yyyy')}`,
          `🌿 Pflanzen: ${beet.pflanzen.map(p => `${findPflanze(p)?.icon || ''} ${pflanzeName(p)}`).join(', ')}`,
          beet.naechste && `🔄 Geplante Nachfolge: ${beet.naechste}`,
          beet.zone && `📍 Zone: ${beet.zone}`,
        ].filter(Boolean),
      });
    }
  });

  // 0b. Frostgefahr
  const FROST_EMPFINDLICH = new Set([
    'Tomate','Basilikum','Zucchini','Gurke','Paprika','Kürbis',
    'Aubergine','Mais','Melone','Bohnen','Süßkartoffel',
  ]);
  const wetterHeuteTag = getWetterFuerTag(selectedDate, wetterDaten);
  if (wetterHeuteTag?.minTemp != null && wetterHeuteTag.minTemp < 2) {
    const betroffene = beete
      .filter(b => b.pflanzen?.some(p => FROST_EMPFINDLICH.has(pflanzeName(p))))
      .map(b => b.beet);
    aufgaben.push({
      typ: 'frost', icon: '❄️', prio: 0,
      text: `Frostgefahr diese Nacht (${wetterHeuteTag.minTemp.toFixed(0)}°C)`,
      sub: betroffene.length > 0 ? `Abdecken: Beet ${betroffene.join(', ')}` : 'Keine frostempfindlichen Pflanzen im Garten',
      details: [
        `❄️ Tiefstwert: ${wetterHeuteTag.minTemp}°C`,
        betroffene.length > 0 && `🥗 Betroffene Beete: ${betroffene.join(', ')}`,
        '💡 Tipp: Vlies oder Folie über die Pflanzen legen',
      ].filter(Boolean),
    });
  }
  const morgenFrostDat = new Date(selectedDate); morgenFrostDat.setDate(morgenFrostDat.getDate() + 1);
  const wetterMorgenFrost = getWetterFuerTag(morgenFrostDat, wetterDaten);
  if (wetterMorgenFrost?.isForecast && wetterMorgenFrost.minTemp != null && wetterMorgenFrost.minTemp < 2) {
    const betroffene = beete
      .filter(b => b.pflanzen?.some(p => FROST_EMPFINDLICH.has(pflanzeName(p))))
      .map(b => b.beet);
    aufgaben.push({
      typ: 'frost-morgen', icon: '🥶', prio: 0,
      text: `Frostgefahr morgen (${wetterMorgenFrost.minTemp.toFixed(0)}°C)`,
      sub: betroffene.length > 0 ? `Abdecken vorbereiten: Beet ${betroffene.join(', ')}` : 'Empfindliche Pflanzen schützen',
      details: [
        `❄️ Tiefstwert morgen: ${wetterMorgenFrost.minTemp}°C`,
        betroffene.length > 0 && `🥗 Betroffene Beete: ${betroffene.join(', ')}`,
        '💡 Tipp: Vlies, Folie oder Glocken bereitstellen',
      ].filter(Boolean),
    });
  }

  // 1. Gießen
  gepflanztBeete.forEach(beet => {
    const gs = brauchtGiessen(beet, selectedDate, giessenLog, wetterDaten);
    if (gs.noetig) {
      aufgaben.push({
        typ: 'giessen', icon: '💧', prio: 1,
        beetId: beet.beet,
        text: `Beet ${beet.beet} gießen`,
        sub: gs.grund,
        details: [
          gs.letzteGiessung
            ? `📅 Zuletzt gegossen: ${format(gs.letzteGiessung, 'dd.MM.yyyy')}`
            : '📅 Bisher noch nicht gegossen',
          `⏱ ${gs.tageSeit} Tage vergangen (Intervall: ${gs.intervall} Tage)`,
          gs.regenCredits > 0 && `🌧️ Regen-Credits: −${gs.regenCredits.toFixed(1)} Tage`,
          `📊 Effektiv: ${gs.effektiveTage.toFixed(1)} von ${gs.intervall} Tagen`,
          `🌱 Pflanzen: ${[...new Set(beet.pflanzen.map(pflanzeName))].map(p => { const info = findPflanze(p); return `${info?.icon || ''} ${p} (${info?.giessIntensität || '?'}, alle ${info?.giessIntervall || '?'}d)`; }).join(', ')}`,

        ].filter(Boolean),
      });
    }
  });

  // 1b. Düngen
  if (duengenLog) {
    gepflanztBeete.forEach(beet => {
      const ds = brauchtDuengen(beet, selectedDate, duengenLog);
      if (ds.noetig) {
        aufgaben.push({
          typ: 'duengen', icon: '🌿', prio: 2,
          beetId: beet.beet,
          text: `Beet ${beet.beet} düngen`,
          sub: ds.grund,
          details: [
            ds.letztesDuengen
              ? `📅 Zuletzt gedüngt: ${format(ds.letztesDuengen, 'dd.MM.yyyy')}`
              : '📅 Noch nie gedüngt',
            `⏱ Intervall: alle ${ds.intervall} Tage`,
            `🌱 Pflanzen: ${[...new Set(beet.pflanzen.map(pflanzeName))].join(', ')}`,
          ].filter(Boolean),
        });
      }
    });
  }

  // 2. Regen morgen erwartet
  const morgen = new Date(selectedDate); morgen.setDate(morgen.getDate() + 1);
  const regenMorgen = getWetterFuerTag(morgen, wetterDaten);
  if (regenMorgen?.isForecast && regenMorgen.precipitation >= 5) {
    const uebermorgen = new Date(selectedDate); uebermorgen.setDate(uebermorgen.getDate() + 2);
    const regenUebermorgen = getWetterFuerTag(uebermorgen, wetterDaten);
    aufgaben.push({
      typ: 'regen', icon: '🌧️', prio: 3,
      text: `Morgen ~${regenMorgen.precipitation.toFixed(0)} mm Regen (${regenMorgen.precipProb}%)`,
      sub: 'Gießen heute ggf. sparen',
      details: [
        `🌧️ Morgen: ${regenMorgen.precipitation.toFixed(1)} mm · ${regenMorgen.precipProb}% Wahrscheinlichkeit`,
        regenUebermorgen && `📅 Übermorgen: ${regenUebermorgen.precipitation.toFixed(1)} mm · ${regenUebermorgen.precipProb || 0}%`,
        regenMorgen.maxTemp != null && `🌡️ Morgen: ${regenMorgen.maxTemp}°C / ${regenMorgen.minTemp}°C`,
        '💡 Tipp: Wenn der Regen kommt, Gießen auf übermorgen verschieben',
      ].filter(Boolean),
    });
  }

  // 3. Ernte & Kräuterschnitt
  gepflanztBeete.forEach(beet => {
    const erntereif = beet.pflanzen.filter(p => {
      const info = findPflanze(p);
      if (!info) return false;
      const start = addMonths(parseISO(beet.gepflanzt), info.ernteanfangOffset);
      return selectedDate >= start && selectedDate <= addMonths(start, info.erntedauer);
    });
    const gemuese = erntereif.filter(p => !KRAEUTER.has(pflanzeName(p)));
    const kraeuter = erntereif.filter(p => KRAEUTER.has(pflanzeName(p)));
    if (gemuese.length) {
      aufgaben.push({
        typ: 'ernte', icon: '🌾', prio: 4,
        text: `Beet ${beet.beet} ernten`,
        sub: gemuese.map(p => `${findPflanze(p)?.icon||''} ${pflanzeName(p)}`).join(' · '),
        details: gemuese.map(p => {
          const info = findPflanze(p);
          if (!info) return pflanzeName(p);
          const start = addMonths(parseISO(beet.gepflanzt), info.ernteanfangOffset);
          const end = addMonths(start, info.erntedauer);
          return `${info.icon} ${pflanzeName(p)}: Ernte ${format(start, 'dd.MM.')} – ${format(end, 'dd.MM.')}`;
        }),
      });
    }
    if (kraeuter.length) {
      aufgaben.push({
        typ: 'rueckschnitt', icon: '✂️', prio: 4,
        text: `Beet ${beet.beet} – Kräuter schneiden`,
        sub: kraeuter.map(p => `${findPflanze(p)?.icon||''} ${pflanzeName(p)}`).join(' · '),
        details: [
          ...kraeuter.map(p => {
            const info = findPflanze(p);
            return `${info?.icon || '🌿'} ${pflanzeName(p)}: Regelmäßig schneiden, nicht tief in altes Holz`;
          }),
          '💡 Tipp: Kräuter morgens schneiden, damit Schnittstellen abtrocknen können',
        ],
      });
    }
  });

  // 4. Beet räumen (bald fällig) + Nachkulturempfehlung
  beete.forEach(beet => {
    if (!beet.pflanzen?.length) return;
    const tage = differenceInDays(parseISO(beet.faellig), selectedDate);
    if (tage >= 0 && tage <= 14) {
      const alternativen = pflanzDatenbank
        .filter(p => p.pflanzMonate.includes(monat) && !bereitsGepflanzt.has(p.name))
        .filter(p => (beet.pflanzen || []).every(ex => {
          const ei = findPflanze(ex);
          return !p.schlecht?.some(s => s.toLowerCase() === ex.toLowerCase()) &&
                 !ei?.schlecht?.some(s => s.toLowerCase() === p.name.toLowerCase());
        }))
        .slice(0, 5);
      const subParts = [];
      if (beet.naechste) subParts.push(`Plan: ${beet.naechste}`);
      if (alternativen.length) subParts.push(`Jetzt pflanzbar: ${alternativen.slice(0,3).map(p => `${p.icon} ${p.name}`).join(', ')}`);
      aufgaben.push({
        typ: 'raeumen', icon: '🔄', prio: 5,
        text: `Beet ${beet.beet} in ${tage} ${tage === 1 ? 'Tag' : 'Tagen'} räumen`,
        sub: subParts.join(' · ') || 'Nachfolger planen',
        details: [
          `📅 Räumen bis: ${format(parseISO(beet.faellig), 'dd.MM.yyyy')}`,
          `🌿 Jetzt drin: ${beet.pflanzen.map(p => `${findPflanze(p)?.icon || ''} ${pflanzeName(p)}`).join(', ')}`,
          beet.naechste && `🔄 Geplante Nachfolge: ${beet.naechste}`,
          alternativen.length && `✅ Mögliche Nachfolger: ${alternativen.map(p => `${p.icon} ${p.name}`).join(', ')}`,
        ].filter(Boolean),
      });
    }
  });

  // 5. Auflocken (4+ trockene Tage in Folge)
  if (wetterDaten) {
    let trockentage = 0;
    for (let i = 1; i <= 5; i++) {
      const d = new Date(selectedDate); d.setDate(d.getDate() - i);
      const w = getWetterFuerTag(d, wetterDaten);
      if (w && !w.isForecast && (w.precipitation ?? 0) < 2) trockentage++;
      else break;
    }
    if (trockentage >= 4 && gepflanztBeete.length > 0) {
      aufgaben.push({
        typ: 'auflocken', icon: '⛏️', prio: 6,
        text: 'Beete auflocken',
        sub: `${trockentage} Tage ohne nennenswerten Regen – Bodenkruste aufbrechen`,
        details: [
          `☀️ ${trockentage} trockene Tage in Folge`,
          '💡 Tipp: Oberfläche 3–5 cm tief auflockern, verhindert Kapillaraufstieg',
          gepflanztBeete.length > 0 && `🏡 Betroffene Beete: ${gepflanztBeete.map(b => `Beet ${b.beet}`).join(', ')}`,
        ].filter(Boolean),
      });
    }
  }

  // 6. Jetzt pflanzen / säen (nach Nachbarschafts-Score sortiert)
  const ranked = pflanzDatenbank
    .filter(p => p.pflanzMonate.includes(monat) && !bereitsGepflanzt.has(p.name))
    .map(p => {
      let score = 0;
      bereitsGepflanzt.forEach(ex => {
        if (p.gut?.some(g => g.toLowerCase() === ex.toLowerCase())) score++;
        if (p.schlecht?.some(s => s.toLowerCase() === ex.toLowerCase())) score -= 2;
        const ei = findPflanze(ex);
        if (ei?.gut?.some(g => g.toLowerCase() === p.name.toLowerCase())) score++;
        if (ei?.schlecht?.some(s => s.toLowerCase() === p.name.toLowerCase())) score -= 2;
      });
      return { ...p, score };
    })
    .filter(p => p.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  if (ranked.length > 0) {
    aufgaben.push({
      typ: 'pflanzen', icon: '🌱', prio: 7,
      text: 'Jetzt pflanzen / säen',
      sub: ranked.slice(0, 5).map(p => `${p.icon} ${p.name}`).join(' · '),
      details: ranked.map(p => {
        const gutNachbarn = p.gut?.filter(g => [...bereitsGepflanzt].some(ex => ex.toLowerCase() === g.toLowerCase())) || [];
        return `${p.icon} ${p.name}${p.score > 0 ? ` (+${p.score} Punkte)` : ''}${gutNachbarn.length ? ` · gut mit: ${gutNachbarn.join(', ')}` : ''}`;
      }),
    });
  }

  const FARBEN = {
    warnung:     'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700',
    giessen:     'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-700',
    duengen:     'bg-lime-50 dark:bg-lime-900/20 border-lime-200 dark:border-lime-700',
    regen:       'bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-700',
    ernte:       'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700',
    rueckschnitt:'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-700',
    raeumen:     'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-700',
    auflocken:   'bg-stone-50 dark:bg-stone-900/20 border-stone-200 dark:border-stone-700',
    pflanzen:    'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700',
  };

  const SEKTIONEN = [
    { prio: 0, label: '⚠️ Dringend' },
    { prio: 1, label: '💧 Bewässerung' },
    { prio: 2, label: '🌿 Düngen' },
    { prio: 3, label: '🌧️ Wetter' },
    { prio: 4, label: '🌾 Ernte' },
    { prio: 5, label: '🔄 Beetpflege' },
    { prio: 6, label: '⛏️ Bodenarbeit' },
    { prio: 7, label: '🌱 Pflanzen & Säen' },
  ];

  aufgaben.sort((a, b) => a.prio - b.prio);

  if (aufgaben.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 mb-4">
        <div className="text-center py-2 text-xs text-gray-400 dark:text-gray-500">🌿 Heute keine offenen Aufgaben</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 mb-6">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2 px-0.5">
        📋 Aufgaben – {format(selectedDate, 'dd.MM.yyyy')}
      </div>
      <div className="space-y-3">
        {SEKTIONEN.map(sek => {
          const items = aufgaben.filter(a => a.prio === sek.prio);
          if (items.length === 0) return null;
          const istEingeklappt = eingeklappt.has(sek.prio);
          return (
            <div key={sek.prio}>
              <div className="flex items-center gap-2 mb-1.5">
                <button
                  onClick={() => toggleSektion(sek.prio)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors flex-1 text-left"
                >
                  <span className={`inline-block transition-transform duration-150 text-[10px] ${istEingeklappt ? '' : 'rotate-90'}`}>▶</span>
                  {sek.label}
                </button>
                {sek.prio === 1 && items.length > 0 && onGiessenAlle && (
                  <button
                    onClick={() => onGiessenAlle(items.map(a => a.beetId).filter(Boolean))}
                    className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:text-cyan-800 dark:hover:text-cyan-200 transition-colors border border-cyan-300 dark:border-cyan-600 rounded-full px-2 py-0.5 shrink-0"
                  >
                    💧 Alle gießen
                  </button>
                )}
                {sek.prio === 2 && items.length > 1 && onDuengen && (
                  <button
                    onClick={(e) => { e.stopPropagation(); items.forEach(a => a.beetId != null && onDuengen(a.beetId, new Date())); }}
                    className="text-xs font-semibold text-lime-600 dark:text-lime-400 hover:text-lime-800 dark:hover:text-lime-200 transition-colors border border-lime-300 dark:border-lime-600 rounded-full px-2 py-0.5 shrink-0"
                  >
                    🌿 Alle düngen
                  </button>
                )}
              </div>
              {!istEingeklappt && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {items.map((a, i) => {
                    const globalIdx = aufgaben.indexOf(a);
                    const isOpen = aufgeklappt === globalIdx;
                    const hasDetails = a.details?.length > 0;
                    return (
                      <div
                        key={i}
                        onClick={() => hasDetails && toggleAufgabe(globalIdx)}
                        className={`rounded-xl px-3 py-2.5 border transition-shadow ${FARBEN[a.typ] || 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'} ${hasDetails ? 'cursor-pointer hover:shadow-sm active:opacity-80' : ''}`}
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="text-base leading-none shrink-0 mt-0.5">{a.icon}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-snug flex-1">{a.text}</div>
                              {hasDetails && (
                                <span className={`text-[11px] text-gray-400 dark:text-gray-500 shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                              )}
                            </div>
                            {a.sub && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug break-words">{a.sub}</div>}
                            {isOpen && a.details?.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-black/10 dark:border-white/10 space-y-1">
                                {a.details.map((d, di) => (
                                  <div key={di} className="text-xs text-gray-600 dark:text-gray-300 leading-snug">{d}</div>
                                ))}
                              </div>
                            )}
                            {a.typ === 'duengen' && onDuengen && a.beetId != null && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onDuengen(a.beetId, new Date()); }}
                                className="mt-2 text-xs font-semibold text-lime-700 dark:text-lime-300 hover:text-lime-900 dark:hover:text-lime-100 transition-colors border border-lime-300 dark:border-lime-600 rounded-full px-2 py-0.5"
                              >
                                ✓ Gedüngt
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function berechneFaelligAusPflanzen(gepflanztStr, pflanzenListe) {
  if (!pflanzenListe.length || !gepflanztStr) return null;
  const infos = pflanzenListe.map(p => findPflanze(p)).filter(Boolean);
  if (!infos.length) return null;
  const gepflanztDate = parseISO(gepflanztStr);
  const ernteEnden = infos.map(i => addMonths(gepflanztDate, i.ernteanfangOffset + i.erntedauer));
  const latest = ernteEnden.reduce((a, b) => b > a ? b : a);
  return format(latest, 'yyyy-MM-dd');
}

function AddBeetDialog({ onAdd, selectedDate }) {
  const [open, setOpen] = useState(false);
  const [pflanzen, setPflanzen] = useState([]);
  const [gepflanzt, setGepflanzt] = useState(format(today, 'yyyy-MM-dd'));
  const [faellig, setFaellig] = useState(format(addMonths(today, 1), 'yyyy-MM-dd'));
  const [faelligManuell, setFaelligManuell] = useState(false);
  const [newPlant, setNewPlant] = useState('');

  const allePflanzenDB = pflanzDatenbank.map(p => p.name);
  const erkannt = newPlant.trim() ? findPflanze(newPlant.trim()) : null;
  const suchErgebnisse = newPlant.trim().length >= 1
    ? allePflanzenDB.filter(p =>
        !pflanzen.includes(p) &&
        (p.toLowerCase().includes(newPlant.trim().toLowerCase()) ||
         (findPflanze(p)?.aliases || []).some(a => a.includes(newPlant.trim().toLowerCase())))
      ).slice(0, 8)
    : [];

  function autoFaellig(neuePflanzen, gepflanztStr) {
    if (!faelligManuell) {
      const auto = berechneFaelligAusPflanzen(gepflanztStr, neuePflanzen);
      if (auto) setFaellig(auto);
    }
  }

  function handleAddPlant() {
    const trimmed = newPlant.trim();
    if (!trimmed) return;
    const gefunden = findPflanze(trimmed);
    const name = gefunden ? gefunden.name : trimmed;
    if (!pflanzen.includes(name)) {
      const next = [...pflanzen, name];
      setPflanzen(next);
      autoFaellig(next, gepflanzt);
    }
    setNewPlant('');
  }

  function handleCreate() {
    if (pflanzen.length === 0) return;
    const erntbarIm = computeErntbarIm(gepflanzt, pflanzen);
    const infos = pflanzen.map(p => findPflanze(p)).filter(Boolean);
    const ernte = infos.length ? [...new Set(infos.map(i => i.ernteBeschreibung))].join(', ') : 'k.A.';
    const naechste = infos.length ? infos[0].naechsteKultur : 'k.A.';
    onAdd({ pflanzen, gepflanzt, faellig, ernte, naechste, erntbarIm });
    setPflanzen([]);
    setGepflanzt(format(today, 'yyyy-MM-dd'));
    setFaellig(format(addMonths(today, 1), 'yyyy-MM-dd'));
    setFaelligManuell(false);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className="cursor-pointer border-2 border-dashed border-green-300 dark:border-green-700 rounded-xl flex flex-col items-center justify-center min-h-[160px] hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition text-green-600 dark:text-green-400 gap-2 select-none">
          <span className="text-4xl font-light">+</span>
          <span className="text-sm font-medium">Neues Beet</span>
        </div>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Neues Beet anlegen</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">Pflanzen</label>
            <div className="flex flex-wrap gap-1 mb-2">
              {pflanzen.map(p => {
                const info = findPflanze(p);
                return (
                  <span key={p} className="inline-flex items-center gap-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-0.5 rounded text-xs font-medium">
                    {info?.icon} {p}
                    <button onClick={() => { const next = pflanzen.filter(x => x !== p); setPflanzen(next); autoFaellig(next, gepflanzt); }} className="ml-1 text-green-600 hover:text-red-600 font-bold">×</button>
                  </span>
                );
              })}
            </div>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  placeholder="Pflanze suchen oder neu eingeben…"
                  value={newPlant}
                  onChange={e => setNewPlant(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddPlant()}
                />
                {suchErgebnisse.length > 0 && (
                  <div className="absolute z-20 mt-0.5 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg max-h-48 overflow-y-auto">
                    {suchErgebnisse.map(s => {
                      const info = findPflanze(s);
                      const faelligMonat = info && gepflanzt
                        ? deMonat(addMonths(selectedDate, info.ernteanfangOffset + info.erntedauer))
                        : null;
                      return (
                        <button
                          key={s}
                          type="button"
                          onMouseDown={e => { e.preventDefault(); const next = [...pflanzen, s]; setPflanzen(next); autoFaellig(next, gepflanzt); setNewPlant(''); }}
                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-green-50 dark:hover:bg-green-900/30 text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-wrap"
                        >
                          <span>{info?.icon}</span>
                          <span className="font-medium">{s}</span>
                          {info && <span className="text-xs text-gray-500 dark:text-gray-400">Ernte: {info.ernteBeschreibung}</span>}
                          {faelligMonat && <span className="text-xs text-orange-500 dark:text-orange-400 ml-auto">→ Räumen: {faelligMonat}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
                {erkannt && suchErgebnisse.length === 0 && (
                  <div className="text-xs mt-1 text-green-700 dark:text-green-300">✓ {erkannt.icon} {erkannt.name} · {erkannt.ernteBeschreibung}
                    {selectedDate && <span className="text-orange-500 dark:text-orange-400 ml-2">→ Räumen: {deMonat(addMonths(selectedDate, erkannt.ernteanfangOffset + erkannt.erntedauer))}</span>}
                  </div>
                )}
              </div>
              <button onClick={handleAddPlant} className="bg-green-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-green-700 self-start">+</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">Gepflanzt am</label>
              <input type="date" value={gepflanzt} onChange={e => { setGepflanzt(e.target.value); autoFaellig(pflanzen, e.target.value); }}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-900 dark:text-gray-100">Fällig am <span className="text-[10px] font-normal text-gray-400">(auto)</span></label>
              <input type="date" value={faellig} onChange={e => { setFaellig(e.target.value); setFaelligManuell(true); }}
                className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100" />
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={pflanzen.length === 0}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white py-2 rounded font-medium text-sm"
          >
            Beet anlegen
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BottomNav({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'heute', icon: '🏠', label: 'Heute' },
    { id: 'beete', icon: '🥬', label: 'Beete' },
    { id: 'kalender', icon: '📅', label: 'Kalender' },
    { id: 'chatbot', icon: '🤖', label: 'Assistent' },
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
      <div className="flex">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => onTabChange(t.id)}
            className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-xs transition-colors ${
              activeTab === t.id
                ? 'text-green-600 dark:text-green-400 font-semibold'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <span className={`text-xl leading-none transition-transform duration-150 ${activeTab === t.id ? 'scale-110' : ''}`}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

function KalenderTab({ beete, ernteLog, selectedDate }) {
  const monate = [0, 1, 2].map(offset => {
    const d = new Date(selectedDate);
    d.setMonth(d.getMonth() + offset);
    d.setDate(1);
    return d;
  });

  const ernteByMonat = {};
  for (const e of ernteLog) {
    const m = e.datum.slice(0, 7);
    if (!ernteByMonat[m]) ernteByMonat[m] = [];
    ernteByMonat[m].push(e);
  }
  const sortierteMonate = Object.keys(ernteByMonat).sort().reverse();

  return (
    <div className="max-w-7xl mx-auto px-4 pb-10 space-y-6">
      <section>
        <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-widest">📅 Nächste 3 Monate</h2>
        <div className="space-y-3">
          {monate.map(monat => {
            const monatNum = monat.getMonth() + 1;
            const monatStr = format(monat, 'yyyy-MM');
            const pflanzbar = pflanzDatenbank.filter(p => p.pflanzMonate?.includes(monatNum));
            const ernteBeete = beete.filter(b => b.erntbarIm?.includes(monatStr));
            return (
              <div key={monatStr} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                <div className="font-semibold text-base text-gray-800 dark:text-gray-100 mb-3">
                  {DE_MONATE_LANG[monat.getMonth()]} {monat.getFullYear()}
                </div>
                {ernteBeete.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1.5">🌾 Ernte dieser Beete</div>
                    <div className="flex flex-wrap gap-1.5">
                      {ernteBeete.map(b => (
                        <span key={b.beet} className="text-xs px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                          Beet {b.beet}{b.label ? ` · ${b.label}` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-xs font-medium text-green-700 dark:text-green-400 mb-1.5">🌱 Jetzt pflanzen</div>
                  {pflanzbar.length === 0 ? (
                    <span className="text-xs text-gray-400 dark:text-gray-500">Keine Pflanzempfehlungen für diesen Monat.</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {pflanzbar.slice(0, 14).map(p => (
                        <span key={p.name} className="text-xs px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800">
                          {p.icon} {p.name}
                        </span>
                      ))}
                      {pflanzbar.length > 14 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                          +{pflanzbar.length - 14}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-widest">🌾 Ernte-Tagebuch</h2>
        {sortierteMonate.length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-gray-400 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 px-4 py-10 text-center">
            Noch keine Ernte eingetragen.
            <span className="block text-xs mt-1 text-gray-400 dark:text-gray-500">Markiere geerntete Pflanzen im Beete-Tab.</span>
          </div>
        ) : (
          <div className="space-y-3">
            {sortierteMonate.map(monatStr => {
              const [year, mon] = monatStr.split('-');
              const eintraege = ernteByMonat[monatStr];
              const gesamtMenge = {};
              for (const e of eintraege) {
                if (e.menge != null) {
                  const k = `${e.pflanze}|||${e.einheit || 'Stück'}`;
                  gesamtMenge[k] = (gesamtMenge[k] || 0) + Number(e.menge);
                }
              }
              return (
                <div key={monatStr} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                  <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700 flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                      {DE_MONATE_LANG[parseInt(mon) - 1]} {year}
                    </span>
                    <span className="text-xs text-amber-600 dark:text-amber-500">{eintraege.length} {eintraege.length === 1 ? 'Eintrag' : 'Einträge'}</span>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                    {eintraege.map((e, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-gray-400 dark:text-gray-500 font-mono tabular-nums">
                            {e.datum.slice(8)}.{e.datum.slice(5, 7)}.
                          </span>
                          <span className="text-sm text-gray-800 dark:text-gray-200">
                            {findPflanze(e.pflanze)?.icon} {e.pflanze}
                          </span>
                          <span className="text-xs text-gray-400 dark:text-gray-500">· Beet {e.beetId}</span>
                        </div>
                        {e.menge != null && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-700 shrink-0">
                            {e.menge} {e.einheit || 'Stück'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  {Object.keys(gesamtMenge).length > 0 && (
                    <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 flex flex-wrap gap-x-4 gap-y-1 items-center">
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Gesamt:</span>
                      {Object.entries(gesamtMenge).map(([key, total]) => {
                        const [pflanze, einheit] = key.split('|||');
                        return (
                          <span key={key} className="text-xs text-gray-700 dark:text-gray-300">
                            {pflanze}: <strong>{total} {einheit}</strong>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function App({ profileId, profileName, profileColor, onSwitchProfile, onRenameProfile }) {
  const [beete, setBeete] = useState(() => {
    try {
      const saved = lsGet('beete', profileId);
      const version = lsGet('beetDataVersion', profileId);
      const parsed = saved && version === GARDEN_DATA_VERSION ? JSON.parse(saved) : initialGardenData;
      return migratePflanzenZuObjekte(parsed);
    } catch {
      return migratePflanzenZuObjekte(initialGardenData);
    }
  });
  const [selectedDate, setSelectedDate] = useState(today);
  const [pdfOffen, setPdfOffen] = useState(false);
  const [beeteZugeklappt, setBeeteZugeklappt] = useState(false);
  const [archivZugeklappt, setArchivZugeklappt] = useState(false);
  const [expandedBeet, setExpandedBeet] = useState(null);
  const [pinnedBeete, setPinnedBeete] = useState(() => {
    try { return new Set(JSON.parse(lsGet('pinnedBeete', profileId) || '[]')); } catch { return new Set(); }
  });
  const [beetFilter, setBeetFilter] = useState('alle');
  const [beetNotizen, setBeetNotizen] = useState(() => {
    try { return JSON.parse(lsGet('beetNotizen', profileId) || '{}'); } catch { return {}; }
  });
  const [ernteLog, setErnteLog] = useState(() => {
    try { return JSON.parse(lsGet('ernteLog', profileId) || '[]'); } catch { return []; }
  });
  const [archivierteBeete, setArchivierteBeete] = useState(() => {
    try {
      const saved = lsGet('archivierteBeete', profileId);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [giessenLog, setGiessenLog] = useState(() => {
    try {
      const saved = lsGet('giessenLog', profileId);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [duengenLog, setDuengenLog] = useState(() => {
    try {
      const saved = lsGet('duengenLog', profileId);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [standort, setStandort] = useState(() => {
    try {
      const saved = localStorage.getItem('standort');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [wetterDaten, setWetterDaten] = useState(null);
  const [wetterLaedt, setWetterLaedt] = useState(false);
  const [wetterFehler, setWetterFehler] = useState(null);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [settingsOffen, setSettingsOffen] = useState(false);
  const [nameInput, setNameInput] = useState(profileName);
  const [undoStack, setUndoStack] = useState([]);
  const [editingLabel, setEditingLabel] = useState(null);
  const [editingLabelVal, setEditingLabelVal] = useState('');
  const [beetOrder, setBeetOrder] = useState(() => {
    try { return JSON.parse(lsGet('beetOrder', profileId) || 'null'); } catch { return null; }
  });
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('accentColor') || 'green');
  const [kartenAnsicht, setKartenAnsicht] = useState(() => localStorage.getItem('kartenAnsicht') || 'minimal');
  const [kartenLayout, setKartenLayout] = useState(() => localStorage.getItem('kartenLayout') || 'grid');
  const [fontSize, setFontSize] = useState(() => localStorage.getItem('fontSize') || 'md');
  const [pflanzModus, setPflanzModus] = useState(() => localStorage.getItem('pflanzModus') || 'anordnen');
  const [editPflanze, setEditPflanze] = useState(null);
  const [activeTab, setActiveTab] = useState('heute');
  const [ernteEingabe, setErnteEingabe] = useState({});
  // Beete persistent speichern
  useEffect(() => {
    try {
      lsSet('beete', JSON.stringify(beete), profileId);
      lsSet('beetDataVersion', GARDEN_DATA_VERSION, profileId);
    } catch {}
  }, [beete, profileId]);

  useEffect(() => {
    try { lsSet('archivierteBeete', JSON.stringify(archivierteBeete), profileId); } catch {}
  }, [archivierteBeete, profileId]);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('kartenAnsicht', kartenAnsicht);
  }, [kartenAnsicht]);

  useEffect(() => {
    localStorage.setItem('kartenLayout', kartenLayout);
  }, [kartenLayout]);

  useEffect(() => {
    document.documentElement.setAttribute('data-font-size', fontSize);
    localStorage.setItem('fontSize', fontSize);
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem('pflanzModus', pflanzModus);
  }, [pflanzModus]);

  // Systemschema-Änderungen live mitverfolgen (nur wenn kein manueller Override)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => {
      if (localStorage.getItem('darkMode') === null) setDarkMode(e.matches);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // GießenLog persistent speichern
  useEffect(() => {
    try { lsSet('giessenLog', JSON.stringify(giessenLog), profileId); } catch {}
  }, [giessenLog, profileId]);

  useEffect(() => {
    try { lsSet('duengenLog', JSON.stringify(duengenLog), profileId); } catch {}
  }, [duengenLog, profileId]);

  useEffect(() => {
    try { lsSet('pinnedBeete', JSON.stringify([...pinnedBeete]), profileId); } catch {}
  }, [pinnedBeete, profileId]);

  useEffect(() => {
    try { lsSet('beetNotizen', JSON.stringify(beetNotizen), profileId); } catch {}
  }, [beetNotizen, profileId]);

  useEffect(() => {
    try { lsSet('ernteLog', JSON.stringify(ernteLog), profileId); } catch {}
  }, [ernteLog, profileId]);

  useEffect(() => {
    try { if (beetOrder !== null) lsSet('beetOrder', JSON.stringify(beetOrder), profileId); } catch {}
  }, [beetOrder, profileId]);

  // Geo-Location einmalig holen – nur wenn noch kein gespeicherter Standort
  useEffect(() => {
    if (standort) return; // gespeicherten Standort verwenden
    if (!navigator.geolocation) { setWetterFehler('Standort unbekannt'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const s = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setStandort(s);
        try { localStorage.setItem('standort', JSON.stringify(s)); } catch {}
      },
      () => setWetterFehler('Standortzugriff abgelehnt')
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Wetter von Open-Meteo laden (kostenlos, kein API-Key)
  useEffect(() => {
    if (!standort) return;
    setWetterFehler(null);
    fetchWetter(standort.lat, standort.lon, setWetterDaten, setWetterLaedt, setWetterFehler);
  }, [standort]);

  const sorted = useMemo(() => {
    let base = [...beete].sort((a, b) => getStatusPrio(a, selectedDate) - getStatusPrio(b, selectedDate));
    base.sort((a, b) => {
      const ap = pinnedBeete.has(a.beet) ? 0 : 1;
      const bp = pinnedBeete.has(b.beet) ? 0 : 1;
      return ap - bp;
    });
    if (beetFilter === 'faellig') {
      const d = selectedDate;
      base = base.filter(b => { const t = differenceInDays(parseISO(b.faellig), d); return t >= 0 && t <= 14; });
    } else if (beetFilter === 'ernte') {
      base = base.filter(b => b.erntbarIm.includes(format(selectedDate, 'yyyy-MM')));
    } else if (beetFilter === 'giessen') {
      base = base.filter(b => brauchtGiessen(b, selectedDate, giessenLog, wetterDaten).noetig);
    }
    return base;
  }, [beete, selectedDate, pinnedBeete, beetFilter, giessenLog, wetterDaten]);
  const orderedBeete = useMemo(() => {
    if (!beetOrder) return sorted;
    const orderMap = new Map(beetOrder.map((id, i) => [id, i]));
    return [...sorted].sort((a, b) => (orderMap.get(a.beet) ?? 999) - (orderMap.get(b.beet) ?? 999));
  }, [sorted, beetOrder]);
  const sortedArchiv = [...archivierteBeete].sort((a, b) => (b.archiviertAm || '').localeCompare(a.archiviertAm || ''));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const currentOrder = beetOrder || sorted.map(b => b.beet);
    const oldIndex = currentOrder.indexOf(active.id);
    const newIndex = currentOrder.indexOf(over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      setBeetOrder(arrayMove(currentOrder, oldIndex, newIndex));
    }
  }

  function saveSnapshot() {
    setUndoStack(prev => [{ beete, giessenLog, duengenLog }, ...prev].slice(0, 10));
  }

  const importInputRef = useRef(null);

  function validateImportData(data) {
    const ARRAY_KEYS = ['beete', 'archivierteBeete', 'ernteLog', 'pinnedBeete', 'beetOrder'];
    const OBJ_KEYS   = ['giessenLog', 'duengenLog', 'beetNotizen'];
    for (const k of ARRAY_KEYS) {
      if (data[k] !== undefined && !Array.isArray(data[k])) return false;
    }
    for (const k of OBJ_KEYS) {
      if (data[k] !== undefined && (typeof data[k] !== 'object' || Array.isArray(data[k]))) return false;
    }
    return true;
  }

  function handlePrintBeete() {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    const isDark = document.documentElement.classList.contains('dark');
    const rows = sorted.map(beet => {
      const pflanzen = (beet.pflanzen || []).map(p => {
        const n = pflanzeName(p);
        const info = findPflanze(n);
        return `${info?.icon || ''}${n}`;
      }).join(', ');
      const ernte = beet.erntbarIm?.join(', ') || '–';
      const notiz = beetNotizen[beet.beet] || '';
      return `<tr>
        <td>${beet.beet}</td>
        <td>${beet.label || `Beet ${beet.beet}`}</td>
        <td>${pflanzen || '–'}</td>
        <td>${format(parseISO(beet.gepflanzt), 'dd.MM.yyyy')}</td>
        <td>${format(parseISO(beet.faellig), 'dd.MM.yyyy')}</td>
        <td>${ernte}</td>
        <td class="notiz">${notiz}</td>
      </tr>`;
    }).join('');
    printWindow.document.write(`<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>Anbauplanung ${profileName} · ${format(new Date(), 'yyyy')}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; font-size: 12px; color: #111; padding: 24px 32px; }
  h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
  .meta { font-size: 11px; color: #666; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #16a34a; color: #fff; text-align: left; padding: 7px 10px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
  td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  tr:nth-child(even) td { background: #f9fafb; }
  .notiz { font-style: italic; color: #555; font-size: 11px; max-width: 160px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<h1>🌱 Anbauplanung ${profileName}</h1>
<div class="meta">Erstellt am ${format(new Date(), 'dd.MM.yyyy')} · ${sorted.length} Beete</div>
<table>
  <thead><tr>
    <th>#</th><th>Name</th><th>Pflanzen</th><th>Gepflanzt</th><th>Fällig</th><th>Ernte</th><th>Notiz</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 400);
  }

  function handleExport() {
    const exported = exportProfileData(profileId);
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `saisongarten_${profileId}_${format(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('Datei zu groß (max 2 MB)');
      const parsed = JSON.parse(await file.text());
      if (parsed.version !== '1.0' || typeof parsed.data !== 'object' || !parsed.data) throw new Error('Ungültig');
      if (!validateImportData(parsed.data)) throw new Error('Ungültiges Schema');
      if (!window.confirm('Bestehende Daten werden überschrieben. Fortfahren?')) return;
      importProfileData(profileId, parsed);
      window.location.reload();
    } catch (err) {
      alert(`Ungültige Backup-Datei: ${err.message}`);
    } finally {
      if (importInputRef.current) importInputRef.current.value = '';
    }
  }

  function undo() {
    if (undoStack.length === 0) return;
    const [last, ...rest] = undoStack;
    setBeete(last.beete);
    setGiessenLog(last.giessenLog);
    if (last.duengenLog) setDuengenLog(last.duengenLog);
    setUndoStack(rest);
  }

  function removeBeeet(id) {
    const beetToArchive = beete.find(b => b.beet === id);
    if (!beetToArchive) return;

    const confirmed = window.confirm(`Beet ${id} wirklich löschen? Das Beet wird ins Archiv verschoben.`);
    if (!confirmed) return;

    const eingefrorenerStatus = getStatusSnapshot(beetToArchive, selectedDate);
    const archivEintrag = {
      ...beetToArchive,
      archiviertAm: format(new Date(), 'yyyy-MM-dd'),
      eingefrorenAm: format(selectedDate, 'yyyy-MM-dd'),
      eingefrorenerStatus,
    };

    saveSnapshot();
    setBeete(prev => prev.filter(b => b.beet !== id));
    setArchivierteBeete(prev => [archivEintrag, ...prev]);
    setArchivZugeklappt(false);
    setGiessenLog(prev => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setDuengenLog(prev => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function restoreBeeet(id) {
    const archivedBeet = archivierteBeete.find(b => b.beet === id);
    if (!archivedBeet) return;

    const { archiviertAm, eingefrorenAm, eingefrorenerStatus, ...restoredBeet } = archivedBeet;

    setArchivierteBeete(prev => prev.filter(b => b.beet !== id));
    setBeete(prev => [...prev, restoredBeet]);
    setBeeteZugeklappt(false);
  }

  function deleteArchivedBeeet(id) {
    const confirmed = window.confirm(`Archiviertes Beet ${id} endgültig löschen? Diese Aktion kann nicht rückgängig gemacht werden.`);
    if (!confirmed) return;

    setArchivierteBeete(prev => prev.filter(b => b.beet !== id));
  }

  function addBeeet({ pflanzen, gepflanzt, faellig, ernte, naechste, erntbarIm }) {
    saveSnapshot();
    const nextId = Math.max(0, ...beete.map(b => b.beet), ...archivierteBeete.map(b => b.beet)) + 1;
    setBeete(prev => [...prev, { beet: nextId, pflanzen, gepflanzt, faellig, ernte, naechste, erntbarIm }]);
  }

  function updateBeetLabel(beetId, newLabel) {
    const trimmed = newLabel.trim();
    setBeete(prev => prev.map(b => b.beet === beetId ? { ...b, label: trimmed || `Beet ${beetId}` } : b));
    setEditingLabel(null);
  }

  function updatePflanzenInBeet(beetId, neuePflanzen) {
    setBeete(prev => prev.map(b => b.beet === beetId ? { ...b, pflanzen: neuePflanzen } : b));
  }

  function updateBeeetPflanzen(id, newPflanzen, newNaechste, newGepflanzt, newFaellig) {
    saveSnapshot();
    setBeete(prev => prev.map(b => {
      if (b.beet !== id) return b;
      const gepflanzt = newGepflanzt !== undefined ? newGepflanzt : b.gepflanzt;
      const faellig = newFaellig !== undefined ? newFaellig : b.faellig;
      const erntbarIm = computeErntbarIm(gepflanzt, newPflanzen);
      const infos = newPflanzen.map(p => findPflanze(p)).filter(Boolean);
      const ernte = infos.length ? [...new Set(infos.map(i => i.ernteBeschreibung))].join(', ') : b.ernte;
      const naechste = newNaechste !== undefined ? newNaechste : (infos.length ? infos[0].naechsteKultur : b.naechste);
      return { ...b, pflanzen: newPflanzen, gepflanzt, faellig, erntbarIm, ernte, naechste };
    }));
  }

  function handleGiessen(beetId, date) {
    saveSnapshot();
    const dateStr = format(date, 'yyyy-MM-dd');
    setGiessenLog(prev => {
      const current = prev[beetId] || [];
      return current.includes(dateStr)
        ? { ...prev, [beetId]: current.filter(d => d !== dateStr) }
        : { ...prev, [beetId]: [...current, dateStr] };
    });
  }

  function handleAlleGiessen(beetIds) {
    saveSnapshot();
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    setGiessenLog(prev => {
      const next = { ...prev };
      for (const id of beetIds) {
        const current = next[id] || [];
        if (!current.includes(dateStr)) next[id] = [...current, dateStr];
      }
      return next;
    });
  }

  function handleDuengen(beetId, date) {
    saveSnapshot();
    const dateStr = format(date, 'yyyy-MM-dd');
    setDuengenLog(prev => {
      const current = prev[beetId] || [];
      return current.includes(dateStr)
        ? { ...prev, [beetId]: current.filter(d => d !== dateStr) }
        : { ...prev, [beetId]: [...current, dateStr] };
    });
  }

  function handleAlleDuengen(beetIds) {
    saveSnapshot();
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    setDuengenLog(prev => {
      const next = { ...prev };
      for (const id of beetIds) {
        const current = next[id] || [];
        if (!current.includes(dateStr)) next[id] = [...current, dateStr];
      }
      return next;
    });
  }

  function togglePin(beetId) {
    setPinnedBeete(prev => {
      const n = new Set(prev);
      n.has(beetId) ? n.delete(beetId) : n.add(beetId);
      return n;
    });
  }

  function setNotiz(beetId, text) {
    setBeetNotizen(prev => ({ ...prev, [beetId]: text }));
  }

  function handleErnte(beetId, pflanze, menge = null, einheit = 'Stück') {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const key = `${beetId}_${pflanze}`;
    setErnteLog(prev => {
      const exists = prev.some(e => e.beetId === beetId && e.pflanze === pflanze && e.datum === dateStr);
      if (exists) return prev.filter(e => !(e.beetId === beetId && e.pflanze === pflanze && e.datum === dateStr));
      const mengeNum = menge !== null && menge !== '' ? Number(menge) : null;
      return [{ beetId, pflanze, datum: dateStr, menge: mengeNum, einheit: mengeNum != null ? einheit : undefined }, ...prev];
    });
    setErnteEingabe(prev => { const n = { ...prev }; delete n[key]; return n; });
  }

  function handleOrtsWahl(stadt) {
    const s = { lat: stadt.lat, lon: stadt.lon, name: stadt.name };
    try { localStorage.setItem('standort', JSON.stringify(s)); } catch {}
    setStandort(s);
    setWetterFehler(null);
  }

  function retryWetter() {
    setWetterFehler(null);
    if (standort) {
      fetchWetter(standort.lat, standort.lon, setWetterDaten, setWetterLaedt, setWetterFehler);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setStandort({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => setWetterFehler('Standortzugriff abgelehnt')
      );
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100 transition-colors pb-16">

      {/* Kompakter Header + Toolbar in einer Zeile */}
      <div className="max-w-7xl mx-auto px-4 pt-5 pb-3 flex flex-col sm:flex-row items-center sm:items-center justify-between gap-3">
        {/* Titel + Profil-Avatar */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-green-600 to-emerald-500 dark:from-green-400 dark:to-emerald-300 bg-clip-text text-transparent select-none">🌱 Saisongarten</span>
          <span className="text-xs text-gray-400 dark:text-gray-500 font-normal hidden sm:inline">2026</span>
          {/* Profil-Wechsler */}
          <button
            onClick={onSwitchProfile}
            title={`Profil wechseln (${profileName})`}
            className="flex items-center gap-1.5 ml-1 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm hover:ring-2 hover:ring-green-400 transition-all text-xs text-gray-600 dark:text-gray-300"
          >
            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[10px] font-bold ${
              profileColor === 'orange' ? 'bg-orange-500' :
              profileColor === 'blue'   ? 'bg-blue-500' :
              profileColor === 'violet' ? 'bg-violet-500' :
              profileColor === 'rose'   ? 'bg-rose-500' :
              profileColor === 'teal'   ? 'bg-teal-500' :
              'bg-green-500'
            }`}>
              {(profileName || '?').slice(0, 2).toUpperCase()}
            </span>
            <span className="hidden sm:inline">{profileName}</span>
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Datumsauswahl */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 shadow-sm">
            <span className="text-xs text-gray-400 dark:text-gray-500 select-none">📅</span>
            <input
              type="date"
              value={format(selectedDate, 'yyyy-MM-dd')}
              onChange={e => { if (e.target.value) setSelectedDate(new Date(e.target.value)); }}
              className="text-sm font-medium bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none"
              style={{ minWidth: 130 }}
            />
            <button
              className="text-[11px] text-green-600 dark:text-green-400 hover:underline ml-0.5 whitespace-nowrap"
              onClick={() => setSelectedDate(new Date())}
            >
              Heute
            </button>
          </div>

          {profileId === 'mustergarten' && (
            <button
              onClick={() => setPdfOffen(true)}
              className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-300 flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm transition-colors"
              title="Anbauplanung PDF öffnen"
            >
              📄 PDF
            </button>
          )}

          <button
            onClick={handlePrintBeete}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-300 flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm transition-colors"
            title="Beete als PDF drucken / exportieren"
          >
            🖨 Drucken
          </button>

          <button
            onClick={handleExport}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm transition-colors"
            title="Gartendaten exportieren (JSON-Backup)"
          >
            💾 Export
          </button>
          <label
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm transition-colors cursor-pointer"
            title="Gartendaten importieren (JSON-Backup)"
          >
            📥 Import
            <input ref={importInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          </label>

          {/* Dark-Mode-Toggle */}
          <button
            onClick={() => setDarkMode(d => !d)}
            title={darkMode ? 'Hell' : 'Dunkel'}
            className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm transition-colors"
            aria-label="Dark Mode umschalten"
          >
            <span className="select-none">{darkMode ? '🌙' : '☀️'}</span>
          </button>

          {/* Rückgängig */}
          {undoStack.length > 0 && (
            <button
              onClick={undo}
              title={`Rückgängig (${undoStack.length})`}
              className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm transition-colors"
              aria-label="Rückgängig"
            >
              ↩ {undoStack.length}
            </button>
          )}
          {/* Einstellungen */}
          <button
            onClick={() => setSettingsOffen(o => !o)}
            title="Einstellungen"
            className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm transition-colors"
            aria-label="Einstellungen"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Einstellungs-Panel */}
      {settingsOffen && (
        <div className="max-w-7xl mx-auto px-4 mb-4">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">⚙️ Einstellungen</span>
              <button onClick={() => setSettingsOffen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm">✕</button>
            </div>
            {/* Kartenansicht */}
            <div className="mb-4">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Karteninhalt</div>
              <div className="flex gap-2">
                {[
                  { key: 'minimal', label: '▤ Minimal', desc: 'Ohne Pflanzen' },
                  { key: 'detail', label: '▦ Detail', desc: 'Mit Pflanzen' },
                ].map(({ key, label, desc }) => (
                  <button
                    key={key}
                    onClick={() => setKartenAnsicht(key)}
                    className={`flex-1 flex flex-col items-center px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                      kartenAnsicht === key
                        ? 'bg-green-600 text-white border-transparent'
                        : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <span className="text-base mb-0.5">{label}</span>
                    <span className={`text-[10px] font-normal ${kartenAnsicht === key ? 'opacity-80' : 'text-gray-400 dark:text-gray-500'}`}>{desc}</span>
                  </button>
                ))}
              </div>
            </div>
            {/* Kartenlayout */}
            <div className="mb-4">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Anordnung</div>
              <div className="flex gap-2">
                {[
                  { key: 'grid', label: '⋮⋮ Grid', desc: 'Mehrere Spalten' },
                  { key: 'horizontal', label: '↔ Horizontal', desc: 'Scroll nach rechts' },
                  { key: 'list', label: '☰ Liste', desc: 'Untereinander' },
                ].map(({ key, label, desc }) => (
                  <button
                    key={key}
                    onClick={() => setKartenLayout(key)}
                    className={`flex-1 flex flex-col items-center px-2 py-2 rounded-lg border text-xs font-medium transition-colors ${
                      kartenLayout === key
                        ? 'bg-green-600 text-white border-transparent'
                        : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <span className="text-base mb-0.5 whitespace-nowrap">{label}</span>
                    <span className={`text-[10px] font-normal whitespace-nowrap ${kartenLayout === key ? 'opacity-80' : 'text-gray-400 dark:text-gray-500'}`}>{desc}</span>
                  </button>
                ))}
              </div>
            </div>
            {/* Pflanzendarstellung */}
            <div className="mb-4">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Pflanzendarstellung</div>
              <div className="flex gap-2">
                {[
                  { key: 'anordnen', label: '⠿ Anordnen', desc: 'Grid + DnD' },
                  { key: 'bearbeiten', label: '✏️ Bearbeiten', desc: 'Details + Edit' },
                ].map(({ key, label, desc }) => (
                  <button
                    key={key}
                    onClick={() => setPflanzModus(key)}
                    className={`flex-1 flex flex-col items-center px-2 py-2 rounded-lg border text-xs font-medium transition-colors ${
                      pflanzModus === key
                        ? 'bg-green-600 text-white border-transparent'
                        : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <span className="text-base mb-0.5 whitespace-nowrap">{label}</span>
                    <span className={`text-[10px] font-normal whitespace-nowrap ${pflanzModus === key ? 'opacity-80' : 'text-gray-400 dark:text-gray-500'}`}>{desc}</span>
                  </button>
                ))}
              </div>
            </div>
            {/* Legende Kartenumrandung */}
            <div className="mb-4">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Legende Umrandung</div>
              <div className="space-y-1.5">
                {(() => {
                  const giessIntervalle = pflanzDatenbank.map(p => p.giessIntervall).filter(Boolean);
                  const minInt = Math.min(...giessIntervalle);
                  const maxInt = Math.max(...giessIntervalle);
                  return [
                    { ring: 'ring-2 ring-red-500', label: 'Pflanzenkonflikt', desc: 'Unverträgliche Nachbarn im Beet' },
                    { ring: 'ring-2 ring-green-500', label: 'Gute Nachbarn', desc: 'Pflanzen ergänzen sich gut' },
                    { ring: 'ring-2 ring-amber-400', label: 'Erntezeit', desc: 'Aktuelle Ernte möglich' },
                    { ring: 'ring-2 ring-red-400', label: 'Termin fällig', desc: 'Räumungsdatum in ≤14 Tagen' },
                    { ring: 'ring-2 ring-cyan-500', label: 'Gießen nötig', desc: `je nach Pflanze alle ${minInt}–${maxInt} Tage · Regentage & Hitze (+28°) werden berücksichtigt` },
                  ];
                })().map(({ ring, label, desc }) => (
                  <div key={label} className="flex items-center gap-2.5">
                    <span className={`shrink-0 w-5 h-5 rounded ${ring} bg-white dark:bg-gray-800`} />
                    <span className="text-xs text-gray-700 dark:text-gray-300 leading-tight">
                      <span className="font-medium">{label}</span>
                      <span className="text-gray-400 dark:text-gray-500"> – {desc}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {/* Schriftgröße */}
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Schriftgröße</div>
              <div className="flex gap-2">
                {[
                  { key: 'sm', label: 'S – Kompakt' },
                  { key: 'md', label: 'M – Standard' },
                  { key: 'lg', label: 'L – Groß' },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setFontSize(key)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      fontSize === key
                        ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 border-transparent'
                        : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {/* Profil-Name */}
            {onRenameProfile && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Profil-Name</div>
                <div className="flex gap-2">
                  <input
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { onRenameProfile(nameInput); setSettingsOffen(false); } }}
                    className="flex-1 text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-green-400"
                    placeholder="Dein Name"
                  />
                  <button
                    onClick={() => { onRenameProfile(nameInput); setSettingsOffen(false); }}
                    disabled={!nameInput.trim() || nameInput.trim() === profileName}
                    className="text-xs px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-40"
                  >
                    Speichern
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'heute' && (
        <>
          <WetterStreifen
            wetterDaten={wetterDaten}
            wetterLaedt={wetterLaedt}
            wetterFehler={wetterFehler}
            standort={standort}
            selectedDate={selectedDate}
            onRetry={retryWetter}
            onOrtsWahl={handleOrtsWahl}
          />
          <TagesAufgaben beete={beete} selectedDate={selectedDate} giessenLog={giessenLog} duengenLog={duengenLog} wetterDaten={wetterDaten} onGiessenAlle={handleAlleGiessen} onDuengen={handleDuengen} />
        </>
      )}

      {activeTab === 'kalender' && (
        <KalenderTab beete={beete} ernteLog={ernteLog} selectedDate={selectedDate} />
      )}

      {activeTab === 'chatbot' && (
        <div className="fixed inset-x-0 z-30 flex flex-col" style={{ top: 64, bottom: 56 }}>
          <Chatbot beete={beete} selectedDate={selectedDate} onGiessen={handleGiessen} onDuengen={handleDuengen} onUpdateBeet={(beetId, pflanzen) => updateBeeetPflanzen(beetId, pflanzen, undefined)} isTab />
        </div>
      )}

      {activeTab === 'beete' && <main className="max-w-7xl mx-auto px-4 pb-10">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setBeeteZugeklappt(z => !z)}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <span className={`inline-block transition-transform duration-150 text-[10px] ${beeteZugeklappt ? '' : 'rotate-90'}`}>▶</span>
            🌱 Beete ({sorted.length})
          </button>
          {/* Filter-Pills */}
          {!beeteZugeklappt && (
            <div className="flex gap-1.5 flex-wrap ml-2">
              {[
                { key: 'alle', label: 'Alle' },
                { key: 'faellig', label: '⚠️ Fällig' },
                { key: 'ernte', label: '🌾 Ernte' },
                { key: 'giessen', label: '💧 Gießen' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setBeetFilter(f.key)}
                  className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${
                    beetFilter === f.key
                      ? 'bg-green-700 dark:bg-green-600 text-white border-transparent'
                      : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-gray-500'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {!beeteZugeklappt && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={(beetOrder || sorted.map(b => b.beet))} strategy={rectSortingStrategy}>
          <div className={kartenLayout === 'horizontal'
            ? 'flex flex-row gap-3 overflow-x-auto pb-3 -mx-4 px-4 snap-x snap-mandatory items-start'
            : kartenLayout === 'list'
            ? 'flex flex-col gap-3'
            : 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4'
          }>
            {orderedBeete.map((beet) => {
              const isErntemonat = beet.erntbarIm.includes(format(selectedDate, 'yyyy-MM'));
              const faelligTage = differenceInDays(parseISO(beet.faellig), selectedDate);
              const isFaellig = faelligTage >= 0 && faelligTage <= 14;
              const giessStatus = brauchtGiessen(beet, selectedDate, giessenLog, wetterDaten);
              const isExpanded = expandedBeet === beet.beet;
              const pflanzenNamen = (beet.pflanzen || []).map(pflanzeName);
              const hasKonflikt = pflanzenNamen.length > 1 && pflanzenNamen.some((a, i) => {
                const infoA = findPflanze(a);
                if (!infoA) return false;
                return pflanzenNamen.some((b, j) => j > i && infoA.schlecht.some(s => s.toLowerCase() === b.toLowerCase()));
              });
              const hasGutNachbar = !hasKonflikt && pflanzenNamen.length > 1 && pflanzenNamen.some((a, i) => {
                const infoA = findPflanze(a);
                if (!infoA) return false;
                return pflanzenNamen.some((b, j) => j > i && infoA.gut.some(g => g.toLowerCase() === b.toLowerCase()));
              });
              return (
              <SortableBeetSlot key={beet.beet} id={beet.beet} kartenLayout={kartenLayout}>
                {(dragListeners) => (<>
                <Dialog>
                  <Card
                    className={`transition flex flex-col ${
                      hasKonflikt
                        ? 'ring-2 ring-red-500 shadow-lg shadow-red-100 dark:shadow-red-900/40'
                        : hasGutNachbar
                        ? 'ring-2 ring-green-500 shadow-lg shadow-green-100 dark:shadow-green-900/40'
                        : isFaellig
                        ? 'ring-2 ring-red-400 shadow-lg shadow-red-100 dark:shadow-red-900/40'
                        : isErntemonat
                        ? 'ring-2 ring-amber-400 shadow-lg shadow-amber-100 dark:shadow-amber-900/40'
                        : giessStatus.noetig
                        ? 'ring-2 ring-cyan-500 shadow-lg shadow-cyan-100 dark:shadow-cyan-900/40'
                        : ''
                    }`}
                  >
                    {isErntemonat && !isFaellig && (
                      <div className="rounded-t-xl bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-700 px-3 py-1.5 text-sm font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                        🌾 Erntezeit
                      </div>
                    )}
                    <CardHeader>
                      {/* Headline: Kreis + Label + Status */}
                      <div className="flex items-center gap-2.5">
                        <button {...dragListeners} className="shrink-0 px-0.5 text-gray-400 dark:text-gray-600 cursor-grab active:cursor-grabbing touch-none select-none text-base" title="Ziehen zum Sortieren" aria-label="Beet verschieben">⠿</button>
                        <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-green-200 dark:bg-green-800 font-bold text-green-800 dark:text-green-200 text-lg shadow-sm border border-green-300 dark:border-green-700 shrink-0">
                          {beet.beet}
                        </span>
                        <div className="flex-1 min-w-0">
                          {editingLabel === beet.beet ? (
                            <input
                              autoFocus
                              value={editingLabelVal}
                              onChange={e => setEditingLabelVal(e.target.value)}
                              onBlur={() => updateBeetLabel(beet.beet, editingLabelVal)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') { e.preventDefault(); updateBeetLabel(beet.beet, editingLabelVal); }
                                if (e.key === 'Escape') setEditingLabel(null);
                              }}
                              onClick={e => e.stopPropagation()}
                              className="text-base font-semibold text-gray-900 dark:text-gray-100 bg-transparent border-b-2 border-green-400 focus:outline-none w-full leading-tight"
                            />
                          ) : (
                            <button
                              onClick={e => { e.stopPropagation(); setEditingLabelVal(beet.label || `Beet ${beet.beet}`); setEditingLabel(beet.beet); }}
                              className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-tight truncate text-left w-full hover:text-green-700 dark:hover:text-green-400 transition-colors"
                              title="Name bearbeiten"
                            >
                              {beet.label || `Beet ${beet.beet}`}
                            </button>
                          )}
                          <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                            {getStatusBadge(beet, selectedDate)}
                            {beetNotizen[beet.beet] && (
                              <span className="text-amber-500 text-xs" title={beetNotizen[beet.beet]}>📝</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Datum-Zeile */}
                      <div className="mt-2.5 flex gap-3 flex-wrap">
                        <span className="text-sm text-gray-600 dark:text-gray-300">📅 {format(parseISO(beet.gepflanzt), 'dd.MM.')}</span>
                        <span className="text-sm text-gray-600 dark:text-gray-300">🔚 {format(parseISO(beet.faellig), 'dd.MM.')}</span>
                      </div>
                      {/* Aktions-Zeile */}
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {giessStatus.noetig && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 text-sm border border-cyan-300 dark:border-cyan-600">
                            💧 Gießen nötig
                          </span>
                        )}
                        {beet.naechste && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm border border-blue-200 dark:border-blue-700">
                            🔄 {beet.naechste}
                          </span>
                        )}
                      </div>
                      {/* Detail-Ansicht: Pflanzenliste */}
                      {kartenAnsicht === 'detail' && beet.pflanzen?.length > 0 && (
                        <div className="mt-2">
                          <PflanzenBadges pflanzen={beet.pflanzen} gepflanzt={beet.gepflanzt} selectedDate={selectedDate} />
                        </div>
                      )}
                      {/* Footer: ▼ Mehr + 📋 Details + × Löschen */}
                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 dark:border-gray-700 pt-2.5">
                        <button
                          onClick={() => setExpandedBeet(prev => prev === beet.beet ? null : beet.beet)}
                          className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 transition-colors py-1"
                          aria-expanded={isExpanded}
                        >
                          <span className={`text-[10px] transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                          {isExpanded ? 'Weniger' : 'Mehr'}
                        </button>
                        <div className="flex items-center gap-1">
                          <DialogTrigger asChild>
                            <button
                              className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors py-1 px-1"
                              title="Details & Bearbeiten"
                              aria-label={`Beet ${beet.beet} bearbeiten`}
                            >
                              📋 Details
                            </button>
                          </DialogTrigger>
                        </div>
                      </div>
                      {/* Inline-Expand */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2.5">
                          <PflanzenGrid
                            pflanzen={beet.pflanzen || []}
                            modus={pflanzModus}
                            selectedDate={selectedDate}
                            giessenLog={giessenLog}
                            wetterDaten={wetterDaten}
                            beetId={beet.beet}
                            onPflanzenChange={neuePflanzen => updatePflanzenInBeet(beet.beet, neuePflanzen)}
                            onEditPflanze={pflanze => setEditPflanze({ beetId: beet.beet, pflanze })}
                            onAddPflanze={() => setEditPflanze({ beetId: beet.beet, pflanze: null })}
                          />
                          {beet.pflanzen?.length > 0 && (
                            <PflanzenBadges pflanzen={beet.pflanzen} gepflanzt={beet.gepflanzt} selectedDate={selectedDate} />
                          )}
                          {/* Ernte markieren */}
                          {(() => {
                            const heuteDatum = format(selectedDate, 'yyyy-MM-dd');
                            const erntereif = (beet.pflanzen || []).filter(p => {
                              const name = pflanzeName(p);
                              const info = findPflanze(name);
                              if (!info) return false;
                              const start = addMonths(parseISO(beet.gepflanzt), info.ernteanfangOffset);
                              return selectedDate >= start && selectedDate <= addMonths(start, info.erntedauer);
                            });
                            if (erntereif.length === 0) return null;
                            return (
                              <div className="space-y-1.5">
                                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">🌾 Ernte markieren:</div>
                                <div className="flex flex-col gap-2">
                                  {erntereif.map(p => {
                                    const name = pflanzeName(p);
                                    const info = findPflanze(name);
                                    const istGeerntet = ernteLog.some(e => e.beetId === beet.beet && e.pflanze === name && e.datum === heuteDatum);
                                    const eintrag = ernteLog.find(e => e.beetId === beet.beet && e.pflanze === name && e.datum === heuteDatum);
                                    const key = `${beet.beet}_${name}`;
                                    const eingabe = ernteEingabe[key] || { menge: '', einheit: 'Stück' };
                                    const zeigFormular = !istGeerntet && ernteEingabe[key] !== undefined;
                                    return (
                                      <div key={name} className="flex flex-col gap-1">
                                        {istGeerntet ? (
                                          <div className="flex items-center gap-2">
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border bg-teal-100 dark:bg-teal-900/50 border-teal-400 text-teal-700 dark:text-teal-300">
                                              {info?.icon || '🌾'} {name} ✓
                                              {eintrag?.menge != null && <span className="font-semibold ml-1">{eintrag.menge} {eintrag.einheit}</span>}
                                            </span>
                                            <button
                                              onClick={e => { e.stopPropagation(); handleErnte(beet.beet, name); }}
                                              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                                              title="Rückgängig"
                                            >↩</button>
                                          </div>
                                        ) : zeigFormular ? (
                                          <div className="flex items-center gap-1.5 flex-wrap" onClick={e => e.stopPropagation()}>
                                            <span className="text-xs text-gray-600 dark:text-gray-300">{info?.icon} {name}</span>
                                            <input
                                              type="number"
                                              min="0"
                                              step="0.1"
                                              placeholder="Menge"
                                              value={eingabe.menge}
                                              onChange={e => setErnteEingabe(prev => ({ ...prev, [key]: { ...eingabe, menge: e.target.value } }))}
                                              onClick={e => e.stopPropagation()}
                                              className="w-20 text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-teal-400"
                                            />
                                            <select
                                              value={eingabe.einheit}
                                              onChange={e => setErnteEingabe(prev => ({ ...prev, [key]: { ...eingabe, einheit: e.target.value } }))}
                                              onClick={e => e.stopPropagation()}
                                              className="text-xs px-1.5 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none"
                                            >
                                              <option>Stück</option>
                                              <option>kg</option>
                                              <option>Bund</option>
                                              <option>g</option>
                                            </select>
                                            <button
                                              onClick={e => { e.stopPropagation(); handleErnte(beet.beet, name, eingabe.menge, eingabe.einheit); }}
                                              className="text-xs px-2 py-1 rounded bg-teal-600 hover:bg-teal-700 text-white transition-colors"
                                            >✓ OK</button>
                                            <button
                                              onClick={e => { e.stopPropagation(); setErnteEingabe(prev => { const n = { ...prev }; delete n[key]; return n; }); }}
                                              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                            >✕</button>
                                          </div>
                                        ) : (
                                          <button
                                            onClick={e => { e.stopPropagation(); setErnteEingabe(prev => ({ ...prev, [key]: { menge: '', einheit: 'Stück' } })); }}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-teal-400 hover:text-teal-700 dark:hover:text-teal-400 transition-colors w-fit"
                                            title="Ernte eintragen"
                                          >
                                            {info?.icon || '🌾'} {name} + Ernte
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}
                          {beet.ernte && (
                            <div className="text-sm text-gray-600 dark:text-gray-300">🌾 Ernte: {beet.ernte}</div>
                          )}
                          {giessStatus.grund && (
                            <div className={`text-sm ${giessStatus.noetig ? 'text-cyan-700 dark:text-cyan-300' : 'text-gray-500 dark:text-gray-400'}`}>
                              💧 {giessStatus.grund}
                            </div>
                          )}
                          {/* Notiz */}
                          <div className="space-y-1">
                            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">📝 Notiz</div>
                            <textarea
                              value={beetNotizen[beet.beet] || ''}
                              onChange={e => { e.stopPropagation(); setNotiz(beet.beet, e.target.value); }}
                              onClick={e => e.stopPropagation()}
                              placeholder="Notiz zu diesem Beet…"
                              rows={2}
                              className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 resize-none focus:outline-none focus:ring-1 focus:ring-green-400"
                            />
                          </div>
                        </div>
                      )}
                    </CardHeader>
                  </Card>
                  <DialogContent className="max-w-lg flex flex-col max-h-[90vh]">
                    <DialogHeader className="shrink-0">
                      <DialogTitle>{beet.label || `Beet ${beet.beet}`} – Details</DialogTitle>
                    </DialogHeader>
                    <div className="overflow-y-auto flex-1 pr-1">
                      {beet.reihen?.length > 0 && (
                        <div className="pb-3 mb-3 border-b border-gray-200 dark:border-gray-700">
                          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Reihenbelegung</div>
                          <ReihenAnzeige beet={beet} />
                        </div>
                      )}
                      <DialogPlantManager
                        beet={beet}
                        selectedDate={selectedDate}
                        onUpdate={({ pflanzen, naechste, gepflanzt, faellig }) => updateBeeetPflanzen(beet.beet, pflanzen, naechste, gepflanzt, faellig)}
                        giessenLog={giessenLog}
                        wetterDaten={wetterDaten}
                        onGiessen={handleGiessen}
                      />
                    </div>
                  </DialogContent>
                </Dialog>
                <button
                  onClick={() => removeBeeet(beet.beet)}
                  className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 text-red-600 dark:text-red-300 text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  title="Beet entfernen"
                >×</button>
              </>)}
              </SortableBeetSlot>
              );
            })}
            {/* Neues Beet am Ende des Scroll-Containers */}
            <div className={
              kartenLayout === 'list' ? 'w-full' :
              kartenLayout === 'grid' ? 'w-auto min-w-0' :
              'w-72 flex-none snap-start'
            }>
              <AddBeetDialog onAdd={addBeeet} selectedDate={selectedDate} />
            </div>
          </div>
          </SortableContext>
          </DndContext>
        )}

        <PflanzeEditDialog
          open={editPflanze !== null}
          pflanze={editPflanze?.pflanze ?? null}
          onSave={saved => {
            if (!editPflanze) return;
            const { beetId, pflanze: alt } = editPflanze;
            const beet = beete.find(b => b.beet === beetId);
            if (!beet) return;
            const neu = alt
              ? beet.pflanzen.map(p => (p.id === alt.id ? saved : p))
              : [...beet.pflanzen, saved];
            updatePflanzenInBeet(beetId, neu);
            setEditPflanze(null);
          }}
          onDelete={() => {
            if (!editPflanze?.pflanze) return;
            const { beetId, pflanze: alt } = editPflanze;
            const beet = beete.find(b => b.beet === beetId);
            if (!beet) return;
            updatePflanzenInBeet(beetId, beet.pflanzen.filter(p => p.id !== alt.id));
            setEditPflanze(null);
          }}
          onClose={() => setEditPflanze(null)}
        />

        <div className="mt-8">
          <div className="flex items-center gap-1.5 mb-4">
            <button
              onClick={() => setArchivZugeklappt(z => !z)}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <span className={`inline-block transition-transform duration-150 text-[10px] ${archivZugeklappt ? '' : 'rotate-90'}`}>▶</span>
              🗄️ Archiv ({sortedArchiv.length})
            </button>
          </div>

          {!archivZugeklappt && (
            sortedArchiv.length > 0 ? (
              <div className="flex flex-row gap-3 overflow-x-auto pb-3 -mx-4 px-4 snap-x snap-mandatory sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 sm:gap-4 sm:overflow-x-visible sm:pb-0 sm:mx-0 sm:px-0 items-start">
                {sortedArchiv.map((beet) => {
                  const eingefrorenAmDate = beet.eingefrorenAm ? parseISO(beet.eingefrorenAm) : null;
                  const archiviertAmDate = beet.archiviertAm ? parseISO(beet.archiviertAm) : null;
                  const eingefrorenAm = eingefrorenAmDate && !Number.isNaN(eingefrorenAmDate.getTime())
                    ? format(eingefrorenAmDate, 'dd.MM.yyyy')
                    : 'unbekannt';
                  const archiviertAm = archiviertAmDate && !Number.isNaN(archiviertAmDate.getTime())
                    ? format(archiviertAmDate, 'dd.MM.yyyy')
                    : 'unbekannt';
                  const statusSnapshot = beet.eingefrorenerStatus || getStatusSnapshot(beet, selectedDate);
                  return (
                    <div key={`archiv-${beet.beet}`} className="w-72 flex-none snap-start sm:w-auto">
                    <Card className="border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/40">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 font-bold text-gray-700 dark:text-gray-200 text-base shadow-sm border border-gray-300 dark:border-gray-600 shrink-0">
                            {beet.beet}
                          </span>
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 leading-tight">
                            {beet.label || `Beet ${beet.beet}`}
                          </span>
                        </CardTitle>

                        <div className="flex flex-wrap gap-1 mt-1">
                          {(beet.pflanzen || []).map((p) => {
                            const info = findPflanze(p);
                            return (
                              <span key={p} className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                                {info?.icon} {p}
                              </span>
                            );
                          })}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-1 items-center">
                          {getFrozenStatusBadge(statusSnapshot)}
                        </div>
                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">Status eingefroren am: {eingefrorenAm}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Ins Archiv verschoben am: {archiviertAm}</div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            onClick={() => restoreBeeet(beet.beet)}
                            className="text-xs px-2.5 py-1 rounded border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                            title="Beet zurück in den aktiven Bereich verschieben"
                          >
                            ↩ Wiederherstellen
                          </button>
                          <button
                            onClick={() => deleteArchivedBeeet(beet.beet)}
                            className="text-xs px-2.5 py-1 rounded border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                            title="Beet dauerhaft löschen"
                          >
                            🗑 Endgültig löschen
                          </button>
                        </div>
                      </CardHeader>
                    </Card>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-gray-500 dark:text-gray-400 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 px-3 py-2">
                Noch keine archivierten Beete.
              </div>
            )
          )}
        </div>

      </main>}

      <footer className="text-center py-6 text-xs text-gray-500 dark:text-gray-400">
        &copy; 2026 Saisongarten App
      </footer>

      {activeTab !== 'chatbot' && (
        <Chatbot beete={beete} selectedDate={selectedDate} onGiessen={handleGiessen} onDuengen={handleDuengen} onUpdateBeet={(beetId, pflanzen) => updateBeeetPflanzen(beetId, pflanzen, undefined)} />
      )}

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* PDF-Overlay */}
      {pdfOffen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex flex-col"
          onClick={e => { if (e.target === e.currentTarget) setPdfOffen(false); }}
        >
          <div className="flex items-center justify-between px-4 py-2 bg-gray-900 text-white shrink-0">
            <span className="font-semibold text-sm">📄 Anbauplanung 2026</span>
            <div className="flex items-center gap-3">
              <a
                href="/Anbauplanung_2026.pdf"
                download
                className="text-blue-300 hover:text-blue-100 text-xs underline"
              >
                Herunterladen
              </a>
              <button
                onClick={() => setPdfOffen(false)}
                className="text-gray-300 hover:text-white text-xl font-bold leading-none"
                aria-label="Schließen"
              >
                ×
              </button>
            </div>
          </div>
          <iframe
            src="/Anbauplanung_2026.pdf"
            className="flex-1 w-full"
            title="Anbauplanung 2026"
          />
        </div>
      )}
    </div>
  );
}

export default App;
import React, { useState, useRef, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { pflanzDatenbank, findPflanze, getNeighborRelation } from '../data/plantDatabase';

const DE_MONATE = ['', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

function findPflanzeInBeete(name, beete) {
  if (!beete) return null;
  const lc = name.toLowerCase().trim();
  for (const beet of beete) {
    const found = (beet.pflanzen || []).find(p => {
      if (typeof p === 'string') return p.toLowerCase() === lc;
      return p.name.toLowerCase() === lc || (p.name.toLowerCase().includes(lc) && lc.length >= 4);
    });
    if (found && typeof found === 'object') return { ...found, beetLabel: beet.label };
  }
  return null;
}

// ── Regelmaschine ─────────────────────────────────────────────────────────────

function antwort(text, beete, selectedDate) {
  const lc = text.toLowerCase().trim();
  const monat = selectedDate.getMonth() + 1;
  const monatName = DE_MONATE[monat];

  // ── Pflanzzeit abfragen ─────
  const pflanzMatch = lc.match(/wann (?:pflanz|s[äa]|pflanzen|s[äa]en|anbauen|aus(?:s[äa]en)?)(?:e ich)?\s+(.+?)[\?\s]*$/);
  const wannPflanzPflanze = pflanzMatch
    ? findPflanze(pflanzMatch[1].trim())
    : lc.match(/pflanzzeit|wann pflanzen|wann s[äa]en/) ? null : null;

  if (pflanzMatch) {
    const suchName = pflanzMatch[1].trim();
    const beetEntry = findPflanzeInBeete(suchName, beete);
    const info = beetEntry || findPflanze(suchName);
    if (info) {
      const monate = (info.pflanzMonate || []).map(m => DE_MONATE[m]).join(', ');
      const hinweis = info.hinweis ? `\n\n💡 ${info.hinweis}` : '';
      return `${info.icon} **${info.name}** wird am besten in folgenden Monaten gepflanzt: **${monate || '–'}**.${hinweis}`;
    }
    return `Ich habe „${suchName}" nicht in meiner Datenbank. Versuche es mit dem genauen Gemüsenamen.`;
  }

  // ── Erntezeit abfragen ─────
  const ernteMatch = lc.match(/wann (?:ernte|ernten|geerntet)(?:e ich)?\s+(.+?)[\?\s]*$/) ||
    lc.match(/ernte(?:zeit)?\s+(?:von |bei )?\s*(.+?)[\?\s]*$/);
  if (ernteMatch) {
    const suchName = ernteMatch[1].trim();
    const beetEntry = findPflanzeInBeete(suchName, beete);
    const info = beetEntry || findPflanze(suchName);
    if (info) {
      const ernte = beetEntry?.ernte || info.ernteBeschreibung || '–';
      const naechste = beetEntry?.naechsteKultur || info.naechsteKultur || '–';
      const beetHinweis = beetEntry?.beetLabel ? ` (in ${beetEntry.beetLabel})` : '';
      return `${info.icon} **${info.name}**${beetHinweis}: **${ernte}**\n\nNach der Ernte eignet sich als Nachkultur: ${naechste}`;
    }
  }

  // ── Nachbarn gut/schlecht abfragen ─────
  const nachbarMatch = lc.match(/(?:vertrag|vertr[äa]gt|passen?|harmonier|nachbar|kombinier)(?:en|en sich)?\s+(.+?)\s+(?:und|mit|neben)\s+(.+?)[\?\s]*$/);
  if (nachbarMatch) {
    const p1 = findPflanze(nachbarMatch[1].trim());
    const p2 = findPflanze(nachbarMatch[2].trim());
    if (p1 && p2) {
      const gutMit = p1.gut.some(g => g.toLowerCase() === p2.name.toLowerCase());
      const schlechtMit = p1.schlecht.some(s => s.toLowerCase() === p2.name.toLowerCase());
      if (gutMit) return `✅ ${p1.icon} **${p1.name}** und ${p2.icon} **${p2.name}** sind **gute Nachbarn!** Sie fördern sich gegenseitig.`;
      if (schlechtMit) return `❌ ${p1.icon} **${p1.name}** und ${p2.icon} **${p2.name}** sollten **nicht nebeneinander** stehen – sie hemmen sich gegenseitig.`;
      return `🤷 Zwischen ${p1.icon} **${p1.name}** und ${p2.icon} **${p2.name}** gibt es keine bekannte starke Wechselwirkung. Neutraler Abstand ist in Ordnung.`;
    }
  }

  // ── Was kann ich JETZT pflanzen ─────
  if (lc.match(/was kann ich (?:jetzt|im \w+|heute|gerade|mo(nat)?s?)? ?(pflanzen|s[äa]en|anbauen)/)) {
    const passend = pflanzDatenbank.filter(p => p.pflanzMonate.includes(monat));
    if (passend.length === 0) return `Im ${monatName} gibt es wenig zu pflanzen – nutze die Zeit für Vorbereitung und Bestellungen.`;
    const liste = passend.map(p => `${p.icon} ${p.name}`).join(', ');
    return `🌱 Im **${monatName}** kannst du folgendes pflanzen oder säen:\n\n${liste}`;
  }

  // ── Was kann ich JETZT ernten ─────
  if (lc.match(/was kann ich (?:jetzt|im \w+|heute|gerade)? ?(ernten|abernten|ernte)/)) {
    const datumStr = format(selectedDate, 'yyyy-MM');
    const erntbar = beete.filter(b => b.erntbarIm.includes(datumStr));
    if (erntbar.length === 0) return `Im ${monatName} gibt es nach aktueller Planung nichts zu ernten. Überprüfe deine Beete oder ändere das Datum.`;
    const liste = erntbar.map(b => `Beet ${b.beet}: ${b.pflanzen.join(', ')}`).join('\n');
    return `🥬 Im **${monatName}** kannst du ernten:\n\n${liste}`;
  }

  // ── Konflikte im Garten anzeigen ─────
  if (lc.match(/konflikt|problem|falsch|schlecht|vertr[äa]gt sich nicht|fehler|fehler im garten/)) {
    const probleme = [];
    for (const beet of beete) {
      for (const p of beet.pflanzen) {
        const { schlechtMit } = getNeighborRelation(p, beet.pflanzen);
        if (schlechtMit.length > 0) {
          probleme.push(`Beet ${beet.beet}: **${p}** verträgt sich nicht mit **${schlechtMit.join(', ')}**`);
        }
      }
    }
    if (probleme.length === 0) return '✅ Keine Nachbarschaftskonflikte in deinen Beeten gefunden! Alles grün.';
    return `⚠️ Folgende Nachbarschaftskonflikte habe ich gefunden:\n\n${probleme.join('\n')}`;
  }

  // ── Hilfreiche Nachbarn für eine Pflanze ─────
  const gutNachbarMatch = lc.match(/(?:gute nachbarn?|passt (?:gut )?zu|vertr[äa]gt sich mit|gut (?:neben|mit|bei)) (.+?)[\?\s]*$/);
  if (gutNachbarMatch) {
    const info = findPflanze(gutNachbarMatch[1].trim());
    if (info) {
      const gutListe = info.gut.length ? info.gut.map(g => {
        const gi = findPflanze(g); return gi ? `${gi.icon} ${g}` : g;
      }).join(', ') : 'keine bekannt';
      const schlechtListe = info.schlecht.length ? info.schlecht.map(s => {
        const si = findPflanze(s); return si ? `${si.icon} ${s}` : s;
      }).join(', ') : 'keine bekannt';
      return `${info.icon} **${info.name}**:\n\n✅ Gute Nachbarn: ${gutListe}\n❌ Schlechte Nachbarn: ${schlechtListe}\n\n💡 ${info.hinweis}`;
    }
  }

  // ── Nachkultur ─────
  const nachMatch = lc.match(/(?:nach(?:folger|kultur|anbau)|was danach|was nach) (.+?)[\?\s]*$/) ||
    lc.match(/(.+?) (?:geerntet|abgeräumt|was kommt dann|was pflanzen|nachher|danach)/);
  if (nachMatch) {
    const info = findPflanze(nachMatch[1].trim());
    if (info) {
      return `Nach **${info.name}** eignet sich als Nachkultur: **${info.naechsteKultur}**\n\n💡 Beachte Fruchtfolge: nicht wieder dieselbe Pflanzenfamilie ins gleiche Beet.`;
    }
  }

  // ── Monats-Tipp ─────
  if (lc.match(/tipp|tipp des monats|was tun|was machen|heute|aufgabe|aufgaben/)) {
    return getMonatsTipp(monat);
  }

  // ── Infos über eine Pflanze ─────
  for (const pflanze of pflanzDatenbank) {
    if (lc.includes(pflanze.name.toLowerCase()) || pflanze.aliases.some(a => lc.includes(a))) {
      const gutListe = pflanze.gut.length ? pflanze.gut.join(', ') : 'keine bekannt';
      const schlechtListe = pflanze.schlecht.length ? pflanze.schlecht.join(', ') : 'keine bekannt';
      return `${pflanze.icon} **${pflanze.name}**\n\n📅 Pflanzzeit: ${pflanze.pflanzMonate.map(m => DE_MONATE[m]).join(', ')}\n🌾 Ernte: ${pflanze.ernteBeschreibung}\n🔄 Nachkultur: ${pflanze.naechsteKultur}\n✅ Gute Nachbarn: ${gutListe}\n❌ Schlechte Nachbarn: ${schlechtListe}\n\n💡 ${pflanze.hinweis}`;
    }
  }

  // ── Hilfe / Übersicht ─────
  if (lc.match(/hilfe|help|was kannst|was weißt|befehle|optionen/)) {
    return `Ich beantworte folgende Garten-Fragen:\n\n` +
      `• "Was kann ich jetzt pflanzen?"\n` +
      `• "Was kann ich gerade ernten?"\n` +
      `• "Wann pflanze ich Tomaten?"\n` +
      `• "Wann ernte ich Karotten?"\n` +
      `• "Vertragen sich Tomaten und Basilikum?"\n` +
      `• "Gute Nachbarn von Zucchini?"\n` +
      `• "Was kommt nach Tomaten?"\n` +
      `• "Gibt es Konflikte in meinen Beeten?"\n` +
      `• "Tipp des Monats"\n` +
      `• "Ich habe Beet 1 gegossen"\n` +
      `• "Ich habe alle Beete gegossen"\n` +
      `• "Ich habe Tomaten in Beet 2 gepflanzt"\n` +
      `• Oder einfach den Namen einer Pflanze eingeben`;
  }

  return `Ich bin mir nicht sicher, was du meinst. Versuche es mit einer Frage wie "Was kann ich jetzt pflanzen?" oder nenne eine Pflanze direkt. Tippe "Hilfe" für alle Optionen.`;
}

function getMonatsTipp(monat) {
  const tipps = {
    1: '❄️ **Januar:** Plane die Saison, bestelle Saatgut. Rhabarber und Spargel brauchen keinen Rückschnitt. Werkzeug reinigen und schärfen.',
    2: '🌱 **Februar:** Erste Aussaaten (Tomaten, Paprika) auf der Fensterbank vorziehen. Boden bei Frost nicht betreten.',
    3: '🌸 **März:** Frühsaaten ins Beet: Erbsen, Spinat, Salat, Radieschen. Kompost einarbeiten. Jungpflanzen-Voranzucht auf der Fensterbank.',
    4: '🌷 **April:** Kohlrabi, Brokkoli, Kohl pflanzen. Himbeeren mulchen. Keine Frostschutzmaßnahmen vergessen!',
    5: '🌻 **Mai:** Nach den Eisheiligen (15.5.) Tomaten, Paprika, Gurken, Zucchini pflanzen. Bohnen direkt säen. Schädlingskontrolle starten.',
    6: '☀️ **Juni:** Regelmäßig gießen, besonders bei Hitze. Basilikum mit Tomaten setzen. Erste Radieschen und Salate ernten.',
    7: '🥒 **Juli:** Zucchini täglich kontrollieren. Staudensellerie gießen. Feldsalat, Spinat für Herbst vorsäen.',
    8: '🍅 **August:** Tomaten ausgeizen, Blätter unten entfernen. Feldsalat und Herbstsalat säen. Kompost befüllen.',
    9: '🍂 **September:** Ernte intensivieren. Wintergemüse (Grünkohl, Porree) pflegen. Knoblauch Steckzwiebeln kaufen.',
    10: '🍁 **Oktober:** Knoblauch stecken. Beete abräumen und mit Kompost mulchen. Kräuter vor Frost schützen.',
    11: '🌨️ **November:** Feldsalat und Spinat abdecken. Letzte Ernte. Gartengeräte einlagern und einölen.',
    12: '❄️ **Dezember:** Ruhezeit im Garten. Planung für nächste Saison starten. Saatgutkatalog studieren.',
  };
  return tipps[monat] || 'Ein schöner Monat im Garten – schau was gerade blüht und geerntet werden kann!';
}

// ── Markdown-Renderer (mini) ──────────────────────────────────────────────────
function formatBold(line) {
  if (!line.trim()) return <span>&nbsp;</span>;
  const parts = line.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) => i % 2 === 1 ? <strong key={i}>{part}</strong> : part);
}

function renderAntwort(text) {
  return text.split('\n').map((line, i) => (
    <p key={i} className="mb-1 last:mb-0 leading-relaxed">{formatBold(line)}</p>
  ));
}

// ── Aktions-Erkennung ────────────────────────────────────────────────────────
function detectAction(text, beete, selectedDate, onGiessen, onUpdateBeet, onDuengen) {
  const lc = text.toLowerCase().trim();

  // "ich habe beet N gegossen"
  const giessenBeetMatch = lc.match(/(?:ich habe?|hab)\s+beet\s*(\d+)\s+(?:gegossen|bew[äa]ssert|gew[äa]ssert)/);
  if (giessenBeetMatch) {
    const beetId = Number(giessenBeetMatch[1]);
    const beet = beete.find(b => b.beet === beetId);
    if (!beet) return { text: `Beet ${beetId} gibt es nicht.` };
    return {
      text: `✅ Beet ${beetId} wurde als gegossen markiert!`,
      action: () => onGiessen?.(beetId, selectedDate),
    };
  }

  // "ich habe gegossen" / "alle gegossen"
  if (lc.match(/(?:ich habe?|hab)\s+(?:alle?\s+)?(?:beete?\s+)?(?:gegossen|bew[äa]ssert|gew[äa]ssert)/)) {
    const gepflanzt = beete.filter(b => b.pflanzen?.length > 0);
    if (gepflanzt.length === 0) return { text: 'Du hast noch keine bepflanzten Beete.' };
    return {
      text: `✅ ${gepflanzt.length} Beet${gepflanzt.length > 1 ? 'e' : ''} wurden als gegossen markiert!`,
      action: () => gepflanzt.forEach(b => onGiessen?.(b.beet, selectedDate)),
    };
  }

  // "ich habe beet N gedüngt"
  const duengenMatch = lc.match(/(?:ich habe?|hab)\s+beet\s*(\d+)\s+(?:ged[üu]ngt|gef[üu]ttert|mit\s+d[üu]nger)/);
  if (duengenMatch) {
    const beetId = Number(duengenMatch[1]);
    const beet = beete.find(b => b.beet === beetId);
    if (!beet) return { text: `Beet ${beetId} gibt es nicht.` };
    return {
      text: `✅ Beet ${beetId} wurde als gedüngt markiert!`,
      action: () => onDuengen?.(beetId, selectedDate),
    };
  }

  // "ich habe [pflanze] in beet N gepflanzt"
  const pflanzeMatch =
    lc.match(/(?:ich habe?|hab)\s+(.+?)\s+in beet\s*(\d+)\s*(?:gepflanzt|gesetzt|eingepflanzt)?\s*$/) ||
    lc.match(/(.+?)\s+in beet\s*(\d+)\s+(?:gepflanzt|gesetzt|eingepflanzt)/);
  if (pflanzeMatch) {
    const pflanzeName = pflanzeMatch[1].trim();
    const beetId = Number(pflanzeMatch[2]);
    const info = findPflanze(pflanzeName);
    const beet = beete.find(b => b.beet === beetId);
    if (!info) return { text: `Ich kenne \u201e${pflanzeName}\u201c leider nicht. Pr\u00fcfe den genauen Namen.` };
    if (!beet) return { text: `Beet ${beetId} gibt es nicht.` };
    const newPflanzen = [...new Set([...(beet.pflanzen || []), info.name])];
    return {
      text: `✅ ${info.icon} **${info.name}** wurde in Beet ${beetId} hinzugef\u00fcgt!`,
      action: () => onUpdateBeet?.(beetId, newPflanzen),
    };
  }

  return null;
}

// ── Chatbot Component ─────────────────────────────────────────────────────────
export default function Chatbot({ beete, selectedDate, onGiessen, onDuengen, onUpdateBeet, isTab = false }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'bot',
      text: `🌱 Hallo! Ich bin dein Garten-Assistent.\n\nFrag mich z.B.:\n• "Was kann ich jetzt pflanzen?"\n• "Vertragen sich Tomaten und Fenchel?"\n• "Tipp des Monats"\n\nTippe "Hilfe" für alle Optionen.`,
    },
  ]);
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  function send() {
    const text = input.trim();
    if (!text) return;
    const userMsg = { role: 'user', text };
    const detected = detectAction(text, beete, selectedDate, onGiessen, onUpdateBeet, onDuengen);
    if (detected) {
      detected.action?.();
      setMessages(prev => [...prev, userMsg, { role: 'bot', text: detected.text }]);
      setInput('');
      return;
    }
    const botMsg = { role: 'bot', text: antwort(text, beete, selectedDate) };
    setMessages(prev => [...prev, userMsg, botMsg]);
    setInput('');
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const QUICK = [
    'Was kann ich jetzt pflanzen?',
    'Was kann ich gerade ernten?',
    'Gibt es Konflikte?',
    'Ich habe gegossen',
  ];

  const panel = (
    <div className={isTab
      ? 'flex flex-col h-full bg-white dark:bg-gray-900'
      : 'fixed bottom-24 right-4 z-50 w-80 sm:w-96 flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700'
    } style={isTab ? {} : { maxHeight: '520px' }}>
      {/* Header */}
      <div className="bg-green-600 text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <div className="font-bold text-sm">🌱 Garten-Assistent</div>
          <div className="text-xs opacity-80">Pflanzen · Nachbarn · Tipps</div>
        </div>
        {!isTab && <button onClick={() => setOpen(false)} className="text-white opacity-70 hover:opacity-100 text-lg">✕</button>}
      </div>

      {/* Quick actions */}
      <div className="flex gap-1 flex-wrap px-3 py-2 bg-green-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        {QUICK.map(q => (
          <button key={q} onClick={() => { setInput(q); }}
            className="text-xs bg-white dark:bg-gray-700 border border-green-300 dark:border-green-700 text-green-800 dark:text-green-200 rounded-full px-2 py-0.5 hover:bg-green-100 dark:hover:bg-gray-600 transition-colors">
            {q}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-white dark:bg-gray-900" style={{ minHeight: 0 }}>
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
              msg.role === 'user'
                ? 'bg-green-600 text-white rounded-br-sm'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm'
            }`}>
              {renderAntwort(msg.text)}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 px-3 py-2 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
        <input
          className="flex-1 border border-gray-300 dark:border-gray-600 rounded-full px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-400"
          placeholder="Frag deinen Garten-Assistenten…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
        />
        <button
          onClick={send}
          className="bg-green-600 hover:bg-green-700 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm transition-colors"
          aria-label="Senden"
        >
          ➤
        </button>
      </div>
    </div>
  );

  if (isTab) return panel;

  return (
    <>
      {/* Floating Button — positioned above bottom nav */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-20 right-4 z-50 w-12 h-12 rounded-full bg-green-600 hover:bg-green-700 text-white text-xl shadow-lg flex items-center justify-center transition-transform hover:scale-110"
        aria-label="Garten-Chatbot öffnen"
        title="Garten-Assistent"
      >
        {open ? '✕' : '🌱'}
      </button>

      {open && panel}
    </>
  );
}

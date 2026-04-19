# Saisongarten – Projektstand

> Zuletzt aktualisiert: April 2026  
> Für neue Claude-Sessions: Diese Datei zuerst lesen, dann CLAUDE.md.

---

## Was ist das?

Eine **React-PWA für Gartenplanung**, gehostet auf Netlify. Nutzer verwalten ihre Beete, tracken Gießen/Düngen/Ernten, bekommen tagesaktuelle Aufgaben und einen regelbasierten Chatbot-Assistenten. Login über Netlify Identity (Einladungssystem – kein Self-Signup).

Die App hat einen echten Nutzenden (Waschtl2211) mit einem Mustergarten als Template für neue User.

---

## Tech Stack

| Bereich | Technologie |
|---|---|
| Framework | React 18 + Vite |
| Styling | Tailwind CSS v3, shadcn/ui (Radix), tw-animate-css |
| Font | Geist Variable (`@fontsource-variable/geist`) |
| Auth | GoTrue (`gotrue-js`) via Netlify Identity |
| Drag & Drop | `@dnd-kit/core` + `@dnd-kit/sortable` |
| Datum | `date-fns` |
| PWA | `vite-plugin-pwa` (Workbox, autoUpdate) |
| Tests | Vitest + `@vitest/coverage-v8` |
| Icons | `lucide-react` |
| Hosting | Netlify (main Branch) |

---

## Projektstruktur

```
src/
├── main.jsx                  # Auth-Einstieg (GoTrue, Session, Onboarding)
├── App.jsx                   # Haupt-App (~2850 Zeilen) — alle Features
├── index.css                 # CSS-Variablen, Animationen, Tailwind
├── data/
│   ├── plantDatabase.js      # 68 Pflanzen mit Companion-Daten
│   ├── plantDatabase.test.js # 58 Tests
│   └── gardenData.js         # Mustergarten-Initialdaten
├── lib/
│   ├── storage.js            # localStorage-Helfer (profileKey-Namespacing)
│   ├── storage.test.js       # 32 Tests
│   ├── gardenLogic.js        # Pure Business Logic (Gießen, Düngen, Wetter)
│   ├── gardenLogic.test.js   # 45 Tests
│   ├── plantMigration.js     # Migrationshilfen (pflanzeName, etc.)
│   ├── plantMigration.test.js# 15 Tests
│   └── utils.ts              # cn() Tailwind-Merge Helper
├── components/
│   ├── Chatbot.jsx           # Regelbasierter Garten-Assistent (~378 Zeilen)
│   ├── PflanzenGrid.jsx      # DnD-Grid für Pflanzenzuweisung im Beet
│   ├── PflanzeEditDialog.jsx # Pflanze bearbeiten (Name, Datum, etc.)
│   └── ui/                   # shadcn/ui Komponenten (button, card, dialog, ...)
│       ├── sign-in.tsx       # Login-UI (Sign In, Invite, Recovery, Passwort-Reset)
│       ├── card.tsx          # rounded-2xl, shadow statt ring
│       └── dialog.tsx        # Bottom Sheet auf Mobile, zentriert auf Desktop
```

---

## Auth-System (`src/main.jsx`)

**GoTrue / Netlify Identity** — keine Passwörter lokal, Tokens im localStorage (kein Cookie).

```
const auth = new GoTrue({ APIUrl: '/.netlify/identity', setCookie: false });
```

**Flows die implementiert sind:**
- Email + Passwort Login (`auth.login`)
- Session Recovery beim Start (`auth.currentUser()`)
- Passwort vergessen (`auth.requestPasswordRecovery`)
- Einladung annehmen via Hash-Token (`auth.acceptInvite`)
- Passwort zurücksetzen via Recovery-Token (`auth.recover + u.update`)
- Logout (`user.logout`)

**Profile-System:**
- Jeder Netlify-User bekommt eine eigene `profileId` (= Netlify `user.id`)
- Mapping `netlify_profile_map: { userId → profileId }` in localStorage
- `mustergarten` = festes Template-Profil (aus Waschtl-Migration)
- Neue User → Onboarding-Screen: Name eingeben + Template übernehmen oder leer starten

---

## Datenspeicherung (`src/lib/storage.js`)

Alles in **localStorage**, profilbezogene Keys namespaced:

```js
profileKey('beete', 'mustergarten') → 'beete_mustergarten'
```

**USER_KEYS** (profilspezifisch):
`beete`, `beetDataVersion`, `archivierteBeete`, `giessenLog`, `duengenLog`, `pinnedBeete`, `beetNotizen`, `ernteLog`, `beetOrder`

**Globale Keys** (geteilt): `darkMode`, `fontSize`, `accentColor`, `standort`, `profiles`, `netlify_profile_map`, `currentProfile`

**Export/Import:** `exportProfileData(profileId)` → JSON v1.0, `importProfileData(profileId, exported)`

---

## Datenmodell

### Beet-Objekt
```js
{
  beet: 3,                           // Nummer (ID)
  label: 'Kräuter',                  // Optionaler Name
  pflanzen: ['Tomaten', 'Basilikum'],// Flat-Liste aller Pflanzen
  gepflanzt: '2026-04-19',           // ISO-Datum
  faellig: '2026-09-30',             // ISO-Datum
  naechste: 'Feldsalat',             // Folgekultur
  erntbarIm: ['2026-07', '2026-08'], // Berechnete Ernte-Monate
  reihen: [                          // Optionales Reihen-Layout
    { abstand: 30, kulturen: ['Salanova', 'Batavia'] },
    { abstand: 20, kulturen: ['Petersilie', 'Dill'] },
    { aussaat: true, kulturen: ['Radieschen'], hinweis: 'ab Jetzt' },
  ],
}
```

### Logs
```js
giessenLog:  { beetId: ['2026-04-19', '2026-04-22'] }  // Gieß-Daten
duengenLog:  { beetId: ['2026-04-01'] }                 // Dünge-Daten
ernteLog:    [{ beetId, pflanze, datum, menge, einheit }]
beetNotizen: { beetId: 'Freitext-Notiz' }
```

---

## Pflanzendatenbank (`src/data/plantDatabase.js`)

**68 Einträge**, jede Pflanze hat:

```js
{
  name: 'Tomaten',
  aliases: ['tomate', 'tomaten'],
  icon: '🍅',
  pflanzMonate: [4, 5],          // Monate (1=Jan)
  ernteanfangOffset: 3,          // Monate nach Pflanzung
  erntedauer: 4,                 // Monate Erntefenster
  ernteBeschreibung: 'Jul–Okt',
  giessIntervall: 2,             // Tage zwischen Gießen
  giessIntensität: 'hoch',
  gut: ['Basilikum', 'Petersilie', 'Karotten'],
  schlecht: ['Fenchel', 'Kohlrabi'],
  duenger: { typ: ['Hornspäne'], intervallWochen: 3, hinweis: '...' },
  naechsteKultur: 'Feldsalat',
  hinweis: 'Regelmäßig ausgeizen',
}
```

**Wichtige Hilfsfunktionen:**
- `findPflanze(name)` — findet per name oder alias (case-insensitive)
- `computeErntbarIm(pflanze)` — berechnet Ernte-Monate
- `getNeighborRelation(nameA, nameB)` → `'gut'` | `'schlecht'` | `null`

**Bekannte Fixes (April 2026):**
- Kohlrabi hatte Tomaten in BEIDEN `gut` und `schlecht` → aus `gut` entfernt
- Pfefferminze/Minze hatten überlappende Aliases → bereinigt
- Wilde Rauke + Barbarakraut: `schlecht` um Brassica-Konkurrenten ergänzt

---

## Business Logic (`src/lib/gardenLogic.js`)

```js
brauchtGiessen(beet, date, giessenLog, wetterDaten)
// → { noetig, tageSeit, regenCredits, effektiveTage, intervall, letzteGiessung, grund }

brauchtDuengen(beet, date, duengenLog)
// → { noetig, letztesDuengen, naechstesDuengen, tageSeit, intervall, grund }

berechneRegenCredits(vonDatum, bisDatum, wetterDaten)
// → Anzahl "Regentage-Credits" (≥15mm=1, ≥5mm=0.5)

getWetterFuerTag(date, wetterDaten)
// → { maxTemp, minTemp, precipitation, precipProb, isForecast }
```

**Fallback-Logik:** Wenn `beet.pflanzen` leer ist, werden `beet.reihen.kulturen` als Pflanzenliste verwendet (wichtig für reihenbasierte Beete).

---

## App-Komponente (`src/App.jsx`)

**4-Tab Bottom Navigation:**
- 🏠 **Heute** — WetterStreifen + TagesAufgaben (priorisierte Aufgabenliste)
- 🥬 **Beete** — Beet-Grid/Liste/Horizontal mit DnD-Sortierung
- 📅 **Kalender** — 3-Monats-Vorschau + Ernte-Tagebuch
- 🤖 **Assistent** — Chatbot als Fullscreen-Tab

**Key State der App:**
```js
beete, archivierteBeete   // Beet-Arrays
giessenLog, duengenLog    // { beetId: [dates] }
ernteLog                  // [{ beetId, pflanze, datum, menge, einheit }]
beetNotizen               // { beetId: string }
wetterDaten               // Open-Meteo API Response
standort                  // { lat, lon, name }
selectedDate              // aktuell betrachtetes Datum
activeTab                 // 'heute' | 'beete' | 'kalender' | 'chatbot'
darkMode, fontSize, accentColor, kartenLayout, pflanzModus
```

**Nachbarschaftscheck:**
```js
// Union aus pflanzen + reihen.kulturen — damit auch reihenbasierte Beete geprüft werden
const reihenKulturen = beet.reihen?.flatMap(r => r.kulturen || []) || [];
const pflanzenNamen = [...new Set([...(beet.pflanzen||[]).map(pflanzeName), ...reihenKulturen])];
// hasKonflikt → roter Ring; hasGutNachbar → grüner Ring
```

---

## TagesAufgaben — Aufgaben-Typen & Prioritäten

| Prio | Typ | Beschreibung |
|---|---|---|
| 0 | `warnung`, `frost` | Dringend: Frost, kritische Probleme |
| 1 | `giessen` | Bewässerung fällig |
| 2 | `duengen` | Düngung fällig |
| 3 | `regen` | Regenwarnung / Wetterhinweis |
| 4 | `ernte` | Ernte-Monat für Pflanze |
| 5 | `rueckschnitt` | Rückschnitt nötig |
| 6 | `auflocken` | Bodenarbeit |
| 7 | `pflanzen` | Pflanzzeit beginnt |

Darstellung: iOS Grouped List — weiße Container mit `divide-y`, farbiger linker Streifen (`border-l-4`) pro Typ.

---

## PDF-Export (Anbauplan)

Öffnet neues Fenster mit druckbarem HTML. Format:

- **2-spaltiges Grid** von Beet-Karten
- Beete **mit `reihen`**: Tabelle mit Reihen als Spalten (wie die physischen Gartenschilder)
  - Kopfzeile: Reihen-Nummer (1, 2, 3…)
  - Body: Kulturen-Liste
  - Footer: Abstand in cm oder "Aussaat"-Label
- Beete **ohne `reihen`**: einfache Pflanzenliste

---

## Design-System

**iOS-Native UI (seit April 2026):**
- BottomNav: `backdrop-blur-xl bg-white/80` — Glas-Effekt
- Tab-Wechsel: `animate-tab-in` (opacity-fade 180ms, key-Remount)
- Cards: `rounded-2xl shadow-sm` (kein Ring)
- Dialoge: Bottom Sheet auf Mobile (CSS `@media max-width: 639px`, slide-up Keyframe), zentriert auf Desktop
- Buttons: `active:scale-[0.97]` Press-Feedback
- Typography: Section-Labels `uppercase tracking-wide`, Headlines `font-semibold`

**Theme:**
- Dark Mode via `.dark` Klasse auf `<html>`
- Akzentfarben via `data-accent="orange|blue|violet|rose"` auf `<html>`
- Schriftgröße via `data-font-size="sm|md|lg"` auf `<html>`

---

## Tests (Stand: 132 Tests, alle grün)

| Datei | Tests | Abdeckung |
|---|---|---|
| `plantDatabase.test.js` | 58 | findPflanze, computeErntbarIm, getNeighborRelation |
| `gardenLogic.test.js` | 45 | brauchtGiessen, brauchtDuengen, Regen-Credits |
| `storage.test.js` | 32 | profileKey, lsGet/Set, Migration, Export/Import |
| `plantMigration.test.js` | 15 | pflanzeName, migratePflanzenZuObjekte |
| `utils.test.ts` | 6 | cn() Tailwind-Merge |

---

## Netlify / Deployment

| Branch | URL | Auslöser |
|---|---|---|
| `main` | https://saisongarten.netlify.app | Manuell (Build-Minuten sparen) |
| `develop` | deaktiviert | — |

**Auto-Deploys auf `develop` sind deaktiviert** (Netlify Dashboard → Branch Deploys → None).  
Deploy nur durch expliziten Merge in `main`.

**netlify.toml:** CSP-Header, X-Frame-Options, Referrer-Policy, SPA-Redirect `/* → /index.html`

---

## Noch offen / TODO

- **Chatbot: Düngen-Logging** — `onDuengen`-Prop verdrahten + Spracherkennung "ich hab Beet X gedüngt" in `detectAction()` (`src/components/Chatbot.jsx`)
- Weitere Chatbot-Aktionen nach Bedarf

---

## Schnellreferenz: Wichtige Commands

```bash
npm test -- --run      # alle 132 Tests (muss grün sein vor Merge)
npm run build          # Produktions-Build (0 Fehler Pflicht)
git checkout develop
git checkout -b feature/<name>   # Feature-Branch starten
git merge feature/<name> --no-edit && git push -u origin develop
```

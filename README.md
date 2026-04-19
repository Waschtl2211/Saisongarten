# Saisongarten 🌱

Eine progressive Web-App zur Gartenplanung und Pflege — installierbar auf iOS und Android, login-geschützt via Netlify Identity.

[![Netlify Status](https://api.netlify.com/api/v1/badges/saisongarten/deploy-status)](https://saisongarten.netlify.app)

---

## Features

- **Beete verwalten** — Anlegen, bearbeiten, archivieren; Drag-and-Drop-Sortierung
- **Tagesaufgaben** — Priorisierte Aufgabenliste: Gießen, Düngen, Ernte, Frostwarnung
- **Gieß- & Düngelogik** — Intervall-basiert; Regentage werden als Credits angerechnet
- **Reihen-Layout** — Beete können physische Reihen mit Abstandsangaben speichern
- **Pflanzendatenbank** — 68 Pflanzen mit Companion-Planting-Daten (gut/schlecht)
- **Nachbarschaftscheck** — Grüner/roter Ring auf Beet-Karten, reihen-bewusst
- **Ernte-Tagebuch** — Menge und Einheit pro Ernteeintrag
- **Kalenderansicht** — 3-Monats-Vorschau + Ernte-Historie
- **Regelbasierter Chatbot** — Beantwortet Fragen zu Pflanzen, Gießen, Düngen
- **PDF-Anbauplan** — Druckbarer Export; Reihen werden als Spalten dargestellt (wie physische Beetsschilder)
- **Dark Mode** + Akzentfarben + Schriftgrößen
- **PWA** — Installierbar, Offline-fähig via Service Worker
- **Import/Export** — JSON-Backup aller Profildaten

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
| Hosting | Netlify |

---

## Entwicklung

```bash
npm install
npm run dev        # Entwicklungsserver auf http://localhost:5173
npm test -- --run  # Alle Tests einmalig ausführen (132 Tests)
npm run build      # Produktions-Build
```

> **Hinweis:** Netlify Identity (`/.netlify/identity`) ist nur auf dem Deployment verfügbar. Lokal wird der Login-Screen angezeigt, aber Auth-Requests scheitern ohne Proxy-Konfiguration.

---

## Deployment

| Branch | URL | Auslöser |
|---|---|---|
| `main` | https://saisongarten.netlify.app | Manuell |
| `develop` | — | Auto-Deploy deaktiviert |

Deploy nur durch expliziten Merge in `main`. Auto-Deploys auf `develop` sind im Netlify-Dashboard deaktiviert.

---

## Projektstruktur

```
src/
├── main.jsx                  # Auth-Einstieg (GoTrue, Session, Onboarding)
├── App.jsx                   # Haupt-App (~2850 Zeilen)
├── index.css                 # CSS-Variablen, Animationen, Tailwind
├── data/
│   ├── plantDatabase.js      # 68 Pflanzen mit Companion-Daten
│   └── gardenData.js         # Mustergarten-Initialdaten
├── lib/
│   ├── storage.js            # localStorage-Helfer (profileKey-Namespacing)
│   ├── gardenLogic.js        # Pure Business Logic (Gießen, Düngen, Wetter)
│   └── plantMigration.js     # Migrationshilfen
└── components/
    ├── Chatbot.jsx           # Regelbasierter Garten-Assistent
    ├── PflanzenGrid.jsx      # DnD-Grid für Pflanzenzuweisung
    ├── PflanzeEditDialog.jsx # Pflanze bearbeiten
    └── ui/                   # shadcn/ui Komponenten
```

---

## Auth

Login ausschließlich per Einladung (Netlify Identity, invite-only). Kein Self-Signup. Passwörter werden nicht lokal gespeichert — GoTrue verwaltet Tokens intern.

---

## Versionierung

Dieses Projekt folgt [Semantic Versioning](https://semver.org/lang/de/) (`MAJOR.MINOR.PATCH`) und dokumentiert Änderungen im [CHANGELOG](./CHANGELOG.md) nach dem [Keep a Changelog](https://keepachangelog.com/de/1.0.0/)-Format.

---

## Tests

```
plantDatabase.test.js   58 Tests  — findPflanze, computeErntbarIm, getNeighborRelation
gardenLogic.test.js     45 Tests  — brauchtGiessen, brauchtDuengen, Regen-Credits
storage.test.js         32 Tests  — profileKey, lsGet/Set, Migration, Export/Import
plantMigration.test.js  15 Tests  — pflanzeName, migratePflanzenZuObjekte
utils.test.ts            6 Tests  — cn() Tailwind-Merge
```

Alle 132 Tests müssen grün sein vor jedem Merge in `main`.

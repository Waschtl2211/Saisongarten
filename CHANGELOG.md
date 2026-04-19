# Changelog

Alle wesentlichen Änderungen an diesem Projekt werden in dieser Datei dokumentiert.

Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.0.0/),
Versionierung folgt [Semantic Versioning](https://semver.org/lang/de/).

---

## [Unreleased]

### Geplant
- Chatbot: Düngen-Logging (`onDuengen`-Prop + Spracherkennung „ich hab Beet X gedüngt")

---

## [1.2.0] — 2026-04-19

### Hinzugefügt
- **iOS-native UI**: Glas-Effekt auf BottomNav (`backdrop-blur-xl bg-white/80`), Tab-Fade-Animation, Press-Feedback auf Buttons (`active:scale-[0.97]`)
- **Bottom-Sheet-Dialoge**: Auf Mobile gleiten Dialoge von unten auf (slide-up Animation); Desktop bleibt zentriert
- **iOS Grouped List** für TagesAufgaben: Weiße Container mit `divide-y`, farbiger linker Streifen pro Aufgabentyp
- **PDF-Anbauplan** (Neues Format): Reihen werden als Tabellen-Spalten dargestellt — entspricht dem physischen Beetsschilder-Format
- **Reihen-bewusster Nachbarschaftscheck**: `beet.reihen.kulturen` wird in die Pflanzen-Union einbezogen
- **Gardenlogic Reihen-Fallback**: `brauchtGiessen`/`brauchtDuengen` nutzen Reihen-Kulturen wenn `pflanzen` leer ist
- **PROJEKT_STAND.md**: Umfassende Projektdokumentation für neue Claude-Sessions

### Geändert
- Beet-Karten: `rounded-2xl shadow-sm` statt `rounded-xl` mit hartem Ring
- Typografie: Section-Labels `uppercase tracking-wide`, Headlines `font-semibold`

### Behoben
- **Kohlrabi-Datenbug**: Tomaten stand in BEIDEN Arrays `gut` und `schlecht` → aus `gut` entfernt
- **Pfefferminze/Minze Alias-Konflikt**: Beide Einträge hatten überlappende Aliases → bereinigt; `findPflanze()` trifft jetzt zuverlässig den richtigen Eintrag
- **Wilde Rauke `schlecht`**: Brassica-Konkurrenten (`Brokkoli`, `Kohlrabi`) ergänzt
- **Barbarakraut `schlecht`**: `Brokkoli`, `Kohlrabi`, `Chinakohl` ergänzt

---

## [1.1.0] — 2026-04-15

### Hinzugefügt
- **Bottom-Tab-Navigation**: 4 Tabs — Heute / Beete / Kalender / Assistent
- **Heute-Tab**: WetterStreifen + priorisierte TagesAufgaben (Frost, Gießen, Düngen, Regen, Ernte)
- **Frostwarnung**: Aufgabe vom Typ `frost`/`frost-morgen` wenn Tiefstwert < 2 °C
- **Ernte-Tagebuch mit Menge**: `ernteLog`-Einträge enthalten `menge` + `einheit` (`kg`/`Stück`/`Bund`)
- **Kalender-Tab**: 3-Monats-Vorschau + Ernte-Historie
- **Chatbot als Vollbild-Tab** (statt schwebendem Overlay)
- **Dünge-Aufgaben** in TagesAufgaben (Prio 2, mit Düngen-Button)
- **Per-User-Profile**: Jeder Netlify-User bekommt eigene isolierte Profil-ID
- **Onboarding-Screen**: Neue User wählen zwischen Mustergarten-Template und leerem Garten
- **Profil-Name ändern**: Einstellungen-Panel enthält Namens-Feld
- **JSON Export/Import**: Vollständige Datensicherung aller Profildaten
- **PWA**: `vite-plugin-pwa` — installierbar, Offline-fähig, App-Icon

### Geändert
- Chatbot-Prop `onDuengen` vorbereitet (noch nicht verdrahtet)
- `mustergarten` als Template-Profil (statt `waschtl`)

### Gehoben (Security)
- `dangerouslySetInnerHTML` im Chatbot durch sicheres JSX-Rendering ersetzt
- `exportProfileData` mit try/catch um korrupte localStorage-Werte
- Import-Validierung: Dateigrößenlimit 2 MB + Schema-Prüfung
- Service Worker: `/.netlify/*` auf `NetworkOnly` (Auth-Endpoints nie cachen)
- CSP-Header in `netlify.toml`

---

## [1.0.0] — 2026-04-01

### Hinzugefügt
- **Beet-Verwaltung**: Anlegen, bearbeiten, archivieren, DnD-Sortierung
- **Pflanzendatenbank**: 68 Pflanzen mit Companion-Planting-Daten
- **Gieß-/Düngelogik**: Intervall-basiert mit Regentage-Credits
- **Nachbarschaftscheck**: Grüner/roter Ring auf Beet-Karten
- **Chatbot**: Regelbasierter Garten-Assistent
- **Netlify Identity Auth**: Invite-only Login, GoTrue-Integration
- **Dark Mode**, Akzentfarben, Schriftgrößen
- **Business Logic** in `src/lib/gardenLogic.js` extrahiert
- **132 Tests** über 5 Testdateien (Vitest + coverage-v8)
- Netlify CSP-Header, PWA-Manifest, Service Worker

---

[Unreleased]: https://github.com/waschtl2211/saisongarten/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/waschtl2211/saisongarten/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/waschtl2211/saisongarten/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/waschtl2211/saisongarten/releases/tag/v1.0.0

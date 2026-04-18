# Saisongarten – Claude Arbeitsregeln

## Branching-Strategie

```
main        ← Produktion (Netlify live-Deploy) – NUR auf explizite Anfrage
develop     ← Staging (Netlify Vorschau-URL)   – Ziel aller Änderungen
feature/*   ← Kurzlebige Feature-Branches      – Quelle für develop
```

### Pflichtregeln für Claude

1. **Nie direkt auf `main` pushen.** Änderungen gehen immer zuerst nach `develop`.
2. **Feature-Branches** für jede Aufgabe anlegen: `git checkout -b feature/<kurzer-name> develop`
3. **Merge in `develop`** wenn die Aufgabe abgeschlossen und getestet ist.
4. **Merge in `main`** erst wenn der Nutzer explizit sagt: „Deploy", „Push to main" oder „jetzt live".
5. Commit-Messages auf Deutsch oder Englisch, immer mit kurzem Was + Warum.

### Typischer Ablauf

```bash
# 1. Feature starten
git checkout develop
git checkout -b feature/neue-funktion

# 2. Änderungen, Tests, Build
npm test -- --run
npm run build

# 3. In develop mergen
git checkout develop
git merge feature/neue-funktion --no-edit
git push -u origin develop

# 4. Feature-Branch aufräumen (optional)
git branch -d feature/neue-funktion

# 5. Nach expliziter Freigabe durch den Nutzer:
git checkout main
git merge develop --no-edit
git push origin main
```

## Netlify

| Branch    | Deploy-URL                              | Auslöser         |
|-----------|------------------------------------------|------------------|
| `main`    | https://saisongarten.netlify.app        | Manuell / PR     |
| `develop` | https://develop--saisongarten.netlify.app | Jeder Push       |

Auto-Deploys auf `main` sind im Netlify-Dashboard deaktiviert (Stop builds → nur manuell oder per CLI).

## Tests & Build

Vor jedem Merge in `develop` sicherstellen:

```bash
npm test -- --run   # alle Tests müssen grün sein
npm run build       # 0 Fehler
```

## Projektstruktur

- `src/lib/storage.js` – localStorage-Helfer (profileKey, lsGet/lsSet, export/import)
- `src/lib/gardenLogic.js` – reine Business-Logic (brauchtGiessen, brauchtDuengen, Wetter)
- `src/data/plantDatabase.js` – Pflanzendatenbank (67+ Einträge)
- `src/App.jsx` – Haupt-App-Komponente (~2500 Zeilen)
- `src/main.jsx` – Auth-Einstiegspunkt (GoTrue/Netlify Identity)
- `src/components/Chatbot.jsx` – regelbasierter Garten-Assistent

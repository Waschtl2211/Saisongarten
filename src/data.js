// Hartcodierte Beet-Daten für die Beetplan-App
export const beetData = [
  {
    beet: 1,
    name: 'Beet 1',
    aktuellePflanzen: ['Aubergine'],
    status: 'gepflanzt 19.4.2026',
    naechsteAktion: 'Ernte Aug, Nachkultur Feldsalat',
    erntbarVon: 'Juli',
    plan: [
      { pflanze: 'Aubergine', gepflanzt: 'April 2026', ernte: 'August 2026', nachfolger: 'Feldsalat' },
      { pflanze: 'Feldsalat', gepflanzt: 'August 2026', ernte: 'Oktober 2026', nachfolger: 'Spinat' },
      { pflanze: 'Spinat', gepflanzt: 'Oktober 2026', ernte: 'Februar 2027', nachfolger: '-' },
    ],
  },
  {
    beet: 2,
    name: 'Beet 2',
    aktuellePflanzen: ['Tomate'],
    status: 'gepflanzt 10.5.2026',
    naechsteAktion: 'Ernte Sep, Nachkultur Spinat',
    erntbarVon: 'August',
    plan: [
      { pflanze: 'Tomate', gepflanzt: 'Mai 2026', ernte: 'September 2026', nachfolger: 'Spinat' },
      { pflanze: 'Spinat', gepflanzt: 'September 2026', ernte: 'Februar 2027', nachfolger: '-' },
    ],
  },
  {
    beet: 3,
    name: 'Beet 3',
    aktuellePflanzen: ['Zucchini'],
    status: 'gepflanzt 1.5.2026',
    naechsteAktion: 'Ernte Juli, Nachkultur Radieschen',
    erntbarVon: 'Juli',
    plan: [
      { pflanze: 'Zucchini', gepflanzt: 'Mai 2026', ernte: 'Juli 2026', nachfolger: 'Radieschen' },
      { pflanze: 'Radieschen', gepflanzt: 'Juli 2026', ernte: 'September 2026', nachfolger: 'Feldsalat' },
      { pflanze: 'Feldsalat', gepflanzt: 'September 2026', ernte: 'November 2026', nachfolger: '-' },
    ],
  },
  {
    beet: 4,
    name: 'Beet 4',
    aktuellePflanzen: ['Paprika'],
    status: 'gepflanzt 15.5.2026',
    naechsteAktion: 'Ernte Sep, Nachkultur Feldsalat',
    erntbarVon: 'August',
    plan: [
      { pflanze: 'Paprika', gepflanzt: 'Mai 2026', ernte: 'September 2026', nachfolger: 'Feldsalat' },
      { pflanze: 'Feldsalat', gepflanzt: 'September 2026', ernte: 'November 2026', nachfolger: '-' },
    ],
  },
  {
    beet: 5,
    name: 'Beet 5',
    aktuellePflanzen: ['Salat'],
    status: 'gepflanzt 20.3.2026',
    naechsteAktion: 'Ernte Mai, Nachkultur Buschbohne',
    erntbarVon: 'Mai',
    plan: [
      { pflanze: 'Salat', gepflanzt: 'März 2026', ernte: 'Mai 2026', nachfolger: 'Buschbohne' },
      { pflanze: 'Buschbohne', gepflanzt: 'Mai 2026', ernte: 'August 2026', nachfolger: 'Spinat' },
      { pflanze: 'Spinat', gepflanzt: 'August 2026', ernte: 'Februar 2027', nachfolger: '-' },
    ],
  },
];

// Gartenplan-Daten – Saison 2026
// version bump zwingt localStorage-Migration (siehe App.jsx)
export const GARDEN_DATA_VERSION = '2026-v7';

export const gardenData = [
  {
    // PDF: Beet 1 → Aussaat essbare Blüten Mix
    beet: 1,
    label: 'Beet 1',
    reihen: [
      {
        aussaat: true,
        kulturen: ['Borretsch', 'Kornblume', 'Ringelblume', 'Speisechrysantheme'],
        hinweis: 'Essbare Blüten Mix',
      },
    ],
    pflanzen: ['Borretsch', 'Kornblume', 'Ringelblume', 'Speisechrysantheme'],
    gepflanzt: '2026-04-19',
    ernte: 'Jun–Okt',
    naechste: 'Feldsalat (Nov)',
    erntbarIm: ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10'],
    faellig: '2026-10-31',
  },
  {
    // PDF: Beet 2 → Frei
    beet: 2,
    label: 'Beet 2 – Frei',
    reihen: [
      { hinweis: '🟫 Frei – noch keine Bepflanzung geplant' },
    ],
    pflanzen: [],
    gepflanzt: '2026-09-01',
    ernte: 'k.A.',
    naechste: 'k.A.',
    erntbarIm: [],
    faellig: '2026-09-01',
  },
  {
    // PDF: Beet 3 → 30cm Salat · 30cm Rauke/Wildkräuter · 20cm Kräuter
    beet: 3,
    label: 'Beet 3',
    reihen: [
      { abstand: 30, kulturen: ['Salanova', 'Batavia', 'Eichblatt', 'Lollo', 'Romana'] },
      { abstand: 30, kulturen: ['Wilde Rauke', 'Hirschhornwegerich', 'Asia Salat Mischung', 'Barbarakraut'] },
      { abstand: 20, kulturen: ['Pimpinelle', 'Petersilie glatt', 'Petersilie kraus', 'Blutampfer', 'Dill', 'Koriander', 'Schnittlauch'] },
    ],
    pflanzen: ['Salanova', 'Batavia', 'Eichblatt', 'Lollo', 'Romana', 'Wilde Rauke', 'Hirschhornwegerich', 'Asia Salat Mischung', 'Barbarakraut', 'Pimpinelle', 'Petersilie glatt', 'Petersilie kraus', 'Blutampfer', 'Dill', 'Koriander', 'Schnittlauch'],
    gepflanzt: '2026-04-19',
    ernte: 'Mai–Jul',
    naechste: 'Herbstsalat (Aug)',
    erntbarIm: ['2026-05', '2026-06', '2026-07'],
    faellig: '2026-07-15',
  },
  {
    // PDF: Beet 4 → 15cm Zwiebeln/Schalotten · 40cm Kohl · Aussaat Erbse
    beet: 4,
    label: 'Beet 4',
    reihen: [
      { abstand: 15, kulturen: ['Bundzwiebel mit Bulbe', 'Gemüsezwiebel', 'Schalotten', 'Rijnsburger gelb'] },
      { abstand: 40, kulturen: ['Chinakohl', 'Grünkohl', 'Spitzkohl', 'Brokkoli'] },
      { aussaat: true, kulturen: ['Erbse'], hinweis: 'Saatgut wird bereitgestellt' },
    ],
    pflanzen: ['Bundzwiebel', 'Gemüsezwiebel', 'Schalotten', 'Chinakohl', 'Grünkohl', 'Spitzkohl', 'Brokkoli', 'Erbsen'],
    gepflanzt: '2026-04-19',
    ernte: 'Jun–Okt',
    naechste: 'Feldsalat (Nov)',
    erntbarIm: ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10'],
    faellig: '2026-10-15',
  },
  {
    // PDF: Beet 5 → Aussaat Radieschen · 10cm Rote/Gelbe Beete/Mairübe · 30cm Raddichio/Mangold/Fenchel/Kohlrabi
    beet: 5,
    label: 'Beet 5',
    reihen: [
      { aussaat: true, kulturen: ['Radieschen'], hinweis: 'Eigenständige Aussaat, Saatgut wird bereitgestellt' },
      { abstand: 10, kulturen: ['Rote Beete', 'Gelbe Beete', 'Mairübe'] },
      { abstand: 30, kulturen: ['Raddichio', 'Mangold', 'Fenchel', 'Kohlrabi'] },
    ],
    pflanzen: ['Radieschen', 'Rote Beete', 'Gelbe Beete', 'Mairübe', 'Raddichio', 'Mangold', 'Fenchel', 'Kohlrabi'],
    gepflanzt: '2026-04-19',
    ernte: 'Mai–Sep',
    naechste: 'Spinat (Okt)',
    erntbarIm: ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09'],
    faellig: '2026-09-30',
  },
];



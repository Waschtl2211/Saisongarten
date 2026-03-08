import React, { useState } from 'react';
import { beetData } from './data';
import BeetCard from './BeetCard';

const monate = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

function Timeline({ monat, setMonat }) {
  return (
    <div className="flex flex-wrap gap-2 justify-center my-8">
      {monate.map((m) => (
        <button
          key={m}
          className={`btn-timeline ${m === monat ? 'btn-timeline-active' : ''}`}
          onClick={() => setMonat(m)}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

function Modal({ beet, onClose }) {
  if (!beet) return null;
  return (
    <div className="modal-bg">
      <div className="modal-box">
        <button className="absolute top-3 right-4 text-gray-400 hover:text-gray-700 dark:hover:text-white text-2xl" onClick={onClose}>&times;</button>
        <h2 className="text-2xl font-bold mb-4">Beet {beet.beet}: {beet.pflanze}</h2>
        <div className="space-y-2">
          <div className="text-sm text-gray-500 dark:text-gray-400">Status: <span className="font-medium text-gray-900 dark:text-gray-100">{beet.status}</span></div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Nächste Aktion: <span className="font-medium text-gray-900 dark:text-gray-100">{beet.naechsteAktion}</span></div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Erntbar ab: <span className="font-medium text-gray-900 dark:text-gray-100">{beet.erntbarVon}</span></div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [monat, setMonat] = useState('März');
  const [selectedBeet, setSelectedBeet] = useState(null);

  // Filter: Zeige alle Beete, die im aktuellen Monat relevant sind
  const filtered = beetData.filter((b) => {
    // Erntezeitpunkt oder Status enthält aktuellen Monat
    return (
      (b.erntbarVon && b.erntbarVon.toLowerCase() === monat.toLowerCase()) ||
      (b.status && b.status.toLowerCase().includes(monat.toLowerCase()))
    );
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100 transition-colors">
      <header className="py-10 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">Garten Beetplaner</h1>
        <p className="text-lg text-gray-500 dark:text-gray-400">Monatlicher Überblick & Planung</p>
      </header>
      <Timeline monat={monat} setMonat={setMonat} />
      <main className="max-w-5xl mx-auto px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
          {(filtered.length ? filtered : beetData).map((beet) => (
            <BeetCard
              key={beet.beet}
              beet={beet}
              monat={monat}
              onClick={() => setSelectedBeet(beet)}
            />
          ))}
        </div>
      </main>
      <Modal beet={selectedBeet} onClose={() => setSelectedBeet(null)} />
      <footer className="text-center py-10 text-xs text-gray-400">
        &copy; 2026 Saisongarten App
      </footer>
    </div>
  );
}

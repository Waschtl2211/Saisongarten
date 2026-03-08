import React from 'react';

const statusColors = {
  gepflanzt: 'bg-green-100 text-green-700',
  erntbar: 'bg-yellow-100 text-yellow-600',
  faellig: 'bg-red-100 text-red-700',
};

function getStatusColor(status, erntbarVon, monat) {
  if (status.includes('gepflanzt')) return statusColors.gepflanzt;
  if (erntbarVon && erntbarVon.toLowerCase() === monat.toLowerCase()) return statusColors.erntbar;
  if (status.toLowerCase().includes('fällig')) return statusColors.faellig;
  return 'bg-gray-100 text-gray-800';
}

export default function BeetCard({ beet, onClick, monat }) {
  const color = getStatusColor(beet.status, beet.erntbarVon, monat);
  return (
    <div
      className={`card-min cursor-pointer group ${color}`}
      onClick={onClick}
      tabIndex={0}
      role="button"
      aria-label={`Details zu Beet ${beet.beet}: ${beet.pflanze}`}
    >
      <div className="flex items-center gap-3 mb-2">
        <span className="inline-block w-8 h-8 rounded-full bg-green-200 dark:bg-green-800 flex items-center justify-center font-bold text-green-800 dark:text-green-200 text-lg shadow-sm border border-green-300 dark:border-green-700">{beet.beet}</span>
        <h3 className="font-semibold text-xl tracking-tight flex-1">{beet.pflanze}</h3>
      </div>
      <div className="space-y-1">
        <div className="text-xs text-gray-700 dark:text-gray-300">Status:</div>
        <div className="font-medium text-sm mb-1 text-gray-900 dark:text-gray-100">{beet.status}</div>
        <div className="text-xs text-gray-700 dark:text-gray-300">Nächste Aktion:</div>
        <div className="text-sm mb-1 text-gray-900 dark:text-gray-100">{beet.naechsteAktion}</div>
        <div className="text-xs text-gray-700 dark:text-gray-300">Erntbar ab:</div>
        <div className="text-sm text-gray-900 dark:text-gray-100">{beet.erntbarVon}</div>
      </div>
    </div>
  );
}

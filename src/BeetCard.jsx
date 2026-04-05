import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const statusIcon = (status, erntbarVon, monat) => {
  if (status.includes("gepflanzt")) return <span title="gepflanzt" aria-label="gepflanzt" className="mr-1">🌱</span>;
  if (erntbarVon && erntbarVon.toLowerCase() === monat.toLowerCase()) return <span title="erntbar" aria-label="erntbar" className="mr-1">🥬</span>;
  if (status.toLowerCase().includes("fällig")) return <span title="fällig" aria-label="fällig" className="mr-1">⏰</span>;
  return null;
};

export default function BeetCard({ beet, onClick, monat }) {
  return (
    <Card
      className="cursor-pointer hover:ring-2 hover:ring-green-400 transition"
      onClick={onClick}
      tabIndex={0}
      role="button"
      aria-label={`Details zu ${beet.name}`}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="inline-block w-8 h-8 rounded-full bg-green-200 dark:bg-green-800 flex items-center justify-center font-bold text-green-800 dark:text-green-200 text-lg shadow-sm border border-green-300 dark:border-green-700">{beet.beet}</span>
          {beet.name}
        </CardTitle>
        <CardDescription>
          <div className="flex items-center text-base font-medium mb-1">
            {statusIcon(beet.status, beet.erntbarVon, monat)}
            {beet.status}
          </div>
          <div className="text-xs text-gray-700 dark:text-gray-300">Aktuell: {beet.aktuellePflanzen.join(", ")}</div>
          <div className="text-xs text-gray-700 dark:text-gray-300">Nächste Aktion: {beet.naechsteAktion}</div>
          <div className="text-xs text-gray-700 dark:text-gray-300">Erntbar ab: {beet.erntbarVon}</div>
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

import React from 'react';
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, rectSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { pflanzeName } from '../lib/plantMigration.js';

/** Gibt true zurück wenn diese Pflanze heute gegossen werden sollte. */
function pflanzeNeedsWater(pflanze, selectedDate, giessenLog, beetId) {
  const intervall = pflanze.giessIntervall || 3;
  const beetLogEntries = (giessenLog || []).filter(e => e.beetId === beetId);
  if (!beetLogEntries.length) return true;
  const lastEntry = beetLogEntries.reduce((a, b) => a.datum > b.datum ? a : b);
  const daysSince = Math.floor((selectedDate - new Date(lastEntry.datum)) / 86400000);
  return daysSince >= intervall;
}

function SortablePflanzTile({ pflanze, modus, selectedDate, giessenNoetig, onEdit }) {
  const id = pflanze.id || pflanze.name;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const name = pflanzeName(pflanze);
  const icon = typeof pflanze === 'object' ? pflanze.icon : '🌱';

  if (modus === 'anordnen') {
    return (
      <div ref={setNodeRef} style={style} {...attributes} {...listeners}
        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2 text-center cursor-grab active:cursor-grabbing select-none touch-none shadow-sm"
      >
        <div className="text-2xl">{icon}</div>
        <div className="text-[11px] font-semibold text-gray-800 dark:text-gray-200 mt-1 truncate">{name}</div>
      </div>
    );
  }

  // Modus C: kompakt mit Infos + Edit-Button
  const erntabadge = (() => {
    if (!pflanze.erntbarIm || !selectedDate) return null;
    const ym = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`;
    if (pflanze.erntbarIm.includes(ym)) return { text: 'Ernte jetzt', cls: 'bg-green-100 text-green-800 dark:bg-green-900/60 dark:text-green-200' };
    if (pflanze.faellig) {
      const tage = Math.ceil((new Date(pflanze.faellig) - selectedDate) / 86400000);
      if (tage >= 0 && tage <= 14) return { text: `Fällig ${new Date(pflanze.faellig).toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit' })}`, cls: 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200' };
    }
    if (pflanze.ernte) return { text: pflanze.ernte, cls: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/60 dark:text-yellow-200' };
    return null;
  })();

  const gepflanztAnzeige = pflanze.gepflanzt
    ? new Date(pflanze.gepflanzt).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })
    : null;

  return (
    <div ref={setNodeRef} style={style} {...attributes}
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-2 shadow-sm flex flex-col gap-1"
    >
      <div className="flex justify-between items-start">
        <span className="text-2xl" {...listeners} style={{ cursor: 'grab', touchAction: 'none' }}>{icon}</span>
        {erntabadge && (
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium leading-tight ${erntabadge.cls}`}>
            {erntabadge.text}
          </span>
        )}
      </div>
      <div className="text-[11px] font-semibold text-gray-800 dark:text-gray-200 truncate">{name}</div>
      {gepflanztAnzeige && (
        <div className="text-[10px] text-gray-500 dark:text-gray-400">📅 {gepflanztAnzeige}</div>
      )}
      <div className={`text-[10px] font-medium ${giessenNoetig ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`}>
        {giessenNoetig ? '💧 Gießen!' : '💧 OK'}
      </div>
      <button
        onClick={() => onEdit(pflanze)}
        className="mt-0.5 text-[10px] bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 rounded-md py-0.5 w-full hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
      >
        ✏️ Bearbeiten
      </button>
    </div>
  );
}

function PlusKachel({ onAdd, modus }) {
  return (
    <button
      onClick={onAdd}
      className={`bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-2 text-center text-gray-400 dark:text-gray-500 hover:border-green-400 hover:text-green-600 dark:hover:text-green-400 transition-colors flex flex-col items-center justify-center ${modus === 'bearbeiten' ? 'min-h-[100px]' : ''}`}
    >
      <span className="text-xl">＋</span>
      <span className="text-[10px] mt-1">Pflanze hinzufügen</span>
    </button>
  );
}

export default function PflanzenGrid({ pflanzen, modus, selectedDate, giessenLog, wetterDaten, beetId, onPflanzenChange, onEditPflanze, onAddPflanze }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const ids = pflanzen.map(p => p.id || p.name);

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = ids.indexOf(active.id);
    const newIdx = ids.indexOf(over.id);
    if (oldIdx !== -1 && newIdx !== -1) {
      onPflanzenChange(arrayMove(pflanzen, oldIdx, newIdx));
    }
  }

  const cols = modus === 'bearbeiten' ? 'grid-cols-2' : 'grid-cols-3';

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className={`grid ${cols} gap-2 mt-3`}>
          {pflanzen.map((pflanze) => (
            <SortablePflanzTile
              key={pflanze.id || pflanze.name}
              pflanze={pflanze}
              modus={modus}
              selectedDate={selectedDate}
              giessenNoetig={pflanzeNeedsWater(pflanze, selectedDate, giessenLog, beetId)}
              onEdit={onEditPflanze}
            />
          ))}
          <PlusKachel onAdd={onAddPflanze} modus={modus} />
        </div>
      </SortableContext>
    </DndContext>
  );
}

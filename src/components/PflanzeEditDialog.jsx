import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { parseErntbarIm } from '../lib/plantMigration.js';

const EMOJI_VORSCHLAEGE = ['🍅','🫑','🍆','🥬','🥕','🧅','🧄','🌽','🥦','🌿','🍃','🌱','🌸','💙','🟠','🌾','🫛','🥒','🍓','🫐'];

const INPUT_CLS = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-400";

const EMPTY_ENTRY = {
  id: '',
  name: '',
  icon: '🌱',
  gepflanzt: '',
  faellig: '',
  ernte: '',
  giessIntervall: 3,
  giessIntensitaet: 'mittel',
  naechsteKultur: '',
  hinweis: '',
};

export default function PflanzeEditDialog({ open, pflanze, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(EMPTY_ENTRY);

  useEffect(() => {
    if (pflanze) setForm({ ...EMPTY_ENTRY, ...pflanze });
    else setForm(EMPTY_ENTRY);
  }, [pflanze]);

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function handleIconClick(ev) { set('icon', ev.currentTarget.dataset.emoji); }

  function handleSave() {
    const trimmedName = form.name.trim();
    if (!trimmedName) return;
    const jahr = form.gepflanzt ? new Date(form.gepflanzt).getFullYear() : new Date().getFullYear();
    const saved = {
      ...form,
      name: trimmedName,
      id: form.id || `${trimmedName.toLowerCase().replace(/\s+/g,'_')}_${Date.now()}`,
      erntbarIm: parseErntbarIm(form.ernte, jahr),
      giessIntervall: Number(form.giessIntervall) || 3,
    };
    onSave(saved);
  }

  return (
    <Dialog open={open} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{form.icon}</span>
            {pflanze ? 'Pflanze bearbeiten' : 'Pflanze hinzufügen'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-1">
          <div>
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">ICON</div>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {EMOJI_VORSCHLAEGE.map(e => (
                <button key={e} data-emoji={e} onClick={handleIconClick}
                  className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center border transition-colors ${form.icon === e ? 'border-green-500 bg-green-50 dark:bg-green-900/30' : 'border-gray-200 dark:border-gray-700 hover:border-gray-400'}`}>
                  {e}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Eigenes Emoji eingeben…"
              value={EMOJI_VORSCHLAEGE.includes(form.icon) ? '' : form.icon}
              onChange={e => set('icon', e.target.value || '🌱')}
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label htmlFor="pfd-name" className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">NAME</label>
            <input
              id="pfd-name"
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="z.B. Tomaten"
              className={INPUT_CLS}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="pfd-gepflanzt" className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">GEPFLANZT</label>
              <input
                id="pfd-gepflanzt"
                type="date"
                value={form.gepflanzt}
                onChange={e => set('gepflanzt', e.target.value)}
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label htmlFor="pfd-faellig" className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">FÄLLIG AM</label>
              <input
                id="pfd-faellig"
                type="date"
                value={form.faellig}
                onChange={e => set('faellig', e.target.value)}
                className={INPUT_CLS}
              />
            </div>
          </div>

          <div>
            <label htmlFor="pfd-ernte" className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">ERNTEZEIT (z.B. "Aug–Okt")</label>
            <input
              id="pfd-ernte"
              type="text"
              value={form.ernte}
              onChange={e => set('ernte', e.target.value)}
              placeholder="Aug–Okt"
              className={INPUT_CLS}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="pfd-intervall" className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">GIEß-INTERVALL (Tage)</label>
              <input
                id="pfd-intervall"
                type="number"
                min="1"
                max="30"
                value={form.giessIntervall}
                onChange={e => set('giessIntervall', e.target.value)}
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label htmlFor="pfd-intensitaet" className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">INTENSITÄT</label>
              <select
                id="pfd-intensitaet"
                value={form.giessIntensitaet}
                onChange={e => set('giessIntensitaet', e.target.value)}
                className={INPUT_CLS}
              >
                <option value="hoch">hoch</option>
                <option value="mittel">mittel</option>
                <option value="niedrig">niedrig</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="pfd-naechste" className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">NACHFOLGEKULTUR</label>
            <input
              id="pfd-naechste"
              type="text"
              value={form.naechsteKultur}
              onChange={e => set('naechsteKultur', e.target.value)}
              placeholder="z.B. Feldsalat (Okt)"
              className={INPUT_CLS}
            />
          </div>

          <div>
            <label htmlFor="pfd-hinweis" className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">HINWEIS</label>
            <textarea
              id="pfd-hinweis"
              value={form.hinweis}
              onChange={e => set('hinweis', e.target.value)}
              placeholder="Tipps zur Pflege…"
              rows={2}
              className={`${INPUT_CLS} resize-none`}
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={handleSave}
            disabled={!form.name.trim()}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white py-2 rounded-lg text-sm font-semibold"
          >
            Speichern
          </button>
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 py-2 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Abbrechen
          </button>
          {pflanze && (
            <button
              onClick={onDelete}
              className="border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 py-2 px-3 rounded-lg text-sm hover:bg-red-50 dark:hover:bg-red-900/30"
              title="Pflanze entfernen"
            >
              🗑
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

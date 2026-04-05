import React, { useState } from 'react';
import { getProfilePin, setProfilePin } from './lib/storage.js';

const AVATAR_COLORS = [
  { key: 'green',  bg: 'bg-green-500',  label: 'Grün' },
  { key: 'blue',   bg: 'bg-blue-500',   label: 'Blau' },
  { key: 'violet', bg: 'bg-violet-500', label: 'Violett' },
  { key: 'orange', bg: 'bg-orange-500', label: 'Orange' },
  { key: 'rose',   bg: 'bg-rose-500',   label: 'Rosa' },
  { key: 'teal',   bg: 'bg-teal-500',   label: 'Türkis' },
];

const DELETE_PIN = '910767';

function getAvatarBg(color) {
  return AVATAR_COLORS.find(c => c.key === color)?.bg || 'bg-gray-400';
}

function initials(name) {
  return name.trim().slice(0, 2).toUpperCase();
}

export default function ProfileScreen({ profiles, onSelect, onAdd, onDelete }) {
  const [addMode, setAddMode] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('blue');
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');

  const [pinTarget, setPinTarget] = useState(null); // profileId being unlocked
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const [changePinFor, setChangePinFor] = useState(null);
  const [oldPinInput, setOldPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [newPinConfirmInput, setNewPinConfirmInput] = useState('');
  const [changePinError, setChangePinError] = useState('');

  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deletePinInput, setDeletePinInput] = useState('');
  const [deletePinError, setDeletePinError] = useState(false);

  function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    if (newPin.length < 4) return;
    if (newPin !== newPinConfirm) return;
    const id = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + Date.now();
    onAdd({ id, name, color: newColor, pin: newPin });
    setNewName(''); setNewColor('blue'); setNewPin(''); setNewPinConfirm('');
    setAddMode(false);
  }

  function handlePinLogin() {
    const stored = getProfilePin(pinTarget);
    if (pinInput === stored) {
      onSelect(pinTarget);
      setPinTarget(null); setPinInput(''); setPinError(false);
    } else {
      setPinError(true);
    }
  }

  function handleChangePin() {
    const stored = getProfilePin(changePinFor);
    if (oldPinInput !== stored) { setChangePinError('Alter PIN falsch'); return; }
    if (newPinInput.length < 4) { setChangePinError('PIN muss mindestens 4 Stellen haben'); return; }
    if (newPinInput !== newPinConfirmInput) { setChangePinError('PINs stimmen nicht überein'); return; }
    setProfilePin(changePinFor, newPinInput);
    setChangePinFor(null); setOldPinInput(''); setNewPinInput(''); setNewPinConfirmInput(''); setChangePinError('');
  }

  function resetChangePinState() {
    setChangePinFor(null); setOldPinInput(''); setNewPinInput(''); setNewPinConfirmInput(''); setChangePinError('');
  }

  function handleDeleteConfirm() {
    if (deletePinInput === DELETE_PIN) { onDelete(deleteConfirm); setDeleteConfirm(null); setDeletePinInput(''); }
    else setDeletePinError(true);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🌱</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Saisongarten</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Wer gärtnert heute?</p>
        </div>

        {/* Profile list */}
        <div className="space-y-2 mb-4">
          {profiles.map(p => (
            <div key={p.id} className="flex items-center gap-2">
              <button
                onClick={() => { setPinTarget(p.id); setPinInput(''); setPinError(false); }}
                className="flex-1 flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 hover:ring-2 hover:ring-green-400 transition-all text-left shadow-sm"
              >
                <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-white font-bold text-sm shrink-0 ${getAvatarBg(p.color)}`}>
                  {initials(p.name)}
                </span>
                <span className="font-medium text-gray-900 dark:text-gray-100 flex-1">{p.name}</span>
                <span className="text-gray-400 dark:text-gray-500">→</span>
              </button>
              {/* Delete button – only shown if more than 1 profile */}
              {profiles.length > 1 && (
                <button
                  onClick={() => setDeleteConfirm(p.id)}
                  className="w-9 h-9 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-red-400 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 hover:border-red-300 text-sm flex items-center justify-center shadow-sm transition-colors shrink-0"
                  title="Profil löschen"
                >×</button>
              )}
            </div>
          ))}
        </div>

        {/* Add new profile */}
        {!addMode ? (
          <button
            onClick={() => setAddMode(true)}
            className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl py-3 text-sm text-gray-500 dark:text-gray-400 hover:border-green-400 hover:text-green-600 transition-colors"
          >
            <span className="text-lg">+</span> Neues Profil
          </button>
        ) : (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Neues Profil</div>
            <input
              autoFocus
              type="text"
              placeholder="Name eingeben…"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 mb-3 focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Farbe:</div>
            <div className="flex gap-2 mb-3">
              {AVATAR_COLORS.map(c => (
                <button
                  key={c.key}
                  onClick={() => setNewColor(c.key)}
                  className={`w-7 h-7 rounded-full ${c.bg} transition-transform ${newColor === c.key ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'}`}
                  title={c.label}
                />
              ))}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">PIN (min. 4 Stellen):</div>
            <input
              type="password"
              inputMode="numeric"
              placeholder="PIN wählen…"
              value={newPin}
              onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 mb-2 focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            <input
              type="password"
              inputMode="numeric"
              placeholder="PIN bestätigen…"
              value={newPinConfirm}
              onChange={e => setNewPinConfirm(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              className={`w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 mb-3 focus:outline-none focus:ring-2 ${
                newPinConfirm && newPin !== newPinConfirm ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 dark:border-gray-600 focus:ring-green-400'
              }`}
            />
            {newPinConfirm && newPin !== newPinConfirm && (
              <div className="text-xs text-red-500 mb-2">PINs stimmen nicht überein</div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={!newName.trim() || newPin.length < 4 || newPin !== newPinConfirm}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white py-2 rounded-lg text-sm font-medium"
              >
                Erstellen
              </button>
              <button
                onClick={() => { setAddMode(false); setNewName(''); setNewPin(''); setNewPinConfirm(''); }}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}
      </div>

      {/* PIN Login dialog */}
      {pinTarget && (() => {
        const profile = profiles.find(p => p.id === pinTarget);
        return (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 max-w-xs w-full shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-white font-bold text-sm shrink-0 ${getAvatarBg(profile?.color)}`}>
                  {initials(profile?.name || '')}
                </span>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">{profile?.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">PIN eingeben</div>
                </div>
              </div>
              <input
                autoFocus
                type="password"
                inputMode="numeric"
                placeholder="PIN…"
                value={pinInput}
                onChange={e => { setPinInput(e.target.value); setPinError(false); }}
                onKeyDown={e => e.key === 'Enter' && handlePinLogin()}
                className={`w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 mb-1 focus:outline-none focus:ring-2 text-center tracking-widest text-lg ${
                  pinError ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 dark:border-gray-600 focus:ring-green-400'
                }`}
              />
              <div className="h-4 mb-3">
                {pinError && <span className="text-xs text-red-500">Falscher PIN</span>}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handlePinLogin}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-medium"
                >
                  Öffnen
                </button>
                <button
                  onClick={() => { setPinTarget(null); setPinInput(''); setPinError(false); }}
                  className="flex-1 border border-gray-200 dark:border-gray-700 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Change PIN dialog */}
      {changePinFor && (() => {
        const profile = profiles.find(p => p.id === changePinFor);
        return (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 max-w-xs w-full shadow-xl">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">PIN ändern</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">{profile?.name}</div>
              <input
                autoFocus
                type="password"
                inputMode="numeric"
                placeholder="Alter PIN…"
                value={oldPinInput}
                onChange={e => { setOldPinInput(e.target.value); setChangePinError(''); }}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 mb-2 focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              <input
                type="password"
                inputMode="numeric"
                placeholder="Neuer PIN…"
                value={newPinInput}
                onChange={e => { setNewPinInput(e.target.value); setChangePinError(''); }}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 mb-2 focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              <input
                type="password"
                inputMode="numeric"
                placeholder="Neuer PIN bestätigen…"
                value={newPinConfirmInput}
                onChange={e => { setNewPinConfirmInput(e.target.value); setChangePinError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleChangePin()}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 mb-1 focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              <div className="h-4 mb-2">
                {changePinError && <span className="text-xs text-red-500">{changePinError}</span>}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleChangePin}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-medium"
                >
                  Speichern
                </button>
                <button
                  onClick={resetChangePinState}
                  className="flex-1 border border-gray-200 dark:border-gray-700 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete confirmation dialog */}
      {deleteConfirm && (() => {
        const profile = profiles.find(p => p.id === deleteConfirm);
        return (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 max-w-xs w-full shadow-xl">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Profil löschen?</div>
              <div className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                Alle Daten von <strong>{profile?.name}</strong> werden dauerhaft gelöscht.
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Master-PIN zur Bestätigung:</div>
              <input
                autoFocus
                type="password"
                inputMode="numeric"
                placeholder="PIN eingeben…"
                value={deletePinInput}
                onChange={e => { setDeletePinInput(e.target.value); setDeletePinError(false); }}
                onKeyDown={e => e.key === 'Enter' && handleDeleteConfirm()}
                className={`w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 mb-1 focus:outline-none focus:ring-2 ${
                  deletePinError ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 dark:border-gray-600 focus:ring-green-400'
                }`}
              />
              <div className="h-4 mb-2">
                {deletePinError && <span className="text-xs text-red-500">Falscher PIN</span>}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteConfirm}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm font-medium"
                >
                  Löschen
                </button>
                <button
                  onClick={() => { setDeleteConfirm(null); setDeletePinInput(''); setDeletePinError(false); }}
                  className="flex-1 border border-gray-200 dark:border-gray-700 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

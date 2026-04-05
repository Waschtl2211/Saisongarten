import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import ProfileScreen from './ProfileScreen.jsx';
import {
  loadProfiles, saveProfiles,
  loadCurrentProfileId, saveCurrentProfileId,
  migrateLegacyData,
  loadProfilePins, saveProfilePins, setProfilePin, removeProfilePin,
} from './lib/storage.js';

// ── Seed profiles on very first launch ───────────────────────────────────────
function initProfiles() {
  let profiles = loadProfiles();
  if (profiles.length === 0) {
    profiles = [
      { id: 'waschtl', name: 'Waschtl', color: 'green' },
      { id: 'gabriel', name: 'Gabriel', color: 'blue' },
    ];
    saveProfiles(profiles);
    migrateLegacyData('waschtl');
  }
  // Seed default PINs if not yet set
  const pins = loadProfilePins();
  if (!pins['waschtl']) setProfilePin('waschtl', '221187');
  if (!pins['gabriel']) setProfilePin('gabriel', '000000');
  return profiles;
}

function Root() {
  const [profiles, setProfiles] = useState(() => initProfiles());
  const [currentProfileId, setCurrentProfileId] = useState(() => loadCurrentProfileId());

  // Apply dark mode before first paint
  useEffect(() => {
    const dm = localStorage.getItem('darkMode');
    if (dm === 'true') document.documentElement.classList.add('dark');
    const fs = localStorage.getItem('fontSize');
    if (fs) document.documentElement.setAttribute('data-font-size', fs);
    const ac = localStorage.getItem('accentColor');
    if (ac && ac !== 'green') document.documentElement.setAttribute('data-accent', ac);
  }, []);

  function handleSelect(id) {
    saveCurrentProfileId(id);
    setCurrentProfileId(id);
  }

  function handleAdd(profile) {
    setProfilePin(profile.id, profile.pin || '0000');
    const { pin, ...profileData } = profile;
    const next = [...profiles, profileData];
    setProfiles(next);
    saveProfiles(next);
    handleSelect(profile.id);
  }

  function handleDelete(id) {
    const keysToDelete = ['beete', 'beetDataVersion', 'archivierteBeete', 'giessenLog', 'pinnedBeete', 'beetNotizen', 'ernteLog'];
    keysToDelete.forEach(k => localStorage.removeItem(`${k}_${id}`));
    removeProfilePin(id);
    const next = profiles.filter(p => p.id !== id);
    setProfiles(next);
    saveProfiles(next);
    if (currentProfileId === id) {
      const newCurrent = next[0]?.id || null;
      saveCurrentProfileId(newCurrent || '');
      setCurrentProfileId(newCurrent);
    }
  }

  function handleSwitchProfile() {
    saveCurrentProfileId('');
    setCurrentProfileId(null);
  }

  const currentProfile = profiles.find(p => p.id === currentProfileId);

  if (!currentProfileId || !currentProfile) {
    return (
      <ProfileScreen
        profiles={profiles}
        onSelect={handleSelect}
        onAdd={handleAdd}
        onDelete={handleDelete}
      />
    );
  }

  return (
    <App
      key={currentProfileId}
      profileId={currentProfileId}
      profileName={currentProfile.name}
      profileColor={currentProfile.color}
      onSwitchProfile={handleSwitchProfile}
    />
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);

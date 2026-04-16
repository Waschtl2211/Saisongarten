import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { SignInPage } from './components/ui/sign-in.tsx';
import { migrateLegacyData, setProfilePin, loadProfilePins } from './lib/storage.js';

function initWaschtl() {
  const pins = loadProfilePins();
  if (!pins['waschtl']) setProfilePin('waschtl', '221187');
  migrateLegacyData('waschtl');
}

function Root() {
  const [signedIn, setSignedIn] = useState(() => localStorage.getItem('signedIn') === 'true');

  useEffect(() => {
    initWaschtl();
    // Apply saved display preferences before first paint
    const dm = localStorage.getItem('darkMode');
    if (dm === 'true') document.documentElement.classList.add('dark');
    const fs = localStorage.getItem('fontSize');
    if (fs) document.documentElement.setAttribute('data-font-size', fs);
    const ac = localStorage.getItem('accentColor');
    if (ac && ac !== 'green') document.documentElement.setAttribute('data-accent', ac);
  }, []);

  function handleSignIn(e) {
    if (e?.preventDefault) e.preventDefault();
    localStorage.setItem('signedIn', 'true');
    setSignedIn(true);
  }

  function handleSignOut() {
    localStorage.removeItem('signedIn');
    setSignedIn(false);
  }

  if (!signedIn) {
    return (
      <SignInPage
        title={<span className="font-semibold tracking-tight">Saisongarten 🌱</span>}
        description="Melde dich an um deinen Gartenplan zu öffnen"
        onSignIn={handleSignIn}
        onGoogleSignIn={handleSignIn}
        onResetPassword={() => {}}
        onCreateAccount={() => {}}
      />
    );
  }

  return (
    <App
      key="waschtl"
      profileId="waschtl"
      profileName="Waschtl"
      profileColor="green"
      onSwitchProfile={handleSignOut}
    />
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);

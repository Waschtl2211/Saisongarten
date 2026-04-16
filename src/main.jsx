import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import GoTrue from 'gotrue-js';
import './index.css';
import App from './App.jsx';
import { SignInPage } from './components/ui/sign-in.tsx';
import { migrateLegacyData, setProfilePin, loadProfilePins } from './lib/storage.js';

const auth = new GoTrue({ APIUrl: '/.netlify/identity', setCookie: false });

function initWaschtl() {
  const pins = loadProfilePins();
  if (!pins['waschtl']) setProfilePin('waschtl', '221187');
  migrateLegacyData('waschtl');
}

function parseHash(hash) {
  const str = hash.startsWith('#') ? hash.slice(1) : hash;
  return Object.fromEntries(new URLSearchParams(str));
}

function Root() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pageMode, setPageMode] = useState('signin');
  const [hashParams, setHashParams] = useState(null);

  useEffect(() => {
    initWaschtl();
    // Apply saved display preferences before first paint
    const dm = localStorage.getItem('darkMode');
    if (dm === 'true') document.documentElement.classList.add('dark');
    const fs = localStorage.getItem('fontSize');
    if (fs) document.documentElement.setAttribute('data-font-size', fs);
    const ac = localStorage.getItem('accentColor');
    if (ac && ac !== 'green') document.documentElement.setAttribute('data-accent', ac);

    // Parse and clear hash fragment
    if (window.location.hash) {
      const params = parseHash(window.location.hash);
      setHashParams(params);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }

    // Recover existing session
    const existing = auth.currentUser();
    if (existing) setUser(existing);
    setAuthReady(true);
  }, []);

  // Handle hash-based OAuth / recovery / invite callbacks
  useEffect(() => {
    if (!hashParams) return;

    const { access_token, type, invite_token } = hashParams;

    if (type === 'invite' && invite_token) {
      setPageMode('accept-invite');
      return;
    }

    if ((type === 'token' || type === 'recovery') && access_token) {
      setLoading(true);
      setError(null);
      auth.createUser(hashParams, true)
        .then(u => { setUser(u); setLoading(false); })
        .catch(err => {
          setError(err.message || 'Authentifizierung fehlgeschlagen.');
          setLoading(false);
        });
    }
  }, [hashParams]);

  async function handleSignIn(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = form.email.value.trim();
    const password = form.password.value;
    if (!email || !password) {
      setError('Bitte E-Mail und Passwort eingeben.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const u = await auth.login(email, password, true);
      setUser(u);
    } catch (err) {
      setError(err.message || 'Anmeldung fehlgeschlagen. Bitte prüfe deine Zugangsdaten.');
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleSignIn() {
    window.location.href = auth.loginExternalUrl('google');
  }

  async function handleResetPassword() {
    const email = window.prompt('Bitte gib deine E-Mail-Adresse ein:');
    if (!email) return;
    setLoading(true);
    setError(null);
    try {
      await auth.requestPasswordRecovery(email);
      setError('Passwort-Reset-E-Mail wurde gesendet. Bitte prüfe deinen Posteingang.');
    } catch (err) {
      setError(err.message || 'Fehler beim Senden der Reset-E-Mail.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAcceptInvite(password) {
    const invite_token = hashParams?.invite_token;
    if (!invite_token) {
      setError('Kein Einladungstoken gefunden. Bitte öffne den Link aus der Einladungs-E-Mail erneut.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const u = await auth.acceptInvite(invite_token, password, true);
      setUser(u);
    } catch (err) {
      setError(err.message || 'Einladung konnte nicht angenommen werden.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    try {
      await user.logout();
    } catch (_) {
      // ignore logout errors
    }
    setUser(null);
    setPageMode('signin');
  }

  if (!authReady) return null;

  if (!user) {
    return (
      <SignInPage
        title={<span className="font-semibold tracking-tight">Saisongarten 🌱</span>}
        description="Melde dich an um deinen Gartenplan zu öffnen"
        onSignIn={handleSignIn}
        onGoogleSignIn={handleGoogleSignIn}
        onResetPassword={handleResetPassword}
        onCreateAccount={() => {}}
        isLoading={loading}
        errorMessage={error}
        mode={pageMode}
        onAcceptInvite={handleAcceptInvite}
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

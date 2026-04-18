import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import GoTrue from 'gotrue-js';
import './index.css';
import App from './App.jsx';
import { SignInPage } from './components/ui/sign-in.tsx';
import {
  migrateLegacyData,
  migrateWaschtlToMustergarten,
  profileKey,
  getProfileMapping,
  setProfileMapping,
  copyProfileData,
  loadProfiles,
  saveProfiles,
} from './lib/storage.js';

const auth = new GoTrue({ APIUrl: '/.netlify/identity', setCookie: false });

function initMustergarten() {
  migrateWaschtlToMustergarten();
  migrateLegacyData('mustergarten');
  // Ensure Mustergarten entry exists in profiles array
  const profiles = loadProfiles();
  if (!profiles.find(p => p.id === 'mustergarten')) {
    saveProfiles([...profiles, { id: 'mustergarten', name: 'Mustergarten', color: 'green' }]);
  }
}

function parseHash(hash) {
  const str = hash.startsWith('#') ? hash.slice(1) : hash;
  return Object.fromEntries(new URLSearchParams(str));
}

function resolveProfile(user) {
  const map = getProfileMapping();
  if (map[user.id]) return map[user.id];
  // Auto-detect admin user by presence of mustergarten data (post-migration)
  if (localStorage.getItem(profileKey('beete', 'mustergarten'))) {
    setProfileMapping(user.id, 'mustergarten');
    return 'mustergarten';
  }
  return null; // new user → needs onboarding
}

function deriveProfileName(profileId, user) {
  // Prefer stored name from profiles array
  const stored = loadProfiles().find(p => p.id === profileId);
  if (stored?.name) return stored.name;
  // Fallback: derive from email prefix
  const local = user.email.split('@')[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function OnboardingScreen({ user, onComplete }) {
  const emailPrefix = user.email.split('@')[0];
  const defaultName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
  const [name, setName] = useState(defaultName);
  const [loading, setLoading] = useState(false);

  function handleChoice(useTemplate) {
    const trimmed = name.trim() || defaultName;
    setLoading(true);
    const newId = user.id;
    if (useTemplate) copyProfileData('mustergarten', newId);
    setProfileMapping(user.id, newId);
    const existing = loadProfiles();
    if (!existing.find(p => p.id === newId)) {
      saveProfiles([...existing, { id: newId, name: trimmed, color: 'blue' }]);
    }
    onComplete(newId, trimmed);
  }

  return (
    <div className="h-[100dvh] flex items-center justify-center font-geist p-8">
      <div className="w-full max-w-md flex flex-col gap-5">
        <h1 className="text-4xl font-semibold tracking-tight">Willkommen! 🌱</h1>
        <p className="text-muted-foreground text-sm">Richte deinen persönlichen Garten ein.</p>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Dein Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="z. B. Maria"
            className="rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <button
            disabled={loading || !name.trim()}
            onClick={() => handleChoice(true)}
            className="w-full rounded-2xl bg-primary py-4 font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '…' : '🥬 Mustergarten übernehmen'}
          </button>
          <button
            disabled={loading || !name.trim()}
            onClick={() => handleChoice(false)}
            className="w-full rounded-2xl border border-border py-4 font-medium hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '…' : '🌱 Leeren Garten anlegen'}
          </button>
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Beim Mustergarten werden alle Beete als Vorlage übernommen.
        </p>
      </div>
    </div>
  );
}

function Root() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pageMode, setPageMode] = useState('signin');
  const [hashParams, setHashParams] = useState(null);
  const [profileId, setProfileId] = useState(null);
  const [profileName, setProfileName] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);

  function applyProfile(u) {
    const pid = resolveProfile(u);
    if (pid) {
      setProfileId(pid);
      setProfileName(deriveProfileName(pid, u));
    } else {
      setShowOnboarding(true);
    }
  }

  useEffect(() => {
    initMustergarten();
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
    try {
      const existing = auth.currentUser();
      if (existing) {
        setUser(existing);
        applyProfile(existing);
      }
    } catch {
      // session expired/corrupted → show sign-in
    }
    setAuthReady(true);
  }, []);

  // Handle hash-based invite / recovery / OAuth callbacks
  useEffect(() => {
    if (!hashParams) return;

    const { access_token, type, invite_token, recovery_token } = hashParams;

    if (invite_token) {
      setPageMode('accept-invite');
      return;
    }

    if (recovery_token) {
      setPageMode('recovery');
      return;
    }

    if (type === 'token' && access_token) {
      setLoading(true);
      setError(null);
      auth.createUser(hashParams, true)
        .then(u => { setUser(u); applyProfile(u); setLoading(false); })
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
      applyProfile(u);
    } catch (err) {
      setError(err.message || 'Anmeldung fehlgeschlagen. Bitte prüfe deine Zugangsdaten.');
    } finally {
      setLoading(false);
    }
  }

  function handleResetPassword() {
    setError(null);
    setPageMode('forgot-password');
  }

  async function handleForgotPasswordSubmit(email) {
    setLoading(true);
    setError(null);
    try {
      await auth.requestPasswordRecovery(email);
      setError('E-Mail wurde gesendet. Bitte prüfe deinen Posteingang und klicke auf den Link.');
      setPageMode('signin');
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
      applyProfile(u);
    } catch (err) {
      setError(err.message || 'Einladung konnte nicht angenommen werden.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSetNewPassword(password) {
    const recovery_token = hashParams?.recovery_token;
    if (!recovery_token) {
      setError('Kein Reset-Token gefunden. Bitte fordere einen neuen Reset-Link an.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const u = await auth.recover(recovery_token, true);
      await u.update({ password });
      setUser(u);
      applyProfile(u);
    } catch (err) {
      setError(err.message || 'Passwort konnte nicht gesetzt werden.');
    } finally {
      setLoading(false);
    }
  }

  function handleRenameProfile(newName) {
    const trimmed = newName.trim();
    if (!trimmed || !profileId) return;
    const updated = loadProfiles().map(p =>
      p.id === profileId ? { ...p, name: trimmed } : p
    );
    if (!updated.find(p => p.id === profileId)) {
      updated.push({ id: profileId, name: trimmed, color: 'green' });
    }
    saveProfiles(updated);
    setProfileName(trimmed);
  }

  async function handleSignOut() {
    try {
      await user.logout();
    } catch (_) {
      // ignore logout errors
    }
    setUser(null);
    setProfileId(null);
    setProfileName('');
    setShowOnboarding(false);
    setPageMode('signin');
  }

  if (!authReady) return null;

  if (!user) {
    return (
      <SignInPage
        title={<span className="font-semibold tracking-tight">Saisongarten 🌱</span>}
        description="Melde dich an um deinen Gartenplan zu öffnen"
        onSignIn={handleSignIn}
        onResetPassword={handleResetPassword}
        onForgotPasswordSubmit={handleForgotPasswordSubmit}
        isLoading={loading}
        errorMessage={error}
        mode={pageMode}
        onAcceptInvite={handleAcceptInvite}
        onSetNewPassword={handleSetNewPassword}
      />
    );
  }

  if (showOnboarding) {
    return (
      <OnboardingScreen
        user={user}
        onComplete={(id, name) => {
          setProfileId(id);
          setProfileName(name);
          setShowOnboarding(false);
        }}
      />
    );
  }

  return (
    <App
      key={profileId}
      profileId={profileId}
      profileName={profileName}
      profileColor="green"
      onSwitchProfile={handleSignOut}
      onRenameProfile={handleRenameProfile}
    />
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);

/**
 * Profile-aware localStorage helpers.
 * User-specific keys are namespaced as `key_profileId`.
 * Global keys (UI prefs, GPS) are shared across all profiles.
 */

const USER_KEYS = new Set([
  'beete',
  'beetDataVersion',
  'archivierteBeete',
  'giessenLog',
  'duengenLog',
  'pinnedBeete',
  'beetNotizen',
  'ernteLog',
  'beetOrder',
]);

export function profileKey(key, profileId) {
  return USER_KEYS.has(key) ? `${key}_${profileId}` : key;
}

export function lsGet(key, profileId) {
  return localStorage.getItem(profileKey(key, profileId));
}

export function lsSet(key, value, profileId) {
  localStorage.setItem(profileKey(key, profileId), value);
}

/**
 * One-time migration: copy old non-namespaced data into a profile's namespace.
 * Only runs if the namespaced key doesn't already exist.
 */
export function migrateLegacyData(profileId) {
  for (const key of USER_KEYS) {
    const namespaced = `${key}_${profileId}`;
    if (!localStorage.getItem(namespaced)) {
      const old = localStorage.getItem(key);
      if (old) localStorage.setItem(namespaced, old);
    }
  }
}

// ── Profile list helpers ──────────────────────────────────────────────────────

export function loadProfiles() {
  try {
    const raw = localStorage.getItem('profiles');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveProfiles(profiles) {
  localStorage.setItem('profiles', JSON.stringify(profiles));
}

export function loadCurrentProfileId() {
  return localStorage.getItem('currentProfile') || null;
}

export function saveCurrentProfileId(id) {
  localStorage.setItem('currentProfile', id);
}

// ── Profile PIN helpers ───────────────────────────────────────────────────────
// Stored as { profileId: pin } under key 'profilePins'
// Visible in DevTools → Application → Local Storage → key: profilePins

export function loadProfilePins() {
  try {
    const raw = localStorage.getItem('profilePins');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveProfilePins(pins) {
  localStorage.setItem('profilePins', JSON.stringify(pins));
}

export function getProfilePin(profileId) {
  return loadProfilePins()[profileId] ?? null;
}

export function setProfilePin(profileId, pin) {
  const pins = loadProfilePins();
  pins[profileId] = pin;
  saveProfilePins(pins);
}

export function removeProfilePin(profileId) {
  const pins = loadProfilePins();
  delete pins[profileId];
  saveProfilePins(pins);
}

// ── Netlify Identity profile mapping ─────────────────────────────────────────
// Maps Netlify user.id (UUID) → local profileId

export function getProfileMapping() {
  try {
    const raw = localStorage.getItem('netlify_profile_map');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setProfileMapping(uid, profileId) {
  const map = getProfileMapping();
  map[uid] = profileId;
  localStorage.setItem('netlify_profile_map', JSON.stringify(map));
}

export function copyProfileData(fromId, toId) {
  for (const key of USER_KEYS) {
    const val = localStorage.getItem(profileKey(key, fromId));
    if (val !== null) localStorage.setItem(profileKey(key, toId), val);
  }
}

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

// ── Export / Import ───────────────────────────────────────────────────────────

export function exportProfileData(profileId) {
  const data = {};
  for (const key of USER_KEYS) {
    const val = localStorage.getItem(profileKey(key, profileId));
    if (val !== null) data[key] = JSON.parse(val);
  }
  return { version: '1.0', exportedAt: new Date().toISOString(), profileId, data };
}

export function importProfileData(profileId, exported) {
  const { data } = exported;
  for (const key of USER_KEYS) {
    if (data[key] !== undefined)
      localStorage.setItem(profileKey(key, profileId), JSON.stringify(data[key]));
  }
}

export function copyProfileData(fromId, toId) {
  for (const key of USER_KEYS) {
    const val = localStorage.getItem(profileKey(key, fromId));
    if (val !== null) localStorage.setItem(profileKey(key, toId), val);
  }
}

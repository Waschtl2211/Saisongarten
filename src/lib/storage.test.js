import { beforeEach, describe, expect, it } from 'vitest';
import {
  profileKey,
  lsGet,
  lsSet,
  migrateLegacyData,
  loadProfiles,
  saveProfiles,
  loadCurrentProfileId,
  saveCurrentProfileId,
  loadProfilePins,
  saveProfilePins,
  getProfilePin,
  setProfilePin,
  removeProfilePin,
} from './storage.js';

// Minimal in-memory localStorage mock for Node environment
const store = {};
global.localStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
};

beforeEach(() => {
  localStorage.clear();
});

// ── profileKey ────────────────────────────────────────────────────────────────

describe('profileKey', () => {
  it('namespaces user-specific keys', () => {
    expect(profileKey('beete', 'waschtl')).toBe('beete_waschtl');
  });

  it('namespaces all USER_KEYS', () => {
    const userKeys = [
      'beete', 'beetDataVersion', 'archivierteBeete',
      'giessenLog', 'duengenLog', 'pinnedBeete',
      'beetNotizen', 'ernteLog', 'beetOrder',
    ];
    for (const key of userKeys) {
      expect(profileKey(key, 'p1')).toBe(`${key}_p1`);
    }
  });

  it('does not namespace global/UI keys', () => {
    expect(profileKey('profiles', 'p1')).toBe('profiles');
    expect(profileKey('currentProfile', 'p1')).toBe('currentProfile');
    expect(profileKey('profilePins', 'p1')).toBe('profilePins');
    expect(profileKey('darkMode', 'p1')).toBe('darkMode');
  });
});

// ── lsGet / lsSet ─────────────────────────────────────────────────────────────

describe('lsGet / lsSet', () => {
  it('stores and retrieves a user-specific value', () => {
    lsSet('beete', '[]', 'p1');
    expect(lsGet('beete', 'p1')).toBe('[]');
  });

  it('isolates data between profiles', () => {
    lsSet('beete', 'data_p1', 'p1');
    lsSet('beete', 'data_p2', 'p2');
    expect(lsGet('beete', 'p1')).toBe('data_p1');
    expect(lsGet('beete', 'p2')).toBe('data_p2');
  });

  it('returns null for a missing key', () => {
    expect(lsGet('beete', 'p1')).toBeNull();
  });

  it('shares global keys across profiles', () => {
    lsSet('darkMode', 'true', 'p1');
    expect(lsGet('darkMode', 'p2')).toBe('true');
  });

  it('stores values as strings', () => {
    lsSet('beete', JSON.stringify([1, 2, 3]), 'p1');
    expect(lsGet('beete', 'p1')).toBe('[1,2,3]');
  });
});

// ── migrateLegacyData ─────────────────────────────────────────────────────────

describe('migrateLegacyData', () => {
  it('copies old non-namespaced keys into the profile namespace', () => {
    localStorage.setItem('beete', 'legacy_data');
    migrateLegacyData('p1');
    expect(localStorage.getItem('beete_p1')).toBe('legacy_data');
  });

  it('does not overwrite an existing namespaced key', () => {
    localStorage.setItem('beete', 'old_data');
    localStorage.setItem('beete_p1', 'existing_data');
    migrateLegacyData('p1');
    expect(localStorage.getItem('beete_p1')).toBe('existing_data');
  });

  it('skips keys that have no old data', () => {
    migrateLegacyData('p1');
    expect(localStorage.getItem('beete_p1')).toBeNull();
  });

  it('is idempotent on a second call', () => {
    localStorage.setItem('beete', 'legacy_data');
    migrateLegacyData('p1');
    migrateLegacyData('p1');
    expect(localStorage.getItem('beete_p1')).toBe('legacy_data');
  });

  it('migrates all USER_KEYS', () => {
    const userKeys = [
      'beete', 'beetDataVersion', 'archivierteBeete',
      'giessenLog', 'duengenLog', 'pinnedBeete',
      'beetNotizen', 'ernteLog', 'beetOrder',
    ];
    for (const key of userKeys) {
      localStorage.setItem(key, `data_${key}`);
    }
    migrateLegacyData('p1');
    for (const key of userKeys) {
      expect(localStorage.getItem(`${key}_p1`)).toBe(`data_${key}`);
    }
  });
});

// ── loadProfiles / saveProfiles ───────────────────────────────────────────────

describe('loadProfiles / saveProfiles', () => {
  it('returns an empty array when no data exists', () => {
    expect(loadProfiles()).toEqual([]);
  });

  it('round-trips a profiles array correctly', () => {
    const profiles = [{ id: 'p1', name: 'Alice', color: 'blue' }];
    saveProfiles(profiles);
    expect(loadProfiles()).toEqual(profiles);
  });

  it('returns an empty array on corrupt JSON', () => {
    localStorage.setItem('profiles', 'not-valid-json{');
    expect(loadProfiles()).toEqual([]);
  });
});

// ── loadCurrentProfileId / saveCurrentProfileId ───────────────────────────────

describe('loadCurrentProfileId / saveCurrentProfileId', () => {
  it('returns null when no profile is set', () => {
    expect(loadCurrentProfileId()).toBeNull();
  });

  it('round-trips the current profile ID', () => {
    saveCurrentProfileId('p1');
    expect(loadCurrentProfileId()).toBe('p1');
  });
});

// ── getProfilePin / setProfilePin / removeProfilePin ──────────────────────────

describe('getProfilePin / setProfilePin / removeProfilePin', () => {
  it('returns null for an unknown profile', () => {
    expect(getProfilePin('unknown')).toBeNull();
  });

  it('stores and retrieves a PIN', () => {
    setProfilePin('p1', '1234');
    expect(getProfilePin('p1')).toBe('1234');
  });

  it('does not clobber PINs for other profiles', () => {
    setProfilePin('p1', '1111');
    setProfilePin('p2', '2222');
    expect(getProfilePin('p1')).toBe('1111');
    expect(getProfilePin('p2')).toBe('2222');
  });

  it('removes a PIN', () => {
    setProfilePin('p1', '1234');
    removeProfilePin('p1');
    expect(getProfilePin('p1')).toBeNull();
  });

  it('remove for an unknown profile does not throw', () => {
    expect(() => removeProfilePin('nonexistent')).not.toThrow();
  });
});

// ── loadProfilePins / saveProfilePins ─────────────────────────────────────────

describe('loadProfilePins / saveProfilePins', () => {
  it('returns an empty object when no data exists', () => {
    expect(loadProfilePins()).toEqual({});
  });

  it('round-trips a pins object correctly', () => {
    const pins = { p1: '1234', p2: '5678' };
    saveProfilePins(pins);
    expect(loadProfilePins()).toEqual(pins);
  });

  it('returns an empty object on corrupt JSON', () => {
    localStorage.setItem('profilePins', 'not-valid-json{');
    expect(loadProfilePins()).toEqual({});
  });
});

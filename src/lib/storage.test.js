/* global global */
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
  exportProfileData,
  importProfileData,
  getProfileMapping,
  setProfileMapping,
  copyProfileData,
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

// ── exportProfileData ─────────────────────────────────────────────────────────

describe('exportProfileData', () => {
  it('exports all USER_KEYS that exist', () => {
    localStorage.setItem('beete_p1', JSON.stringify([{ beet: 1 }]));
    localStorage.setItem('giessenLog_p1', JSON.stringify({ 1: ['2024-05-01'] }));
    const result = exportProfileData('p1');
    expect(result.version).toBe('1.0');
    expect(result.profileId).toBe('p1');
    expect(result.exportedAt).toBeTruthy();
    expect(result.data.beete).toEqual([{ beet: 1 }]);
    expect(result.data.giessenLog).toEqual({ 1: ['2024-05-01'] });
  });

  it('skips keys not in localStorage', () => {
    const result = exportProfileData('p1');
    expect(result.data.beete).toBeUndefined();
  });

  it('handles corrupt JSON value gracefully', () => {
    localStorage.setItem('beete_p1', 'not-valid-json{');
    localStorage.setItem('giessenLog_p1', JSON.stringify({}));
    const result = exportProfileData('p1');
    expect(result.data.beete).toBeUndefined();
    expect(result.data.giessenLog).toEqual({});
  });

  it('returns correct metadata structure', () => {
    const result = exportProfileData('test-id');
    expect(result).toMatchObject({ version: '1.0', profileId: 'test-id' });
    expect(typeof result.exportedAt).toBe('string');
  });
});

// ── importProfileData ─────────────────────────────────────────────────────────

describe('importProfileData', () => {
  it('writes all keys from data to correct namespaced localStorage keys', () => {
    const exported = { data: { beete: [{ beet: 1 }], giessenLog: { 1: [] } } };
    importProfileData('p1', exported);
    expect(localStorage.getItem('beete_p1')).toBe(JSON.stringify([{ beet: 1 }]));
    expect(localStorage.getItem('giessenLog_p1')).toBe(JSON.stringify({ 1: [] }));
  });

  it('skips undefined keys', () => {
    const exported = { data: { beete: [{ beet: 1 }] } };
    importProfileData('p1', exported);
    expect(localStorage.getItem('giessenLog_p1')).toBeNull();
  });

  it('is idempotent — re-importing same data overwrites cleanly', () => {
    const exported = { data: { beete: [{ beet: 1 }] } };
    importProfileData('p1', exported);
    importProfileData('p1', exported);
    expect(JSON.parse(localStorage.getItem('beete_p1'))).toEqual([{ beet: 1 }]);
  });
});

// ── getProfileMapping / setProfileMapping ────────────────────────────────────

describe('getProfileMapping / setProfileMapping', () => {
  it('returns empty object when no data exists', () => {
    expect(getProfileMapping()).toEqual({});
  });

  it('stores and retrieves uid → profileId mapping', () => {
    setProfileMapping('uid-123', 'waschtl');
    expect(getProfileMapping()['uid-123']).toBe('waschtl');
  });

  it('multiple uids coexist without overwriting each other', () => {
    setProfileMapping('uid-a', 'profile-a');
    setProfileMapping('uid-b', 'profile-b');
    const map = getProfileMapping();
    expect(map['uid-a']).toBe('profile-a');
    expect(map['uid-b']).toBe('profile-b');
  });
});

// ── copyProfileData ───────────────────────────────────────────────────────────

describe('copyProfileData', () => {
  it('copies all USER_KEYS from source to target profile', () => {
    localStorage.setItem('beete_src', JSON.stringify([{ beet: 1 }]));
    localStorage.setItem('giessenLog_src', JSON.stringify({}));
    copyProfileData('src', 'dst');
    expect(localStorage.getItem('beete_dst')).toBe(JSON.stringify([{ beet: 1 }]));
    expect(localStorage.getItem('giessenLog_dst')).toBe(JSON.stringify({}));
  });

  it('skips keys not in source profile', () => {
    copyProfileData('src', 'dst');
    expect(localStorage.getItem('beete_dst')).toBeNull();
  });

  it('does not affect unrelated profiles', () => {
    localStorage.setItem('beete_other', 'other_data');
    localStorage.setItem('beete_src', JSON.stringify([{ beet: 2 }]));
    copyProfileData('src', 'dst');
    expect(localStorage.getItem('beete_other')).toBe('other_data');
  });
});


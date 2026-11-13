export type DeletedEntities = Record<string, string[]>;

export const mergeDeletedEntities = (...sources: Array<DeletedEntities | undefined>): DeletedEntities => {
  const merged: DeletedEntities = {};
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    for (const [collection, ids] of Object.entries(source)) {
      if (!Array.isArray(ids)) continue;
      merged[collection] = [...new Set([...(merged[collection] || []), ...ids.map(String)])];
    }
  }
  return merged;
};

export const sanitizeCloudState = (state: any) => {
  const safe = { ...(state || {}) };
  // Preserve users and their passcodes intact
  if (safe.settings && typeof safe.settings === 'object') {
    safe.settings = { ...safe.settings };
    delete safe.settings.leaderPasscode;
  }
  return safe;
};

export const mergeArrayByKey = (
  existingList: any[] = [],
  incomingList: any[] = [],
  key = 'id',
  deletedIds: string[] = []
) => {
  const stripUndefined = (obj: Record<string, any>) => {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj || {})) {
      if (v !== undefined) out[k] = v;
    }
    return out;
  };

  const deleted = new Set(deletedIds.map(String));
  const map = new Map<string, any>();
  for (const item of existingList) {
    if (item && item[key] !== undefined && !deleted.has(String(item[key]))) {
      map.set(String(item[key]), stripUndefined(item));
    }
  }
  for (const rawItem of incomingList) {
    if (!rawItem || rawItem[key] === undefined || deleted.has(String(rawItem[key]))) continue;
    const item = stripUndefined(rawItem);
    const id = String(item[key]);
    const existing = map.get(id);
    if (!existing) {
      map.set(id, item);
      continue;
    }
    const parseTime = (value: unknown) => {
      if (typeof value !== 'string') return 0;
      const parsed = new Date(value).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const existingTime = parseTime(existing.updatedAt || existing.submittedAt || existing.recordedAt || existing.evaluatedAt || existing.createdAt || existing.timestamp);
    const incomingTime = parseTime(item.updatedAt || item.submittedAt || item.recordedAt || item.evaluatedAt || item.createdAt || item.timestamp);
    const base = incomingTime >= existingTime ? { ...existing, ...item } : { ...item, ...existing };

    // Explicitly preserve tasks array from whichever side is newer (even if empty array [])
    if (incomingTime >= existingTime && Array.isArray(item.tasks)) {
      base.tasks = item.tasks;
    } else if (existingTime > incomingTime && Array.isArray(existing.tasks)) {
      base.tasks = existing.tasks;
    } else if (Array.isArray(item.tasks)) {
      base.tasks = item.tasks;
    } else if (Array.isArray(existing.tasks)) {
      base.tasks = existing.tasks;
    }

    // For user items or items with passcode, never overwrite a set passcode with an empty or missing one
    const existingPass = (existing.passcode && String(existing.passcode).trim()) || '';
    const incomingPass = (item.passcode && String(item.passcode).trim()) || '';
    const resolvedPasscode = incomingPass || existingPass;
    if (resolvedPasscode) {
      base.passcode = resolvedPasscode;
    }
    map.set(id, base);
  }
  const merged = Array.from(map.values());
  if (merged.length > 1 && merged.every(item => item && typeof item.timestamp === 'string')) {
    merged.sort((a, b) => (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0));
  }
  return merged;
};

/**
 * Deduplicate homework submissions by (assignmentId, studentId) pair so there is strictly
 * at most ONE submission record per student per assignment, preserving the newest data and stable ID.
 */
export const deduplicateAtqiniSubmissions = <T extends Record<string, any>>(list: T[] = []): T[] => {
  if (!Array.isArray(list)) return [];
  const map = new Map<string, T>();
  const parseTime = (item: any) => {
    if (!item) return 0;
    const val = item.updatedAt || item.submittedAt || item.recordedAt || item.evaluatedAt || item.createdAt;
    if (typeof val !== 'string') return 0;
    const t = new Date(val).getTime();
    return Number.isFinite(t) ? t : 0;
  };

  for (const item of list) {
    if (!item) continue;
    const key = (item.assignmentId && item.studentId)
      ? `${item.assignmentId}_${item.studentId}`
      : String(item.id || Math.random());

    const existing = map.get(key);
    if (!existing) {
      map.set(key, item);
    } else {
      const existingTime = parseTime(existing);
      const itemTime = parseTime(item);
      const stableId = existing.id || item.id;
      if (itemTime >= existingTime) {
        map.set(key, { ...existing, ...item, id: stableId });
      } else {
        map.set(key, { ...item, ...existing, id: stableId });
      }
    }
  }
  return Array.from(map.values());
};

/**
 * Deduplicate challenge submissions by (challengeId, studentId) pair so there is strictly
 * at most ONE submission record per student per challenge, preserving newest score and stable ID.
 */
export const deduplicateChallengeSubmissions = <T extends Record<string, any>>(list: T[] = []): T[] => {
  if (!Array.isArray(list)) return [];
  const map = new Map<string, T>();
  const parseTime = (item: any) => {
    if (!item) return 0;
    const val = item.updatedAt || item.evaluatedAt || item.submittedAt || item.createdAt;
    if (typeof val !== 'string') return 0;
    const t = new Date(val).getTime();
    return Number.isFinite(t) ? t : 0;
  };

  for (const item of list) {
    if (!item) continue;
    const key = (item.challengeId && item.studentId)
      ? `${item.challengeId}_${item.studentId}`
      : String(item.id || Math.random());

    const existing = map.get(key);
    if (!existing) {
      map.set(key, item);
    } else {
      const existingTime = parseTime(existing);
      const itemTime = parseTime(item);
      const stableId = existing.id || item.id;
      if (itemTime >= existingTime) {
        map.set(key, { ...existing, ...item, id: stableId });
      } else {
        map.set(key, { ...item, ...existing, id: stableId });
      }
    }
  }
  return Array.from(map.values());
};

/**
 * Deduplicate attendance records by (studentId, date) pair so there is strictly
 * at most ONE attendance record per student per date, preserving the newest status and earlyPrepCardSent.
 */
export const deduplicateAttendanceRecords = <T extends Record<string, any>>(list: T[] = []): T[] => {
  if (!Array.isArray(list)) return [];
  const map = new Map<string, T>();
  const parseTime = (item: any) => {
    if (!item) return 0;
    const val = item.updatedAt || item.recordedAt || item.createdAt || item.timestamp;
    if (typeof val !== 'string') return 0;
    const t = new Date(val).getTime();
    return Number.isFinite(t) ? t : 0;
  };

  for (const item of list) {
    if (!item || !item.studentId || !item.date) continue;
    const key = `${item.studentId}_${item.date}`;
    const canonicalId = `att_${item.studentId}_${item.date}`;
    const existing = map.get(key);
    if (!existing) {
      const isAbsentOrUnrecorded =
        item.status === 'absent_unexcused' ||
        item.status === 'absent_excused' ||
        item.status === 'unrecorded';
      map.set(key, {
        ...item,
        id: item.id || canonicalId,
        earlyPrepCardSent: isAbsentOrUnrecorded ? false : !!item.earlyPrepCardSent
      });
    } else {
      const existingTime = parseTime(existing);
      const itemTime = parseTime(item);
      const winner = itemTime >= existingTime ? { ...existing, ...item } : { ...item, ...existing };
      const isAbsentOrUnrecorded =
        winner.status === 'absent_unexcused' ||
        winner.status === 'absent_excused' ||
        winner.status === 'unrecorded';
      map.set(key, {
        ...winner,
        id: winner.id || canonicalId,
        earlyPrepCardSent: isAbsentOrUnrecorded ? false : !!winner.earlyPrepCardSent
      });
    }
  }
  return Array.from(map.values());
};

/**
 * Deduplicate daily recitation records by (studentId, date) pair so there is strictly
 * at most ONE daily record per student per date, preserving the newest evaluation.
 */
export const deduplicateDailyRecords = <T extends Record<string, any>>(list: T[] = []): T[] => {
  if (!Array.isArray(list)) return [];
  const map = new Map<string, T>();
  const parseTime = (item: any) => {
    if (!item) return 0;
    const val = item.updatedAt || item.recordedAt || item.createdAt || item.timestamp;
    if (typeof val !== 'string') return 0;
    const t = new Date(val).getTime();
    return Number.isFinite(t) ? t : 0;
  };

  for (const item of list) {
    if (!item || !item.studentId || !item.date) continue;
    const key = `${item.studentId}_${item.date}`;
    const canonicalId = `dr_${item.studentId}_${item.date}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...item, id: item.id || canonicalId });
    } else {
      const existingTime = parseTime(existing);
      const itemTime = parseTime(item);
      const winner = itemTime >= existingTime ? { ...existing, ...item } : { ...item, ...existing };
      map.set(key, { ...winner, id: winner.id || canonicalId });
    }
  }
  return Array.from(map.values());
};



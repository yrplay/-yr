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
  const deleted = new Set(deletedIds.map(String));
  const map = new Map<string, any>();
  for (const item of existingList) {
    if (item && item[key] !== undefined && !deleted.has(String(item[key]))) {
      map.set(String(item[key]), item);
    }
  }
  for (const item of incomingList) {
    if (!item || item[key] === undefined || deleted.has(String(item[key]))) continue;
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
    const existingTime = parseTime(existing.recordedAt || existing.updatedAt || existing.evaluatedAt || existing.createdAt);
    const incomingTime = parseTime(item.recordedAt || item.updatedAt || item.evaluatedAt || item.createdAt);
    const base = incomingTime >= existingTime ? { ...existing, ...item } : { ...item, ...existing };
    
    // For user items or items with passcode, never overwrite a set passcode with an empty or missing one
    const existingPass = (existing.passcode && String(existing.passcode).trim()) || '';
    const incomingPass = (item.passcode && String(item.passcode).trim()) || '';
    const resolvedPasscode = incomingPass || existingPass;
    if (resolvedPasscode) {
      base.passcode = resolvedPasscode;
    }
    map.set(id, base);
  }
  return Array.from(map.values());
};

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

export const deepCleanForFirestore = (value: any): any => {
  if (value === undefined) {
    return null;
  }
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      return 0;
    }
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value
      .filter(item => item !== undefined)
      .map(item => deepCleanForFirestore(item));
  }
  const cleanedObj: Record<string, any> = {};
  for (const [k, v] of Object.entries(value)) {
    if (v === undefined) continue;
    cleanedObj[k] = deepCleanForFirestore(v);
  }
  return cleanedObj;
};

export const pruneDeadStaffProfiles = (
  profilesMap: Record<string, any> | undefined | null,
  usersList: any[] = [],
  deletedUserIds: string[] = []
): Record<string, any> => {
  if (!profilesMap || typeof profilesMap !== 'object') return {};
  const deletedSet = new Set(deletedUserIds.map(String));
  const activeIds = new Set(
    (Array.isArray(usersList) ? usersList : [])
      .filter((u: any) => u && u.id && !deletedSet.has(String(u.id)))
      .map((u: any) => String(u.id))
  );
  const pruned: Record<string, any> = {};
  for (const [userId, cfg] of Object.entries(profilesMap)) {
    if (!cfg || typeof cfg !== 'object') continue;
    if (deletedSet.has(String(userId))) continue;
    if (activeIds.size > 0 && !activeIds.has(String(userId))) continue;
    pruned[userId] = cfg;
  }
  return pruned;
};

export const sanitizeStaffUserForFirestore = (raw: any): any => {
  if (!raw || typeof raw !== 'object') return raw;
  const cleaned = deepCleanForFirestore(raw) || {};
  const role = cleaned.role || 'teacher';
  const defaultTitle =
    role === 'owner'
      ? 'مالك المنصة العام'
      : role === 'developer'
      ? 'المطور التقني'
      : role === 'leader'
      ? 'قائدة مقرأة غيث الغيم'
      : role === 'supervisor'
      ? 'مشرفة حلقات'
      : 'معلمة حلقة';
  const resolvedPin = String(cleaned.passcode || cleaned.pin || '').trim();
  const resolvedCircles = Array.isArray(cleaned.circleIds)
    ? cleaned.circleIds.filter(Boolean).map(String)
    : Array.isArray(cleaned.assignedCircles)
    ? cleaned.assignedCircles.filter(Boolean).map(String)
    : [];
  const nowIso = new Date().toISOString();

  const resolvedIcon = String(cleaned.icon || cleaned.avatarIcon || 'mushaf');

  return {
    ...cleaned,
    id: String(cleaned.id || `u-${Date.now()}`).trim(),
    name: String(cleaned.name || 'عضوة جديدة').trim(),
    role,
    title: String(cleaned.title || defaultTitle).trim(),
    email: typeof cleaned.email === 'string' ? cleaned.email.trim() : '',
    phone: typeof cleaned.phone === 'string' ? cleaned.phone.trim() : '',
    passcode: resolvedPin,
    pin: resolvedPin,
    circleIds: resolvedCircles,
    assignedCircles: resolvedCircles,
    icon: resolvedIcon,
    avatarIcon: resolvedIcon,
    avatarColor: String(cleaned.avatarColor || '#ad4e00'),
    signatureUrl: typeof cleaned.signatureUrl === 'string' ? cleaned.signatureUrl : '',
    welcomeTitle: typeof cleaned.welcomeTitle === 'string' ? cleaned.welcomeTitle : '',
    status: cleaned.status === 'inactive' || cleaned.status === 'archived' ? cleaned.status : 'active',
    isActive: typeof cleaned.isActive === 'boolean' ? cleaned.isActive : true,
    createdAt: typeof cleaned.createdAt === 'string' && cleaned.createdAt ? cleaned.createdAt : nowIso,
    updatedAt: typeof cleaned.updatedAt === 'string' && cleaned.updatedAt ? cleaned.updatedAt : nowIso
  };
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
      if (v !== undefined && v !== null) {
        out[k] = deepCleanForFirestore(v);
      } else if (v === null) {
        out[k] = null;
      }
    }
    return out;
  };

  const deleted = new Set(deletedIds.map(String));
  const map = new Map<string, any>();
  for (const item of existingList) {
    if (item && item[key] !== undefined && item[key] !== null && !deleted.has(String(item[key]))) {
      map.set(String(item[key]), stripUndefined(item));
    }
  }
  for (const rawItem of incomingList) {
    if (!rawItem || rawItem[key] === undefined || rawItem[key] === null || deleted.has(String(rawItem[key]))) continue;
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

    // For user items or items with passcode/pin, never overwrite a set passcode with an empty or missing one
    const existingPass = (existing.passcode && String(existing.passcode).trim()) || (existing.pin && String(existing.pin).trim()) || '';
    const incomingPass = (item.passcode && String(item.passcode).trim()) || (item.pin && String(item.pin).trim()) || '';
    const resolvedPasscode = incomingPass || existingPass;
    if (resolvedPasscode) {
      base.passcode = resolvedPasscode;
      base.pin = resolvedPasscode;
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
 * Deduplicate homework submissions by (assignmentId, studentId, hijriDate) tuple so there is strictly
 * at most ONE submission record per student per assignment per Hijri session date, preserving newest data and stable ID.
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
    const dateSuffix = item.hijriDate ? `_${String(item.hijriDate).trim()}` : '';
    const key = (item.assignmentId && item.studentId)
      ? `${item.assignmentId}_${item.studentId}${dateSuffix}`
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

export const DAILY_SHARD_COUNT = 4;
export const ATTENDANCE_SHARD_COUNT = 2;
export const SHARD_SUBMISSIONS_DOC_ID = 'shard_submissions';
export const SHARD_SUBSCRIPTIONS_LOGS_DOC_ID = 'shard_subscriptions_logs';

export const DAILY_SHARD_DOC_IDS = Array.from(
  { length: DAILY_SHARD_COUNT },
  (_, i) => `shard_daily_${i}`
);

export const ATTENDANCE_SHARD_DOC_IDS = Array.from(
  { length: ATTENDANCE_SHARD_COUNT },
  (_, i) => `shard_attendance_${i}`
);

export const ALL_SHARD_DOC_IDS = [
  ...DAILY_SHARD_DOC_IDS,
  ...ATTENDANCE_SHARD_DOC_IDS,
  SHARD_SUBMISSIONS_DOC_ID,
  SHARD_SUBSCRIPTIONS_LOGS_DOC_ID
];

export const SHARDED_COLLECTION_KEYS = new Set([
  'dailyRecords',
  'attendanceRecords',
  'studentAtqiniSubmissions',
  'studentChallengeSubmissions',
  'studentSubscriptions',
  'auditLogs'
]);

/**
 * Deterministic FNV-1a bucket hash so each student's records consistently
 * map to the same shard document across all devices.
 */
export const getShardBucketIndex = (key: string, bucketCount: number): number => {
  const safeCount = Math.max(1, bucketCount);
  const str = String(key || '');
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % safeCount;
};

export const getDailyRecordShardId = (record: any): string => {
  const key = String(record?.studentId || record?.id || '');
  return `shard_daily_${getShardBucketIndex(key, DAILY_SHARD_COUNT)}`;
};

export const getAttendanceRecordShardId = (record: any): string => {
  const key = String(record?.studentId || record?.id || '');
  return `shard_attendance_${getShardBucketIndex(key, ATTENDANCE_SHARD_COUNT)}`;
};

/**
 * Assembles the full application state from `master_state` plus all shard docs,
 * safely merging any unsharded legacy arrays still present inside `master_state`.
 */
export const assembleShardedCloudState = (
  masterRaw: Record<string, any> | null | undefined,
  shardsById: Record<string, Record<string, any> | null | undefined>
): Record<string, any> | null => {
  if (!masterRaw || typeof masterRaw !== 'object') return null;

  const base = sanitizeCloudState(masterRaw);
  const deletedEntities: DeletedEntities = base._deletedEntities || {};

  const filterNotDeleted = (items: any[], collectionName: string, keyField = 'id') => {
    const deletedSet = new Set(
      Array.isArray(deletedEntities[collectionName])
        ? deletedEntities[collectionName].map(String)
        : []
    );
    if (deletedSet.size === 0) return items;
    return items.filter(item => item && item[keyField] !== undefined && !deletedSet.has(String(item[keyField])));
  };

  // 1. Daily Records
  const dailyShardItems = DAILY_SHARD_DOC_IDS.flatMap(id =>
    Array.isArray(shardsById?.[id]?.items) ? shardsById[id]!.items : []
  );
  const combinedDaily = deduplicateDailyRecords([
    ...(Array.isArray(base.dailyRecords) ? base.dailyRecords : []),
    ...dailyShardItems
  ]);
  base.dailyRecords = filterNotDeleted(combinedDaily, 'dailyRecords');

  // 2. Attendance Records
  const attendanceShardItems = ATTENDANCE_SHARD_DOC_IDS.flatMap(id =>
    Array.isArray(shardsById?.[id]?.items) ? shardsById[id]!.items : []
  );
  const combinedAttendance = deduplicateAttendanceRecords([
    ...(Array.isArray(base.attendanceRecords) ? base.attendanceRecords : []),
    ...attendanceShardItems
  ]);
  base.attendanceRecords = filterNotDeleted(combinedAttendance, 'attendanceRecords');

  // 3. Submissions (Atqini + Challenges)
  const submissionsShard = shardsById?.[SHARD_SUBMISSIONS_DOC_ID] || {};
  const combinedAtqini = deduplicateAtqiniSubmissions([
    ...(Array.isArray(base.studentAtqiniSubmissions) ? base.studentAtqiniSubmissions : []),
    ...(Array.isArray(submissionsShard.studentAtqiniSubmissions) ? submissionsShard.studentAtqiniSubmissions : [])
  ]);
  base.studentAtqiniSubmissions = filterNotDeleted(combinedAtqini, 'studentAtqiniSubmissions');

  const combinedChallenges = deduplicateChallengeSubmissions([
    ...(Array.isArray(base.studentChallengeSubmissions) ? base.studentChallengeSubmissions : []),
    ...(Array.isArray(submissionsShard.studentChallengeSubmissions) ? submissionsShard.studentChallengeSubmissions : [])
  ]);
  base.studentChallengeSubmissions = filterNotDeleted(combinedChallenges, 'studentChallengeSubmissions');

  // 4. Subscriptions & Audit Logs
  const subsLogsShard = shardsById?.[SHARD_SUBSCRIPTIONS_LOGS_DOC_ID] || {};
  base.studentSubscriptions = mergeArrayByKey(
    Array.isArray(base.studentSubscriptions) ? base.studentSubscriptions : [],
    Array.isArray(subsLogsShard.studentSubscriptions) ? subsLogsShard.studentSubscriptions : [],
    'id',
    deletedEntities.studentSubscriptions || []
  );

  const mergedLogs = mergeArrayByKey(
    Array.isArray(base.auditLogs) ? base.auditLogs : [],
    Array.isArray(subsLogsShard.auditLogs) ? subsLogsShard.auditLogs : [],
    'id',
    deletedEntities.auditLogs || []
  );
  mergedLogs.sort(
    (a: any, b: any) => (Date.parse(b?.timestamp || '') || 0) - (Date.parse(a?.timestamp || '') || 0)
  );
  base.auditLogs = mergedLogs.slice(0, 60);

  return base;
};

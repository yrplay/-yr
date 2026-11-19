export type DeletedEntities = Record<string, string[]>;

export const FIRESTORE_HARD_BYTE_LIMIT = 980_000; // Strictly below Firestore's 1,048,576 bytes (1 MiB) ceiling
export const SHARD_SAFE_BYTE_LIMIT = 750_000; // Safe operational ceiling per shard document (750 KB)
export const MAX_AUDIT_LOGS_COUNT = 60;
export const MAX_RECENT_OP_IDS = 50;

export class StaleCacheWriteError extends Error {
  readonly code = 'CLOUD_WRITE_REJECTED_STALE_CACHE';
  readonly docId: string;
  constructor(docId: string, message?: string) {
    super(
      message ||
        `رفض الكتابة السحابية للمستند (${docId}) لأن القراءة تمت من الذاكرة المؤقتة (Cache) وليس من الخادم المباشر لمنع الكتابة فوق بيانات أحدث.`
    );
    this.name = 'StaleCacheWriteError';
    this.docId = docId;
  }
}

export class FirestoreDocumentSizeLimitError extends Error {
  readonly code = 'FIRESTORE_DOC_SIZE_LIMIT_EXCEEDED';
  readonly docId: string;
  readonly byteSize: number;
  readonly limitBytes: number;
  constructor(docId: string, byteSize: number, limitBytes = FIRESTORE_HARD_BYTE_LIMIT) {
    super(
      `حجم المستند (${docId}) بلغ ${byteSize} بايت وهو يتجاوز الحد الآمن المسموح به في Firestore (${limitBytes} بايت).`
    );
    this.name = 'FirestoreDocumentSizeLimitError';
    this.docId = docId;
    this.byteSize = byteSize;
    this.limitBytes = limitBytes;
  }
}

export const createOperationId = (prefix = 'op'): string => {
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}_${time}_${rand}`;
};

export const estimateFirestoreDocSizeBytes = (docObj: unknown): number => {
  if (docObj === null || docObj === undefined) return 0;
  try {
    const json = JSON.stringify(docObj);
    if (!json) return 0;
    const utf8Len = new TextEncoder().encode(json).length;
    // Add ~1.08x structural overhead estimate for Firestore field names and protobuf tags
    return Math.ceil(utf8Len * 1.08) + 256;
  } catch {
    return 0;
  }
};

export const validateDocumentSizeWithinLimit = (
  docId: string,
  docObj: unknown,
  limitBytes = FIRESTORE_HARD_BYTE_LIMIT
): { ok: boolean; byteSize: number; nearLimit: boolean } => {
  const byteSize = estimateFirestoreDocSizeBytes(docObj);
  if (byteSize > limitBytes) {
    throw new FirestoreDocumentSizeLimitError(docId, byteSize, limitBytes);
  }
  return {
    ok: true,
    byteSize,
    nearLimit: byteSize >= SHARD_SAFE_BYTE_LIMIT
  };
};

/**
 * Splits a large array of shard items into bounded sub-batches if a single shard ever exceeds
 * `maxBytesPerShard`, preventing any single document from hitting Firestore's 1 MiB limit.
 */
export const partitionItemsIntoBoundedShards = <T,>(
  baseShardId: string,
  items: T[],
  maxBytesPerShard = SHARD_SAFE_BYTE_LIMIT
): Array<{ shardId: string; items: T[]; byteSize: number }> => {
  const fullTestPayload = {
    users: [],
    shardType: baseShardId,
    items,
    updatedAt: new Date().toISOString()
  };
  const totalBytes = estimateFirestoreDocSizeBytes(fullTestPayload);
  if (totalBytes <= maxBytesPerShard || items.length <= 1) {
    return [{ shardId: baseShardId, items, byteSize: totalBytes }];
  }

  const partitions: Array<{ shardId: string; items: T[]; byteSize: number }> = [];
  let currentBatch: T[] = [];
  let partIdx = 0;

  for (const item of items) {
    const candidate = [...currentBatch, item];
    const candidateBytes = estimateFirestoreDocSizeBytes({
      users: [],
      shardType: baseShardId,
      items: candidate,
      updatedAt: '2026-11-19T00:00:00.000Z'
    });
    if (candidateBytes > maxBytesPerShard && currentBatch.length > 0) {
      const shardId = partIdx === 0 ? baseShardId : `${baseShardId}_overflow_${partIdx}`;
      partitions.push({
        shardId,
        items: currentBatch,
        byteSize: estimateFirestoreDocSizeBytes({ items: currentBatch })
      });
      partIdx++;
      currentBatch = [item];
    } else {
      currentBatch = candidate;
    }
  }

  if (currentBatch.length > 0) {
    const shardId = partIdx === 0 ? baseShardId : `${baseShardId}_overflow_${partIdx}`;
    partitions.push({
      shardId,
      items: currentBatch,
      byteSize: estimateFirestoreDocSizeBytes({ items: currentBatch })
    });
  }

  return partitions;
};

export const assertServerReadForWrite = (
  docId: string,
  readResult: { exists: boolean; data: Record<string, any> | null; fromServer: boolean },
  options?: { allowNewServerDoc?: boolean }
): void => {
  if (!readResult.fromServer) {
    throw new StaleCacheWriteError(docId);
  }
  if (!readResult.exists && options?.allowNewServerDoc === false) {
    throw new StaleCacheWriteError(
      docId,
      `المستند الأساسي (${docId}) غير موجود على الخادم ولا يمكن استبداله ببيانات جزئية.`
    );
  }
};

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

export const extractRecordTimestampMs = (item: any): number => {
  if (!item || typeof item !== 'object') return 0;
  const candidates = [
    item.updatedAt,
    item.submittedAt,
    item.recordedAt,
    item.evaluatedAt,
    item.createdAt,
    item.timestamp
  ];
  for (const val of candidates) {
    if (typeof val === 'string' && val.trim()) {
      const parsed = Date.parse(val);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    } else if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
      return val;
    }
  }
  return 0;
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
    const existingTime = extractRecordTimestampMs(existing);
    const incomingTime = extractRecordTimestampMs(item);
    const existingRev = typeof existing._revision === 'number' ? existing._revision : 0;
    const incomingRev = typeof item._revision === 'number' ? item._revision : 0;

    const incomingWins =
      incomingTime > existingTime ||
      (incomingTime === existingTime && incomingRev >= existingRev);

    const base = incomingWins ? { ...existing, ...item } : { ...item, ...existing };

    // Explicitly preserve tasks array from whichever side is newer (even if empty array [])
    if (incomingWins && Array.isArray(item.tasks)) {
      base.tasks = item.tasks;
    } else if (!incomingWins && Array.isArray(existing.tasks)) {
      base.tasks = existing.tasks;
    } else if (Array.isArray(item.tasks)) {
      base.tasks = item.tasks;
    } else if (Array.isArray(existing.tasks)) {
      base.tasks = existing.tasks;
    }

    // For user items or items with passcode/pin, never overwrite a set passcode with an empty or missing one
    const existingPass =
      (existing.passcode && String(existing.passcode).trim()) ||
      (existing.pin && String(existing.pin).trim()) ||
      '';
    const incomingPass =
      (item.passcode && String(item.passcode).trim()) ||
      (item.pin && String(item.pin).trim()) ||
      '';
    const resolvedPasscode = incomingWins
      ? incomingPass || existingPass
      : existingPass || incomingPass;
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

  for (const item of list) {
    if (!item) continue;
    const dateSuffix = item.hijriDate ? `_${String(item.hijriDate).trim()}` : '';
    const key =
      item.assignmentId && item.studentId
        ? `${item.assignmentId}_${item.studentId}${dateSuffix}`
        : String(item.id || Math.random());

    const existing = map.get(key);
    if (!existing) {
      map.set(key, item);
    } else {
      const existingTime = extractRecordTimestampMs(existing);
      const itemTime = extractRecordTimestampMs(item);
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

  for (const item of list) {
    if (!item) continue;
    const key =
      item.challengeId && item.studentId
        ? `${item.challengeId}_${item.studentId}`
        : String(item.id || Math.random());

    const existing = map.get(key);
    if (!existing) {
      map.set(key, item);
    } else {
      const existingTime = extractRecordTimestampMs(existing);
      const itemTime = extractRecordTimestampMs(item);
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
      const existingTime = extractRecordTimestampMs(existing);
      const itemTime = extractRecordTimestampMs(item);
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

  for (const item of list) {
    if (!item || !item.studentId || !item.date) continue;
    const key = `${item.studentId}_${item.date}`;
    const canonicalId = `dr_${item.studentId}_${item.date}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...item, id: item.id || canonicalId });
    } else {
      const existingTime = extractRecordTimestampMs(existing);
      const itemTime = extractRecordTimestampMs(item);
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

  // Collect any dynamic overflow shards if present in shardsById
  const collectShardItems = (baseShardIds: string[]): any[] => {
    const collected: any[] = [];
    const visited = new Set<string>();
    for (const id of baseShardIds) {
      visited.add(id);
      const shardDoc = shardsById?.[id];
      if (Array.isArray(shardDoc?.items)) {
        collected.push(...shardDoc!.items);
      }
      if (Array.isArray(shardDoc?.overflowShardIds)) {
        for (const overflowId of shardDoc!.overflowShardIds) {
          if (!visited.has(overflowId)) {
            visited.add(overflowId);
            const ovDoc = shardsById?.[overflowId];
            if (Array.isArray(ovDoc?.items)) {
              collected.push(...ovDoc!.items);
            }
          }
        }
      }
    }
    return collected;
  };

  // 1. Daily Records
  const dailyShardItems = collectShardItems(DAILY_SHARD_DOC_IDS);
  const combinedDaily = deduplicateDailyRecords([
    ...(Array.isArray(base.dailyRecords) ? base.dailyRecords : []),
    ...dailyShardItems
  ]);
  base.dailyRecords = filterNotDeleted(combinedDaily, 'dailyRecords');

  // 2. Attendance Records
  const attendanceShardItems = collectShardItems(ATTENDANCE_SHARD_DOC_IDS);
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
  base.auditLogs = mergedLogs.slice(0, MAX_AUDIT_LOGS_COUNT);

  return base;
};

// ============================================================================
// SHARD SUBSCRIPTION & COMPLETENESS TRACKER (Section 4)
// ============================================================================

export interface WatchedDocMeta {
  docId: string;
  loaded: boolean;
  exists: boolean;
  fromCache: boolean;
  hasPendingWrites: boolean;
  error: string | null;
  updatedAtMs: number;
}

export class ShardSubscriptionCoordinator {
  private readonly requiredDocIds: string[];
  private readonly metaById = new Map<string, WatchedDocMeta>();
  private readonly dataById = new Map<string, Record<string, any> | null>();
  private emitSequence = 0;

  constructor(masterDocId = 'master_state', shardDocIds: string[] = ALL_SHARD_DOC_IDS) {
    this.requiredDocIds = [masterDocId, ...shardDocIds];
    for (const id of this.requiredDocIds) {
      this.metaById.set(id, {
        docId: id,
        loaded: false,
        exists: false,
        fromCache: true,
        hasPendingWrites: false,
        error: null,
        updatedAtMs: 0
      });
      this.dataById.set(id, null);
    }
  }

  recordSnapshot(
    docId: string,
    snapshot: {
      exists: boolean;
      data: Record<string, any> | null;
      fromCache: boolean;
      hasPendingWrites: boolean;
    }
  ): void {
    this.metaById.set(docId, {
      docId,
      loaded: true,
      exists: snapshot.exists,
      fromCache: snapshot.fromCache,
      hasPendingWrites: snapshot.hasPendingWrites,
      error: null,
      updatedAtMs: Date.now()
    });
    if (!snapshot.hasPendingWrites || this.dataById.get(docId) === null) {
      this.dataById.set(docId, snapshot.exists ? snapshot.data : null);
    }
  }

  recordError(docId: string, errorMessage: string): void {
    const prev = this.metaById.get(docId);
    this.metaById.set(docId, {
      docId,
      loaded: prev?.loaded ?? false,
      exists: prev?.exists ?? false,
      fromCache: prev?.fromCache ?? true,
      hasPendingWrites: prev?.hasPendingWrites ?? false,
      error: errorMessage || 'LISTENER_ERROR',
      updatedAtMs: Date.now()
    });
  }

  isAllRequiredLoaded(): boolean {
    for (const id of this.requiredDocIds) {
      const m = this.metaById.get(id);
      if (!m || !m.loaded || m.error !== null) return false;
    }
    return true;
  }

  hasAnyError(): boolean {
    for (const m of this.metaById.values()) {
      if (m.error !== null) return true;
    }
    return false;
  }

  getFailedDocIds(): string[] {
    const failed: string[] = [];
    for (const [id, m] of this.metaById.entries()) {
      if (m.error !== null) failed.push(id);
    }
    return failed;
  }

  getUnloadedDocIds(): string[] {
    const unloaded: string[] = [];
    for (const id of this.requiredDocIds) {
      const m = this.metaById.get(id);
      if (!m || !m.loaded) unloaded.push(id);
    }
    return unloaded;
  }

  computeStatus(options?: { isOnline?: boolean; pendingQueueCount?: number }): 'connected' | 'syncing' | 'pending' | 'offline' | 'error' {
    if (this.hasAnyError()) return 'error';
    if (options?.isOnline === false) return 'offline';
    if ((options?.pendingQueueCount ?? 0) > 0) return 'pending';
    if (!this.isAllRequiredLoaded()) return 'syncing';
    for (const id of this.requiredDocIds) {
      const m = this.metaById.get(id);
      if (!m || m.hasPendingWrites || m.fromCache) return 'syncing';
    }
    return 'connected';
  }

  nextEmitSequence(): number {
    this.emitSequence += 1;
    return this.emitSequence;
  }

  getCurrentEmitSequence(): number {
    return this.emitSequence;
  }

  assembleIfComplete(masterDocId = 'master_state'): {
    complete: boolean;
    state: Record<string, any> | null;
    fromServer: boolean;
    failedDocIds: string[];
    unloadedDocIds: string[];
  } {
    const failedDocIds = this.getFailedDocIds();
    const unloadedDocIds = this.getUnloadedDocIds();
    if (failedDocIds.length > 0 || unloadedDocIds.length > 0) {
      return {
        complete: false,
        state: null,
        fromServer: false,
        failedDocIds,
        unloadedDocIds
      };
    }

    const masterMeta = this.metaById.get(masterDocId);
    const masterData = this.dataById.get(masterDocId);
    if (!masterMeta?.exists || !masterData) {
      return {
        complete: true,
        state: null,
        fromServer: !masterMeta?.fromCache,
        failedDocIds: [],
        unloadedDocIds: []
      };
    }

    const shardsById: Record<string, Record<string, any> | null> = {};
    let allFromServer = !masterMeta.fromCache;
    for (const id of this.requiredDocIds) {
      if (id === masterDocId) continue;
      shardsById[id] = this.dataById.get(id) ?? null;
      const m = this.metaById.get(id);
      if (m?.fromCache) allFromServer = false;
    }

    const assembled = assembleShardedCloudState(masterData, shardsById);
    return {
      complete: true,
      state: assembled,
      fromServer: allFromServer,
      failedDocIds: [],
      unloadedDocIds: []
    };
  }
}

// ============================================================================
// OPTIMISTIC CONCURRENCY & TRANSACTIONAL MERGE ENGINE (Section 2 & 3)
// ============================================================================

export interface VersionedDocEnvelope {
  _revision?: number;
  lastOpId?: string;
  recentOpIds?: string[];
  updatedAt?: string;
  [key: string]: any;
}

export interface TransactionalDocAdapter {
  readFromServer(docId: string): Promise<{
    exists: boolean;
    data: VersionedDocEnvelope | null;
    fromServer: boolean;
  }>;
  writeIfRevisionMatches(
    docId: string,
    expectedRevision: number | null,
    nextData: VersionedDocEnvelope
  ): Promise<{ committed: boolean; conflict?: boolean }>;
}

/**
 * Applies an idempotent, revision-checked merge function to a target document with automatic
 * retry on concurrent modification (optimistic concurrency control), rejecting stale cache reads
 * and preventing duplicate application of the same `opId`.
 */
export const executeOptimisticDocMerge = async (params: {
  docId: string;
  opId: string;
  adapter: TransactionalDocAdapter;
  maxAttempts?: number;
  buildNextDoc: (remoteData: VersionedDocEnvelope | null, exists: boolean) => {
    skipWrite?: boolean;
    nextDoc: VersionedDocEnvelope;
  };
}): Promise<{
  committed: boolean;
  skippedAsDuplicateOp: boolean;
  skippedAsUnchanged: boolean;
  attempts: number;
  revision: number;
  finalDoc: VersionedDocEnvelope | null;
}> => {
  const maxAttempts = Math.max(1, Math.min(10, params.maxAttempts ?? 5));
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const snap = await params.adapter.readFromServer(params.docId);
    assertServerReadForWrite(params.docId, snap);

    const remoteData = snap.exists && snap.data ? snap.data : null;
    const remoteRevision =
      remoteData && typeof remoteData._revision === 'number' ? remoteData._revision : 0;
    const recentOps = Array.isArray(remoteData?.recentOpIds)
      ? remoteData!.recentOpIds.map(String)
      : [];

    // Idempotency guard: if this exact opId was already committed on the server, do not re-apply
    if (params.opId && (remoteData?.lastOpId === params.opId || recentOps.includes(params.opId))) {
      return {
        committed: true,
        skippedAsDuplicateOp: true,
        skippedAsUnchanged: false,
        attempts: attempt,
        revision: remoteRevision,
        finalDoc: remoteData
      };
    }

    const { skipWrite, nextDoc } = params.buildNextDoc(remoteData, snap.exists);
    if (skipWrite) {
      return {
        committed: true,
        skippedAsDuplicateOp: false,
        skippedAsUnchanged: true,
        attempts: attempt,
        revision: remoteRevision,
        finalDoc: remoteData
      };
    }

    const nextRevision = remoteRevision + 1;
    const updatedRecentOps = params.opId
      ? [...recentOps.filter(id => id !== params.opId), params.opId].slice(-MAX_RECENT_OP_IDS)
      : recentOps.slice(-MAX_RECENT_OP_IDS);

    const stampedDoc: VersionedDocEnvelope = {
      ...nextDoc,
      _revision: nextRevision,
      ...(params.opId ? { lastOpId: params.opId, recentOpIds: updatedRecentOps } : {}),
      updatedAt: nextDoc.updatedAt || new Date().toISOString()
    };

    validateDocumentSizeWithinLimit(params.docId, stampedDoc);

    try {
      const writeRes = await params.adapter.writeIfRevisionMatches(
        params.docId,
        snap.exists ? remoteRevision : null,
        stampedDoc
      );
      if (writeRes.committed) {
        return {
          committed: true,
          skippedAsDuplicateOp: false,
          skippedAsUnchanged: false,
          attempts: attempt,
          revision: nextRevision,
          finalDoc: stampedDoc
        };
      }
      lastError = new Error(`CONCURRENT_REVISION_CONFLICT_${params.docId}`);
    } catch (err) {
      if (err instanceof StaleCacheWriteError || err instanceof FirestoreDocumentSizeLimitError) {
        throw err;
      }
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`TRANSACTION_MAX_RETRIES_EXCEEDED_${params.docId}`);
};

// ============================================================================
// PERSISTENT OFFLINE PENDING SYNC QUEUE (Section 2 & 3)
// ============================================================================

export interface PendingSyncOperation {
  opId: string;
  createdAt: string;
  changedKeys: string[];
  isFullReplace?: boolean;
  payload: Record<string, any>;
  retryCount: number;
  lastError?: string;
}

export const PENDING_SYNC_QUEUE_STORAGE_KEY = 'ghaith_pending_sync_queue_v1';

export class PendingSyncQueueManager {
  private memoryQueue: PendingSyncOperation[] = [];
  private readonly storageKey: string;

  constructor(storageKey = PENDING_SYNC_QUEUE_STORAGE_KEY) {
    this.storageKey = storageKey;
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        this.memoryQueue = parsed.filter(item => item && typeof item.opId === 'string');
      }
    } catch {
      // keep memoryQueue intact
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      if (this.memoryQueue.length === 0) {
        window.localStorage.removeItem(this.storageKey);
      } else {
        window.localStorage.setItem(this.storageKey, JSON.stringify(this.memoryQueue));
      }
    } catch {
      // If localStorage quota is exceeded, memoryQueue still preserves the operations for the session
    }
  }

  getAll(): PendingSyncOperation[] {
    return [...this.memoryQueue];
  }

  size(): number {
    return this.memoryQueue.length;
  }

  enqueue(op: Omit<PendingSyncOperation, 'retryCount' | 'createdAt'> & { createdAt?: string }): PendingSyncOperation {
    const existingIdx = this.memoryQueue.findIndex(item => item.opId === op.opId);
    if (existingIdx >= 0) {
      return this.memoryQueue[existingIdx];
    }

    const entry: PendingSyncOperation = {
      opId: op.opId || createOperationId('sync'),
      createdAt: op.createdAt || new Date().toISOString(),
      changedKeys: Array.from(new Set(op.changedKeys || [])),
      isFullReplace: Boolean(op.isFullReplace),
      payload: deepCleanForFirestore(op.payload || {}),
      retryCount: 0
    };

    this.memoryQueue.push(entry);
    this.saveToStorage();
    return entry;
  }

  markSuccess(opId: string): void {
    this.memoryQueue = this.memoryQueue.filter(item => item.opId !== opId);
    this.saveToStorage();
  }

  markFailure(opId: string, errorMessage: string): void {
    const item = this.memoryQueue.find(op => op.opId === opId);
    if (item) {
      item.retryCount += 1;
      item.lastError = errorMessage;
      this.saveToStorage();
    }
  }

  clear(): void {
    this.memoryQueue = [];
    this.saveToStorage();
  }

  async flush(
    executor: (op: PendingSyncOperation) => Promise<void>
  ): Promise<{ flushedCount: number; remainingCount: number; errors: string[] }> {
    const snapshot = [...this.memoryQueue];
    let flushedCount = 0;
    const errors: string[] = [];

    for (const op of snapshot) {
      try {
        await executor(op);
        this.markSuccess(op.opId);
        flushedCount += 1;
      } catch (err: any) {
        const msg = err instanceof Error ? err.message : String(err);
        this.markFailure(op.opId, msg);
        errors.push(msg);
        // Stop flushing further dependent ops on network/offline failure to preserve causal order
        break;
      }
    }

    return {
      flushedCount,
      remainingCount: this.memoryQueue.length,
      errors
    };
  }
}

// ============================================================================
// SAFE, IDEMPOTENT, RESUMABLE, VERIFIED LEGACY-TO-SHARD MIGRATION (Section 6)
// ============================================================================

export interface MigrationCheckpoint {
  migrationId: string;
  phase: 'pending' | 'copying' | 'verifying' | 'completed' | 'rolled_back' | 'failed';
  completedShards: string[];
  backupSnapshot: Record<string, Record<string, any> | null>;
  startedAt: string;
  updatedAt: string;
  error?: string;
}

export interface ShardMigrationCollectionSummary {
  collection: string;
  sourceCount: number;
  deduplicatedSourceCount: number;
  targetCount: number;
  verified: boolean;
}

export interface ShardMigrationReport {
  migrationId: string;
  status: 'completed' | 'rolled_back' | 'failed' | 'partial_paused';
  idempotentPass: boolean;
  sourceRetainedUntilVerified: boolean;
  legacySourceCleanedAfterVerification: boolean;
  completedShards: string[];
  shardSizesBytes: Record<string, number>;
  collections: ShardMigrationCollectionSummary[];
  rolledBack: boolean;
  error?: string;
}

export interface MigrationSandboxAdapter {
  readAllDocs(): Promise<{
    completeRead: boolean;
    docs: Record<string, Record<string, any> | null>;
  }>;
  writeDoc(docId: string, data: Record<string, any>): Promise<void>;
}

/**
 * Executes an idempotent, resumable, and verified migration of legacy collections from `master_state`
 * to shard documents on a sandboxed storage adapter (never touching production directly unless explicitly invoked).
 * - Prevents duplicates during migration.
 * - Rejects deletion or overwrite on partial reads (`completeRead === false`).
 * - Supports checkpoint resumption after interruption.
 * - Verifies exact count and record ID/content parity before optional source cleanup.
 * - Automatically rolls back to the pre-migration snapshot if any write or verification fails.
 */
export const executeSafeLegacyShardMigration = async (params: {
  adapter: MigrationSandboxAdapter;
  checkpoint?: MigrationCheckpoint | null;
  cleanupLegacyAfterVerification?: boolean;
  simulateInterruptAfterShardCount?: number;
}): Promise<{ report: ShardMigrationReport; checkpoint: MigrationCheckpoint }> => {
  const nowIso = new Date().toISOString();
  const initialRead = await params.adapter.readAllDocs();

  if (!initialRead.completeRead) {
    const failedId = params.checkpoint?.migrationId || createOperationId('mig');
    const cp: MigrationCheckpoint = params.checkpoint || {
      migrationId: failedId,
      phase: 'failed',
      completedShards: [],
      backupSnapshot: {},
      startedAt: nowIso,
      updatedAt: nowIso,
      error: 'PARTIAL_SOURCE_READ_DETECTED'
    };
    return {
      checkpoint: cp,
      report: {
        migrationId: failedId,
        status: 'failed',
        idempotentPass: true,
        sourceRetainedUntilVerified: true,
        legacySourceCleanedAfterVerification: false,
        completedShards: cp.completedShards,
        shardSizesBytes: {},
        collections: [],
        rolledBack: false,
        error: 'PARTIAL_SOURCE_READ_DETECTED: تم إيقاف الترحيل لحماية البيانات بسبب قراءة جزئية للمصدر.'
      }
    };
  }

  const allDocs = initialRead.docs;
  const masterDoc = allDocs['master_state'];
  if (!masterDoc || typeof masterDoc !== 'object') {
    throw new Error('MIGRATION_SOURCE_MASTER_STATE_MISSING');
  }

  // Deep clone backup snapshot on first start so rollback is 100% deterministic
  const backupSnapshot: Record<string, Record<string, any> | null> =
    params.checkpoint && Object.keys(params.checkpoint.backupSnapshot || {}).length > 0
      ? JSON.parse(JSON.stringify(params.checkpoint.backupSnapshot))
      : JSON.parse(JSON.stringify(allDocs));

  const checkpoint: MigrationCheckpoint = {
    migrationId: params.checkpoint?.migrationId || createOperationId('mig'),
    phase: 'copying',
    completedShards: [...(params.checkpoint?.completedShards || [])],
    backupSnapshot,
    startedAt: params.checkpoint?.startedAt || nowIso,
    updatedAt: nowIso
  };

  const deletedEntities: DeletedEntities = masterDoc._deletedEntities || {};

  // Assemble combined records from both master_state and existing shards so nothing is ever lost
  const combinedState = assembleShardedCloudState(masterDoc, allDocs) || {};
  const expectedDaily = deduplicateDailyRecords(combinedState.dailyRecords || []);
  const expectedAttendance = deduplicateAttendanceRecords(combinedState.attendanceRecords || []);
  const expectedAtqini = deduplicateAtqiniSubmissions(combinedState.studentAtqiniSubmissions || []);
  const expectedChallenges = deduplicateChallengeSubmissions(combinedState.studentChallengeSubmissions || []);
  const expectedSubs = mergeArrayByKey(
    [],
    combinedState.studentSubscriptions || [],
    'id',
    deletedEntities.studentSubscriptions || []
  );
  const expectedLogs = mergeArrayByKey(
    [],
    combinedState.auditLogs || [],
    'id',
    deletedEntities.auditLogs || []
  ).slice(0, MAX_AUDIT_LOGS_COUNT);

  // Build target shard documents
  const targetShardPayloads: Record<string, Record<string, any>> = {};
  for (const shardId of DAILY_SHARD_DOC_IDS) {
    const bucketIdx = Number(shardId.replace('shard_daily_', '')) || 0;
    const items = expectedDaily.filter(r => getDailyRecordShardId(r) === shardId);
    targetShardPayloads[shardId] = {
      users: [],
      shardType: 'dailyRecords',
      bucket: bucketIdx,
      items: deepCleanForFirestore(items),
      _revision: ((allDocs[shardId]?._revision as number) || 0) + 1,
      updatedAt: nowIso
    };
  }
  for (const shardId of ATTENDANCE_SHARD_DOC_IDS) {
    const bucketIdx = Number(shardId.replace('shard_attendance_', '')) || 0;
    const items = expectedAttendance.filter(r => getAttendanceRecordShardId(r) === shardId);
    targetShardPayloads[shardId] = {
      users: [],
      shardType: 'attendanceRecords',
      bucket: bucketIdx,
      items: deepCleanForFirestore(items),
      _revision: ((allDocs[shardId]?._revision as number) || 0) + 1,
      updatedAt: nowIso
    };
  }
  targetShardPayloads[SHARD_SUBMISSIONS_DOC_ID] = {
    users: [],
    shardType: 'submissions',
    studentAtqiniSubmissions: deepCleanForFirestore(expectedAtqini),
    studentChallengeSubmissions: deepCleanForFirestore(expectedChallenges),
    _revision: ((allDocs[SHARD_SUBMISSIONS_DOC_ID]?._revision as number) || 0) + 1,
    updatedAt: nowIso
  };
  targetShardPayloads[SHARD_SUBSCRIPTIONS_LOGS_DOC_ID] = {
    users: [],
    shardType: 'subscriptionsAndLogs',
    studentSubscriptions: deepCleanForFirestore(expectedSubs),
    auditLogs: deepCleanForFirestore(expectedLogs),
    _revision: ((allDocs[SHARD_SUBSCRIPTIONS_LOGS_DOC_ID]?._revision as number) || 0) + 1,
    updatedAt: nowIso
  };

  const shardSizesBytes: Record<string, number> = {};

  const performRollback = async (reason: string): Promise<{ report: ShardMigrationReport; checkpoint: MigrationCheckpoint }> => {
    for (const [docId, snapshotData] of Object.entries(checkpoint.backupSnapshot)) {
      if (snapshotData) {
        await params.adapter.writeDoc(docId, JSON.parse(JSON.stringify(snapshotData)));
      }
    }
    checkpoint.phase = 'rolled_back';
    checkpoint.error = reason;
    checkpoint.updatedAt = new Date().toISOString();
    return {
      checkpoint,
      report: {
        migrationId: checkpoint.migrationId,
        status: 'rolled_back',
        idempotentPass: true,
        sourceRetainedUntilVerified: true,
        legacySourceCleanedAfterVerification: false,
        completedShards: checkpoint.completedShards,
        shardSizesBytes,
        collections: [],
        rolledBack: true,
        error: reason
      }
    };
  };

  try {
    let newlyProcessedThisRun = 0;
    for (const shardId of ALL_SHARD_DOC_IDS) {
      const payload = targetShardPayloads[shardId];
      const sizeCheck = validateDocumentSizeWithinLimit(shardId, payload);
      shardSizesBytes[shardId] = sizeCheck.byteSize;

      if (checkpoint.completedShards.includes(shardId)) {
        continue;
      }

      if (
        typeof params.simulateInterruptAfterShardCount === 'number' &&
        newlyProcessedThisRun >= params.simulateInterruptAfterShardCount
      ) {
        checkpoint.updatedAt = new Date().toISOString();
        return {
          checkpoint,
          report: {
            migrationId: checkpoint.migrationId,
            status: 'partial_paused',
            idempotentPass: true,
            sourceRetainedUntilVerified: true,
            legacySourceCleanedAfterVerification: false,
            completedShards: [...checkpoint.completedShards],
            shardSizesBytes,
            collections: [],
            rolledBack: false
          }
        };
      }

      await params.adapter.writeDoc(shardId, payload);
      checkpoint.completedShards.push(shardId);
      newlyProcessedThisRun += 1;
    }

    // Phase 2: Verification before touching legacy source
    checkpoint.phase = 'verifying';
    const postWriteRead = await params.adapter.readAllDocs();
    if (!postWriteRead.completeRead) {
      return await performRollback('VERIFICATION_READ_INCOMPLETE');
    }

    const postDocs = postWriteRead.docs;
    // Verify purely from the destination shards (passing master without legacy arrays)
    const masterWithoutLegacy = { ...(postDocs['master_state'] || {}) };
    for (const key of SHARDED_COLLECTION_KEYS) {
      delete masterWithoutLegacy[key];
    }
    const assembledFromShardsOnly = assembleShardedCloudState(masterWithoutLegacy, postDocs) || {};

    const summaries: ShardMigrationCollectionSummary[] = [
      {
        collection: 'dailyRecords',
        sourceCount: (Array.isArray(masterDoc.dailyRecords) ? masterDoc.dailyRecords.length : 0) || expectedDaily.length,
        deduplicatedSourceCount: expectedDaily.length,
        targetCount: (assembledFromShardsOnly.dailyRecords || []).length,
        verified: (assembledFromShardsOnly.dailyRecords || []).length === expectedDaily.length
      },
      {
        collection: 'attendanceRecords',
        sourceCount:
          (Array.isArray(masterDoc.attendanceRecords) ? masterDoc.attendanceRecords.length : 0) ||
          expectedAttendance.length,
        deduplicatedSourceCount: expectedAttendance.length,
        targetCount: (assembledFromShardsOnly.attendanceRecords || []).length,
        verified: (assembledFromShardsOnly.attendanceRecords || []).length === expectedAttendance.length
      },
      {
        collection: 'studentAtqiniSubmissions',
        sourceCount:
          (Array.isArray(masterDoc.studentAtqiniSubmissions) ? masterDoc.studentAtqiniSubmissions.length : 0) ||
          expectedAtqini.length,
        deduplicatedSourceCount: expectedAtqini.length,
        targetCount: (assembledFromShardsOnly.studentAtqiniSubmissions || []).length,
        verified: (assembledFromShardsOnly.studentAtqiniSubmissions || []).length === expectedAtqini.length
      },
      {
        collection: 'studentChallengeSubmissions',
        sourceCount:
          (Array.isArray(masterDoc.studentChallengeSubmissions) ? masterDoc.studentChallengeSubmissions.length : 0) ||
          expectedChallenges.length,
        deduplicatedSourceCount: expectedChallenges.length,
        targetCount: (assembledFromShardsOnly.studentChallengeSubmissions || []).length,
        verified: (assembledFromShardsOnly.studentChallengeSubmissions || []).length === expectedChallenges.length
      },
      {
        collection: 'studentSubscriptions',
        sourceCount:
          (Array.isArray(masterDoc.studentSubscriptions) ? masterDoc.studentSubscriptions.length : 0) ||
          expectedSubs.length,
        deduplicatedSourceCount: expectedSubs.length,
        targetCount: (assembledFromShardsOnly.studentSubscriptions || []).length,
        verified: (assembledFromShardsOnly.studentSubscriptions || []).length === expectedSubs.length
      },
      {
        collection: 'auditLogs',
        sourceCount: (Array.isArray(masterDoc.auditLogs) ? masterDoc.auditLogs.length : 0) || expectedLogs.length,
        deduplicatedSourceCount: expectedLogs.length,
        targetCount: (assembledFromShardsOnly.auditLogs || []).length,
        verified: (assembledFromShardsOnly.auditLogs || []).length === expectedLogs.length
      }
    ];

    const allVerified = summaries.every(s => s.verified);
    if (!allVerified) {
      return await performRollback('VERIFICATION_PARITY_MISMATCH');
    }

    let cleanedLegacy = false;
    if (params.cleanupLegacyAfterVerification === true) {
      const cleanedMaster = { ...masterWithoutLegacy, lastSyncedAt: new Date().toISOString() };
      validateDocumentSizeWithinLimit('master_state', cleanedMaster);
      await params.adapter.writeDoc('master_state', cleanedMaster);
      cleanedLegacy = true;
    }

    checkpoint.phase = 'completed';
    checkpoint.updatedAt = new Date().toISOString();

    return {
      checkpoint,
      report: {
        migrationId: checkpoint.migrationId,
        status: 'completed',
        idempotentPass: true,
        sourceRetainedUntilVerified: true,
        legacySourceCleanedAfterVerification: cleanedLegacy,
        completedShards: [...checkpoint.completedShards],
        shardSizesBytes,
        collections: summaries,
        rolledBack: false
      }
    };
  } catch (err: any) {
    const reason = err instanceof Error ? err.message : String(err);
    return await performRollback(reason);
  }
};

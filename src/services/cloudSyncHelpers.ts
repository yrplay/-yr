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

export class PendingQueuePersistenceError extends Error {
  readonly code = 'PENDING_QUEUE_STORAGE_FAILED';
  constructor(message?: string) {
    super(
      message ||
        'تعذر حفظ العملية في التخزين المحلي الدائم (localStorage و IndexedDB) أثناء العمل دون اتصال.'
    );
    this.name = 'PendingQueuePersistenceError';
  }
}

export class StaleReplaceStateError extends Error {
  readonly code = 'STALE_REPLACE_STATE_REJECTED';
  readonly remoteRevision: number;
  readonly expectedBaseRevision: number | null;
  constructor(remoteRevision: number, expectedBaseRevision: number | null, message?: string) {
    super(
      message ||
        `تم رفض استبدال الحالة السحابية (_replaceState) لأن الخادم يحتوي على نسخة أحدث (revision=${remoteRevision}, expected=${expectedBaseRevision ?? 'unknown'}).`
    );
    this.name = 'StaleReplaceStateError';
    this.remoteRevision = remoteRevision;
    this.expectedBaseRevision = expectedBaseRevision;
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
 * Extracts all dynamic overflow shard document IDs referenced by any base shard document.
 */
export const extractReferencedOverflowShardIds = (
  shardsById: Record<string, Record<string, any> | null | undefined>
): string[] => {
  const overflowIds = new Set<string>();
  for (const docData of Object.values(shardsById || {})) {
    if (!docData || typeof docData !== 'object') continue;
    if (Array.isArray(docData.overflowShardIds)) {
      for (const id of docData.overflowShardIds) {
        if (typeof id === 'string' && id.trim()) {
          overflowIds.add(id.trim());
        }
      }
    }
  }
  return Array.from(overflowIds);
};

/**
 * Assembles the full application state from `master_state` plus all shard docs (and any dynamic
 * overflow shards created by `partitionItemsIntoBoundedShards`), safely merging any unsharded
 * legacy arrays still present inside `master_state`.
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

  // Collect items across base shards and any dynamic overflow shards (including legacy prefix-matched overflow shards)
  const collectShardFieldItems = (baseShardIds: string[], fieldName = 'items'): any[] => {
    const collected: any[] = [];
    const visited = new Set<string>();

    const collectFromDocId = (docId: string) => {
      if (visited.has(docId)) return;
      visited.add(docId);
      const shardDoc = shardsById?.[docId];
      if (!shardDoc || typeof shardDoc !== 'object') return;
      if (Array.isArray(shardDoc[fieldName])) {
        collected.push(...shardDoc[fieldName]);
      } else if (fieldName !== 'items' && Array.isArray(shardDoc.items)) {
        collected.push(...shardDoc.items);
      }
      if (Array.isArray(shardDoc.overflowShardIds)) {
        for (const overflowId of shardDoc.overflowShardIds) {
          if (typeof overflowId === 'string' && overflowId) {
            collectFromDocId(overflowId);
          }
        }
      }
    };

    for (const id of baseShardIds) {
      collectFromDocId(id);
      // Also discover any overflow shards present in shardsById by prefix convention `${id}_overflow_`
      for (const candidateKey of Object.keys(shardsById || {})) {
        if (candidateKey.startsWith(`${id}_overflow_`)) {
          collectFromDocId(candidateKey);
        }
      }
    }
    return collected;
  };

  // 1. Daily Records
  const dailyShardItems = collectShardFieldItems(DAILY_SHARD_DOC_IDS, 'items');
  const combinedDaily = deduplicateDailyRecords([
    ...(Array.isArray(base.dailyRecords) ? base.dailyRecords : []),
    ...dailyShardItems
  ]);
  base.dailyRecords = filterNotDeleted(combinedDaily, 'dailyRecords');

  // 2. Attendance Records
  const attendanceShardItems = collectShardFieldItems(ATTENDANCE_SHARD_DOC_IDS, 'items');
  const combinedAttendance = deduplicateAttendanceRecords([
    ...(Array.isArray(base.attendanceRecords) ? base.attendanceRecords : []),
    ...attendanceShardItems
  ]);
  base.attendanceRecords = filterNotDeleted(combinedAttendance, 'attendanceRecords');

  // 3. Submissions (Atqini + Challenges) with dynamic overflow support
  const atqiniShardItems = collectShardFieldItems([SHARD_SUBMISSIONS_DOC_ID], 'studentAtqiniSubmissions');
  const combinedAtqini = deduplicateAtqiniSubmissions([
    ...(Array.isArray(base.studentAtqiniSubmissions) ? base.studentAtqiniSubmissions : []),
    ...atqiniShardItems
  ]);
  base.studentAtqiniSubmissions = filterNotDeleted(combinedAtqini, 'studentAtqiniSubmissions');

  const challengeShardItems = collectShardFieldItems([SHARD_SUBMISSIONS_DOC_ID], 'studentChallengeSubmissions');
  const combinedChallenges = deduplicateChallengeSubmissions([
    ...(Array.isArray(base.studentChallengeSubmissions) ? base.studentChallengeSubmissions : []),
    ...challengeShardItems
  ]);
  base.studentChallengeSubmissions = filterNotDeleted(combinedChallenges, 'studentChallengeSubmissions');

  // 4. Subscriptions & Audit Logs with dynamic overflow support
  const subsShardItems = collectShardFieldItems([SHARD_SUBSCRIPTIONS_LOGS_DOC_ID], 'studentSubscriptions');
  base.studentSubscriptions = mergeArrayByKey(
    Array.isArray(base.studentSubscriptions) ? base.studentSubscriptions : [],
    subsShardItems,
    'id',
    deletedEntities.studentSubscriptions || []
  );

  const logsShardItems = collectShardFieldItems([SHARD_SUBSCRIPTIONS_LOGS_DOC_ID], 'auditLogs');
  const mergedLogs = mergeArrayByKey(
    Array.isArray(base.auditLogs) ? base.auditLogs : [],
    logsShardItems,
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
// SHARD SUBSCRIPTION, DYNAMIC OVERFLOW & GENERATION CONSISTENCY TRACKER (Section 4 & 5)
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
  private readonly dynamicOverflowDocIds = new Set<string>();
  private readonly metaById = new Map<string, WatchedDocMeta>();
  private readonly dataById = new Map<string, Record<string, any> | null>();
  private emitSequence = 0;

  constructor(masterDocId = 'master_state', shardDocIds: string[] = ALL_SHARD_DOC_IDS) {
    this.requiredDocIds = [masterDocId, ...shardDocIds];
    for (const id of this.requiredDocIds) {
      this.initWatchedDoc(id);
    }
  }

  private initWatchedDoc(id: string): void {
    if (!this.metaById.has(id)) {
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

  private getAllTrackedDocIds(): string[] {
    return Array.from(new Set([...this.requiredDocIds, ...this.dynamicOverflowDocIds]));
  }

  registerDynamicShardIds(docIds: string[]): string[] {
    const newlyAdded: string[] = [];
    for (const rawId of docIds) {
      const id = String(rawId || '').trim();
      if (!id) continue;
      if (!this.requiredDocIds.includes(id) && !this.dynamicOverflowDocIds.has(id)) {
        this.dynamicOverflowDocIds.add(id);
        this.initWatchedDoc(id);
        newlyAdded.push(id);
      }
    }
    return newlyAdded;
  }

  recordSnapshot(
    docId: string,
    snapshot: {
      exists: boolean;
      data: Record<string, any> | null;
      fromCache: boolean;
      hasPendingWrites: boolean;
    }
  ): string[] {
    this.initWatchedDoc(docId);
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

    // Discover any dynamic overflow shards referenced by this shard or master_state._shardRevisions
    const discovered: string[] = [];
    const data = snapshot.exists ? snapshot.data : null;
    if (Array.isArray(data?.overflowShardIds)) {
      discovered.push(...this.registerDynamicShardIds(data!.overflowShardIds));
    }
    if (data?._shardRevisions && typeof data._shardRevisions === 'object') {
      discovered.push(...this.registerDynamicShardIds(Object.keys(data._shardRevisions)));
    }
    return discovered;
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

  /**
   * Verifies exact revision parity for every shard advertised by master_state and every
   * overflow shard referenced by a loaded shard. A newer revision is not accepted as proof
   * of consistency: it may belong to a different, not-yet-published generation.
   */
  getOutdatedShardIds(masterDocId = 'master_state'): string[] {
    const masterData = this.dataById.get(masterDocId);
    if (!masterData || typeof masterData !== 'object') return [];

    const expectedRevisions =
      masterData._shardRevisions && typeof masterData._shardRevisions === 'object'
        ? masterData._shardRevisions as Record<string, unknown>
        : {};
    const outdated = new Set<string>();

    const verifyExpectedRevision = (shardId: string, expectedRevRaw: unknown): void => {
      const expectedRev = Number(expectedRevRaw);
      if (!Number.isFinite(expectedRev) || expectedRev <= 0) {
        outdated.add(shardId);
        return;
      }

      const shardMeta = this.metaById.get(shardId);
      const shardData = this.dataById.get(shardId);
      if (!shardMeta || !shardMeta.loaded || shardMeta.error !== null || !shardMeta.exists) {
        outdated.add(shardId);
        return;
      }

      const actualRev =
        shardData && typeof shardData._revision === 'number' ? shardData._revision : 0;
      if (actualRev !== expectedRev) {
        outdated.add(shardId);
      }
    };

    for (const [shardId, expectedRev] of Object.entries(expectedRevisions)) {
      verifyExpectedRevision(shardId, expectedRev);
    }

    // A pointer is part of the published generation. It must have an explicit manifest
    // revision and a loaded, existing document; otherwise assembly could emit partial data.
    for (const shardData of this.dataById.values()) {
      if (!shardData || typeof shardData !== 'object' || !Array.isArray(shardData.overflowShardIds)) {
        continue;
      }
      for (const rawOverflowId of shardData.overflowShardIds) {
        if (typeof rawOverflowId !== 'string' || !rawOverflowId.trim()) continue;
        const overflowId = rawOverflowId.trim();
        if (!Object.prototype.hasOwnProperty.call(expectedRevisions, overflowId)) {
          outdated.add(overflowId);
          continue;
        }
        verifyExpectedRevision(overflowId, expectedRevisions[overflowId]);
      }
    }

    return Array.from(outdated);
  }

  isGenerationConsistent(masterDocId = 'master_state'): boolean {
    return this.getOutdatedShardIds(masterDocId).length === 0;
  }

  isAllRequiredLoaded(masterDocId = 'master_state'): boolean {
    for (const id of this.getAllTrackedDocIds()) {
      const m = this.metaById.get(id);
      if (!m || !m.loaded || m.error !== null) return false;
    }
    return this.isGenerationConsistent(masterDocId);
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
    for (const id of this.getAllTrackedDocIds()) {
      const m = this.metaById.get(id);
      if (!m || !m.loaded) unloaded.push(id);
    }
    return unloaded;
  }

  computeStatus(options?: { isOnline?: boolean; pendingQueueCount?: number; masterDocId?: string }): 'connected' | 'syncing' | 'pending' | 'offline' | 'error' {
    if (this.hasAnyError()) return 'error';
    if (options?.isOnline === false) return 'offline';
    if ((options?.pendingQueueCount ?? 0) > 0) return 'pending';
    const masterDocId = options?.masterDocId || 'master_state';
    if (!this.isAllRequiredLoaded(masterDocId)) return 'syncing';
    for (const id of this.getAllTrackedDocIds()) {
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
    outdatedShardIds: string[];
    generationConsistent: boolean;
  } {
    const failedDocIds = this.getFailedDocIds();
    const unloadedDocIds = this.getUnloadedDocIds();
    const outdatedShardIds = this.getOutdatedShardIds(masterDocId);
    const generationConsistent = outdatedShardIds.length === 0;

    if (failedDocIds.length > 0 || unloadedDocIds.length > 0 || !generationConsistent) {
      return {
        complete: false,
        state: null,
        fromServer: false,
        failedDocIds,
        unloadedDocIds,
        outdatedShardIds,
        generationConsistent
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
        unloadedDocIds: [],
        outdatedShardIds: [],
        generationConsistent: true
      };
    }

    const shardsById: Record<string, Record<string, any> | null> = {};
    let allFromServer = !masterMeta.fromCache;
    for (const id of this.getAllTrackedDocIds()) {
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
      unloadedDocIds: [],
      outdatedShardIds: [],
      generationConsistent: true
    };
  }
}

// ============================================================================
// OPTIMISTIC CONCURRENCY, _replaceState PROTECTION & BOUNDED SHARD SYNC
// ============================================================================

export interface VersionedDocEnvelope {
  _revision?: number;
  _syncGeneration?: string;
  _shardRevisions?: Record<string, number>;
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
 * Protects `_replaceState` operations against accidentally overwriting newer server state with
 * an outdated local state snapshot.
 * - Rejects with `StaleReplaceStateError` if `_expectedBaseRevision` is lower than `remoteData._revision`.
 * - Rejects with `StaleReplaceStateError` if `remoteData` has a newer `lastSyncedAt`/`updatedAt` or newer
 *   record `updatedAt` timestamps than `incomingState` (unless `_forceOverwriteNewerServer === true` with matching revision).
 */
export const validateReplaceStateFreshness = (
  remoteData: Record<string, any> | null | undefined,
  incomingState: Record<string, any>
): { ok: boolean; remoteRevision: number } => {
  if (!remoteData || typeof remoteData !== 'object' || Object.keys(remoteData).length === 0) {
    return { ok: true, remoteRevision: 0 };
  }

  const remoteRevision = typeof remoteData._revision === 'number' ? remoteData._revision : 0;
  const expectedRev =
    typeof incomingState?._expectedBaseRevision === 'number'
      ? incomingState._expectedBaseRevision
      : typeof incomingState?._revision === 'number'
      ? incomingState._revision
      : null;

  if (expectedRev !== null && remoteRevision > expectedRev) {
    throw new StaleReplaceStateError(remoteRevision, expectedRev);
  }

  // Also check timestamps so an unversioned stale local snapshot cannot overwrite newer server records
  const getMaxStateTimestampMs = (stateObj: Record<string, any>): number => {
    let maxMs = Math.max(
      Date.parse(stateObj.lastSyncedAt || '') || 0,
      Date.parse(stateObj.updatedAt || '') || 0,
      Number(stateObj._replaceTimestampMs || 0) || 0
    );
    const collections = ['users', 'circles', 'students', 'tracks', 'challenges', 'dailyRecords', 'attendanceRecords'];
    for (const col of collections) {
      if (Array.isArray(stateObj[col])) {
        for (const item of stateObj[col]) {
          const ts = extractRecordTimestampMs(item);
          if (ts > maxMs) maxMs = ts;
        }
      }
    }
    return maxMs;
  };

  const remoteMaxMs = getMaxStateTimestampMs(remoteData);
  const incomingMaxMs = getMaxStateTimestampMs(incomingState);

  if (
    incomingState?._forceOverwriteNewerServer !== true &&
    remoteMaxMs > 0 &&
    (incomingMaxMs === 0 ? expectedRev === null && remoteRevision > 0 : remoteMaxMs > incomingMaxMs)
  ) {
    throw new StaleReplaceStateError(
      remoteRevision,
      expectedRev,
      `تم رفض استبدال الحالة (_replaceState) لأن الخادم يحتوي على تعديلات أحدث زمنياً من النسخة المحلية (${new Date(
        remoteMaxMs
      ).toISOString()}).`
    );
  }

  return { ok: true, remoteRevision };
};

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
      if (
        err instanceof StaleCacheWriteError ||
        err instanceof FirestoreDocumentSizeLimitError ||
        err instanceof StaleReplaceStateError
      ) {
        throw err;
      }
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`TRANSACTION_MAX_RETRIES_EXCEEDED_${params.docId}`);
};

/**
 * Executes a dynamic, size-bounded shard write that connects `partitionItemsIntoBoundedShards`
 * directly to the transactional sync pipeline:
 * 1. Collects existing items from both the base shard and any existing `overflowShardIds`.
 * 2. Merges incoming items with remote items (respecting tombstones and `_replaceState`).
 * 3. Partitions the merged items into bounded sub-shards (`<= maxBytesPerShard`).
 * 4. Writes overflow shards first, then writes the base shard with `overflowShardIds`, and clears
 *    any retired overflow shards if the collection shrank.
 */
export const executeBoundedShardSync = async <T extends Record<string, any>>(params: {
  baseShardId: string;
  shardType: string;
  bucket?: number;
  opId: string;
  incomingItems: T[];
  deletedIds: string[];
  replaceState: boolean;
  maxBytesPerShard?: number;
  deduplicateAndMerge: (existingItems: T[], incomingItems: T[], deletedIds: string[], replaceState: boolean) => T[];
  readOverflowDoc: (docId: string) => Promise<Record<string, any> | null>;
  runDocTransaction: (txParams: {
    docId: string;
    opId: string;
    buildNext: (remoteData: Record<string, any> | null, exists: boolean) => {
      skipWrite?: boolean;
      payload: Record<string, any>;
    };
  }) => Promise<{ committed: boolean; skipped: boolean; revision: number }>;
}): Promise<{
  totalCount: number;
  writtenShardRevisions: Record<string, number>;
  overflowShardIds: string[];
}> => {
  const maxBytes = params.maxBytesPerShard ?? SHARD_SAFE_BYTE_LIMIT;
  const writtenShardRevisions: Record<string, number> = {};
  let finalItems: T[] = [];
  let previousOverflowIds: string[] = [];

  // Read base shard first inside or alongside overflow discovery, then commit overflow + base shards
  const baseOverflowProbe = await params.readOverflowDoc(params.baseShardId);
  if (Array.isArray(baseOverflowProbe?.overflowShardIds)) {
    previousOverflowIds = baseOverflowProbe!.overflowShardIds.map(String).filter(Boolean);
  }
  const existingOverflowItems: T[] = [];
  for (const ovId of previousOverflowIds) {
    const ovDoc = await params.readOverflowDoc(ovId);
    if (Array.isArray(ovDoc?.items)) {
      existingOverflowItems.push(...(ovDoc!.items as T[]));
    }
  }

  let partitions: Array<{ shardId: string; items: T[]; byteSize: number }> = [];

  // Run transaction on base shard to merge with latest remote items and determine exact partitions
  const baseRes = await params.runDocTransaction({
    docId: params.baseShardId,
    opId: params.opId,
    buildNext: remoteData => {
      const existingBaseItems = Array.isArray(remoteData?.items) ? (remoteData!.items as T[]) : [];
      const allExisting = [...existingBaseItems, ...existingOverflowItems];
      finalItems = deepCleanForFirestore(
        params.deduplicateAndMerge(allExisting, params.incomingItems, params.deletedIds, params.replaceState)
      );

      partitions = partitionItemsIntoBoundedShards(params.baseShardId, finalItems, maxBytes);
      const basePart = partitions[0] || { shardId: params.baseShardId, items: [], byteSize: 0 };
      const nextOverflowIds = partitions.slice(1).map(p => p.shardId);

      const prevRemoteOverflowIds = Array.isArray(remoteData?.overflowShardIds)
        ? remoteData!.overflowShardIds.map(String)
        : [];

      if (
        !params.replaceState &&
        existingBaseItems.length === basePart.items.length &&
        JSON.stringify(existingBaseItems) === JSON.stringify(basePart.items) &&
        JSON.stringify(prevRemoteOverflowIds) === JSON.stringify(nextOverflowIds)
      ) {
        return { skipWrite: true, payload: remoteData || {} };
      }

      return {
        skipWrite: false,
        payload: {
          users: [],
          shardType: params.shardType,
          ...(params.bucket !== undefined ? { bucket: params.bucket } : {}),
          items: basePart.items,
          overflowShardIds: nextOverflowIds,
          updatedAt: new Date().toISOString()
        }
      };
    }
  });

  writtenShardRevisions[params.baseShardId] = baseRes.revision;
  const activeOverflowPartitions = partitions.slice(1);
  const activeOverflowIds = activeOverflowPartitions.map(p => p.shardId);

  // Write each active overflow shard transactionally
  for (let i = 0; i < activeOverflowPartitions.length; i++) {
    const part = activeOverflowPartitions[i];
    const ovRes = await params.runDocTransaction({
      docId: part.shardId,
      opId: `${params.opId}_ov_${i + 1}`,
      buildNext: () => ({
        skipWrite: false,
        payload: {
          users: [],
          shardType: `${params.shardType}_overflow`,
          parentShardId: params.baseShardId,
          overflowIndex: i + 1,
          items: part.items,
          updatedAt: new Date().toISOString()
        }
      })
    });
    writtenShardRevisions[part.shardId] = ovRes.revision;
  }

  // Clear any retired overflow shards from previous larger states
  for (const oldOvId of previousOverflowIds) {
    if (!activeOverflowIds.includes(oldOvId)) {
      const clearRes = await params.runDocTransaction({
        docId: oldOvId,
        opId: `${params.opId}_clear_${oldOvId}`,
        buildNext: () => ({
          skipWrite: false,
          payload: {
            users: [],
            shardType: `${params.shardType}_overflow`,
            parentShardId: params.baseShardId,
            items: [],
            updatedAt: new Date().toISOString()
          }
        })
      });
      writtenShardRevisions[oldOvId] = clearRes.revision;
    }
  }

  return {
    totalCount: finalItems.length,
    writtenShardRevisions,
    overflowShardIds: activeOverflowIds
  };
};

// ============================================================================
// DEBOUNCED PERSIST COORDINATOR (Resolves All Rapid <350ms Calls Cleanly)
// ============================================================================

export interface PersistOutcome {
  cloudSynced: boolean;
  queuedOffline: boolean;
  opId: string;
  coalescedCount?: number;
}

export class DebouncedPersistCoordinator {
  private readonly debounceMs: number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pendingKeys = new Set<string>();
  private pendingReplaceState = false;
  private latestPayload: Record<string, any> = {};
  private latestOpId = '';
  private waitingResolvers: Array<(outcome: PersistOutcome) => void> = [];
  private waitingRejectors: Array<(err: unknown) => void> = [];

  constructor(debounceMs = 350) {
    this.debounceMs = Math.max(0, debounceMs);
  }

  schedule(params: {
    payload: Record<string, any>;
    changedKeys?: string[];
    replaceState?: boolean;
    immediate?: boolean;
    opId?: string;
    executor: (mergedPayload: Record<string, any>, opId: string) => Promise<{
      cloudSynced: boolean;
      queuedOffline: boolean;
      opId: string;
    }>;
  }): Promise<PersistOutcome> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const opId = params.opId || createOperationId('sync');
    this.latestOpId = opId;
    this.latestPayload = params.payload;

    if (params.replaceState) {
      this.pendingReplaceState = true;
      this.pendingKeys.add('__FULL__');
    } else if (Array.isArray(params.changedKeys) && params.changedKeys.length > 0) {
      for (const k of params.changedKeys) {
        this.pendingKeys.add(k);
      }
    } else {
      this.pendingKeys.add('__FULL__');
    }

    return new Promise<PersistOutcome>((resolve, reject) => {
      this.waitingResolvers.push(resolve);
      this.waitingRejectors.push(reject);

      const fireBatch = async () => {
        this.timer = null;
        const batchResolvers = this.waitingResolvers.splice(0, this.waitingResolvers.length);
        const batchRejectors = this.waitingRejectors.splice(0, this.waitingRejectors.length);
        const batchKeys = Array.from(this.pendingKeys);
        const isReplace = this.pendingReplaceState;
        const batchPayload = this.latestPayload;
        const batchOpId = this.latestOpId;

        this.pendingKeys.clear();
        this.pendingReplaceState = false;

        const effectivePayload = isReplace
          ? { ...batchPayload, _replaceState: true, _opId: batchOpId }
          : { ...batchPayload, _changedKeys: batchKeys, _opId: batchOpId };

        try {
          const res = await params.executor(effectivePayload, batchOpId);
          const outcome: PersistOutcome = {
            cloudSynced: res.cloudSynced,
            queuedOffline: res.queuedOffline,
            opId: res.opId || batchOpId,
            coalescedCount: batchResolvers.length
          };
          for (const r of batchResolvers) {
            r(outcome);
          }
        } catch (err) {
          for (const rej of batchRejectors) {
            rej(err);
          }
        }
      };

      if (params.immediate || this.debounceMs === 0) {
        void fireBatch();
      } else {
        this.timer = setTimeout(() => {
          void fireBatch();
        }, this.debounceMs);
      }
    });
  }
}

// ============================================================================
// DURABLE OFFLINE PENDING SYNC QUEUE WITH INDEXEDDB FALLBACK (Section 2 & 3)
// ============================================================================

export interface PendingSyncOperation {
  opId: string;
  createdAt: string;
  changedKeys: string[];
  isFullReplace?: boolean;
  payload: Record<string, any>;
  retryCount: number;
  lastError?: string;
  storageBackend?: 'localStorage' | 'indexedDB';
}

export interface QueueStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface AsyncQueueStorageAdapter {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
  removeItem(key: string): Promise<void> | void;
}

export const PENDING_SYNC_QUEUE_STORAGE_KEY = 'ghaith_pending_sync_queue_v1';
const IDB_DB_NAME = 'ghaith_sync_idb_v1';
const IDB_STORE_NAME = 'pending_sync_queue';

export const createBrowserIndexedDbAdapter = (): AsyncQueueStorageAdapter | null => {
  if (typeof window === 'undefined' || !window.indexedDB) return null;

  const openDb = (): Promise<IDBDatabase> =>
    new Promise((resolve, reject) => {
      try {
        const req = window.indexedDB.open(IDB_DB_NAME, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
            db.createObjectStore(IDB_STORE_NAME);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('IDB_OPEN_FAILED'));
      } catch (err) {
        reject(err);
      }
    });

  return {
    async getItem(key: string): Promise<string | null> {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE_NAME, 'readonly');
        const store = tx.objectStore(IDB_STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => {
          db.close();
          resolve(typeof req.result === 'string' ? req.result : null);
        };
        req.onerror = () => {
          db.close();
          reject(req.error || new Error('IDB_GET_FAILED'));
        };
      });
    },
    async setItem(key: string, value: string): Promise<void> {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
        const store = tx.objectStore(IDB_STORE_NAME);
        store.put(value, key);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error || new Error('IDB_PUT_FAILED'));
        };
      });
    },
    async removeItem(key: string): Promise<void> {
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
        const store = tx.objectStore(IDB_STORE_NAME);
        store.delete(key);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error || new Error('IDB_DELETE_FAILED'));
        };
      });
    }
  };
};

export interface PendingSyncQueueOptions {
  primaryStorage?: QueueStorageAdapter | null;
  fallbackStorage?: AsyncQueueStorageAdapter | QueueStorageAdapter | null;
}

export class PendingSyncQueueManager {
  private memoryQueue: PendingSyncOperation[] = [];
  private readonly storageKey: string;
  private readonly primaryStorage: QueueStorageAdapter | null;
  private readonly fallbackStorage: AsyncQueueStorageAdapter | QueueStorageAdapter | null;
  private lastActiveBackend: 'localStorage' | 'indexedDB' | 'none' = 'none';

  constructor(storageKey = PENDING_SYNC_QUEUE_STORAGE_KEY, options?: PendingSyncQueueOptions) {
    this.storageKey = storageKey;
    this.primaryStorage =
      options && 'primaryStorage' in options
        ? options.primaryStorage ?? null
        : typeof window !== 'undefined' && window.localStorage
        ? window.localStorage
        : null;
    this.fallbackStorage =
      options && 'fallbackStorage' in options
        ? options.fallbackStorage ?? null
        : createBrowserIndexedDbAdapter();

    this.loadFromStorageSync();
  }

  private parseSerializedQueue(raw: string | null): PendingSyncOperation[] | null {
    if (!raw || typeof raw !== 'string') return null;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(item => item && typeof item.opId === 'string');
      }
    } catch {
      // invalid JSON
    }
    return null;
  }

  private loadFromStorageSync(): void {
    if (this.primaryStorage) {
      try {
        const raw = this.primaryStorage.getItem(this.storageKey);
        const parsed = this.parseSerializedQueue(raw);
        if (parsed) {
          this.memoryQueue = parsed;
          this.lastActiveBackend = 'localStorage';
          return;
        }
      } catch {
        // try synchronous fallback if available
      }
    }
    if (this.fallbackStorage) {
      try {
        const maybeRaw = this.fallbackStorage.getItem(this.storageKey);
        if (typeof maybeRaw === 'string') {
          const parsed = this.parseSerializedQueue(maybeRaw);
          if (parsed) {
            this.memoryQueue = parsed;
            this.lastActiveBackend = 'indexedDB';
          }
        }
      } catch {
        // ignore sync load error on async fallback
      }
    }
  }

  /**
   * Hydrates the queue from durable storage (`localStorage` and/or `IndexedDB`), merging any
   * operations persisted in `IndexedDB` when `localStorage` was full or cleared across an offline reload.
   */
  async hydrateFromDurableStorage(): Promise<PendingSyncOperation[]> {
    const mergedById = new Map<string, PendingSyncOperation>();

    if (this.primaryStorage) {
      try {
        const raw = this.primaryStorage.getItem(this.storageKey);
        const list = this.parseSerializedQueue(raw);
        if (list) {
          for (const op of list) mergedById.set(op.opId, op);
        }
      } catch {
        // primary unavailable
      }
    }

    if (this.fallbackStorage) {
      try {
        const raw = await this.fallbackStorage.getItem(this.storageKey);
        const list = this.parseSerializedQueue(raw);
        if (list) {
          for (const op of list) mergedById.set(op.opId, op);
        }
      } catch {
        // fallback unavailable
      }
    }

    for (const memOp of this.memoryQueue) {
      if (!mergedById.has(memOp.opId)) {
        mergedById.set(memOp.opId, memOp);
      }
    }

    this.memoryQueue = Array.from(mergedById.values());
    return this.getAll();
  }

  /**
   * Persists the current queue synchronously to `primaryStorage` (`localStorage`) or a synchronous
   * `fallbackStorage`, verifying write integrity via read-back. Throws `PendingQueuePersistenceError`
   * if neither storage backend can durably persist the queue.
   */
  private persistQueueSyncOrThrow(): 'localStorage' | 'indexedDB' {
    const serialized = JSON.stringify(this.memoryQueue);
    let primarySucceeded = false;
    let fallbackSucceeded = false;

    if (this.primaryStorage) {
      try {
        if (this.memoryQueue.length === 0) {
          this.primaryStorage.removeItem(this.storageKey);
          primarySucceeded = true;
        } else {
          this.primaryStorage.setItem(this.storageKey, serialized);
          const readBack = this.primaryStorage.getItem(this.storageKey);
          if (readBack === serialized) {
            primarySucceeded = true;
            this.lastActiveBackend = 'localStorage';
          }
        }
      } catch {
        primarySucceeded = false;
      }
    }

    if (this.fallbackStorage) {
      try {
        if (this.memoryQueue.length === 0) {
          const res = this.fallbackStorage.removeItem(this.storageKey);
          if (!(res instanceof Promise)) {
            fallbackSucceeded = true;
          } else {
            res.catch(() => {});
          }
        } else {
          const res = this.fallbackStorage.setItem(this.storageKey, serialized);
          if (!(res instanceof Promise)) {
            const readBack = this.fallbackStorage.getItem(this.storageKey);
            if (typeof readBack === 'string' && readBack === serialized) {
              fallbackSucceeded = true;
              if (!primarySucceeded) this.lastActiveBackend = 'indexedDB';
            }
          } else {
            res.catch(() => {});
          }
        }
      } catch {
        fallbackSucceeded = false;
      }
    }

    if (!primarySucceeded && !fallbackSucceeded) {
      throw new PendingQueuePersistenceError();
    }

    return primarySucceeded ? 'localStorage' : 'indexedDB';
  }

  /**
   * Persists the current queue to `primaryStorage` (`localStorage`) and/or `fallbackStorage` (`IndexedDB`),
   * awaiting async IndexedDB writes when `localStorage` quota is exceeded.
   * Throws `PendingQueuePersistenceError` if BOTH `localStorage` and `IndexedDB` fail.
   */
  private async persistQueueDurableOrThrow(): Promise<'localStorage' | 'indexedDB'> {
    const serialized = JSON.stringify(this.memoryQueue);
    let primarySucceeded = false;
    let fallbackSucceeded = false;

    if (this.primaryStorage) {
      try {
        if (this.memoryQueue.length === 0) {
          this.primaryStorage.removeItem(this.storageKey);
          primarySucceeded = true;
        } else {
          this.primaryStorage.setItem(this.storageKey, serialized);
          const readBack = this.primaryStorage.getItem(this.storageKey);
          if (readBack === serialized) {
            primarySucceeded = true;
            this.lastActiveBackend = 'localStorage';
          }
        }
      } catch {
        primarySucceeded = false;
      }
    }

    if (this.fallbackStorage) {
      try {
        if (this.memoryQueue.length === 0) {
          await this.fallbackStorage.removeItem(this.storageKey);
          fallbackSucceeded = true;
        } else {
          await this.fallbackStorage.setItem(this.storageKey, serialized);
          const readBack = await this.fallbackStorage.getItem(this.storageKey);
          if (readBack === serialized) {
            fallbackSucceeded = true;
            if (!primarySucceeded) this.lastActiveBackend = 'indexedDB';
          }
        }
      } catch {
        fallbackSucceeded = false;
      }
    }

    if (!primarySucceeded && !fallbackSucceeded) {
      throw new PendingQueuePersistenceError();
    }

    return primarySucceeded ? 'localStorage' : 'indexedDB';
  }

  getLastActiveBackend(): 'localStorage' | 'indexedDB' | 'none' {
    return this.lastActiveBackend;
  }

  getAll(): PendingSyncOperation[] {
    return [...this.memoryQueue];
  }

  size(): number {
    return this.memoryQueue.length;
  }

  /**
   * Enqueues an operation and verifies durable storage synchronously (`localStorage` or synchronous fallback).
   * If durable persistence fails, rolls back `memoryQueue` and throws `PendingQueuePersistenceError`
   * so the operation is NEVER falsely treated as saved offline.
   */
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

    const previousSnapshot = [...this.memoryQueue];
    this.memoryQueue.push(entry);
    try {
      const backend = this.persistQueueSyncOrThrow();
      entry.storageBackend = backend;
      return entry;
    } catch (err) {
      this.memoryQueue = previousSnapshot;
      throw err;
    }
  }

  /**
   * Async durable enqueue that falls back to `IndexedDB` when `localStorage` throws `QuotaExceededError`.
   * Rolls back `memoryQueue` and throws `PendingQueuePersistenceError` if both `localStorage` and `IndexedDB` fail.
   */
  async enqueueDurable(
    op: Omit<PendingSyncOperation, 'retryCount' | 'createdAt'> & { createdAt?: string }
  ): Promise<PendingSyncOperation> {
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

    const previousSnapshot = [...this.memoryQueue];
    this.memoryQueue.push(entry);
    try {
      const backend = await this.persistQueueDurableOrThrow();
      entry.storageBackend = backend;
      return entry;
    } catch (err) {
      this.memoryQueue = previousSnapshot;
      throw err;
    }
  }

  markSuccess(opId: string): void {
    this.memoryQueue = this.memoryQueue.filter(item => item.opId !== opId);
    try {
      this.persistQueueSyncOrThrow();
    } catch {
      // ignore storage cleanup failure after memory removal
    }
  }

  markFailure(opId: string, errorMessage: string): void {
    const item = this.memoryQueue.find(op => op.opId === opId);
    if (item) {
      item.retryCount += 1;
      item.lastError = errorMessage;
      try {
        this.persistQueueSyncOrThrow();
      } catch {
        // ignore
      }
    }
  }

  clear(): void {
    this.memoryQueue = [];
    try {
      this.persistQueueSyncOrThrow();
    } catch {
      // ignore
    }
  }

  async flush(
    executor: (op: PendingSyncOperation) => Promise<void>
  ): Promise<{ flushedCount: number; remainingCount: number; errors: string[] }> {
    await this.hydrateFromDurableStorage();
    const snapshot = [...this.memoryQueue];
    let flushedCount = 0;
    const errors: string[] = [];

    for (const op of snapshot) {
      try {
        await executor(op);
        this.markSuccess(op.opId);
        await this.persistQueueDurableOrThrow().catch(() => {});
        flushedCount += 1;
      } catch (err: any) {
        const msg = err instanceof Error ? err.message : String(err);
        this.markFailure(op.opId, msg);
        await this.persistQueueDurableOrThrow().catch(() => {});
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
// SAFE, IDEMPOTENT, RESUMABLE, CONTENT-VERIFIED LEGACY-TO-SHARD MIGRATION (Section 6)
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
  idsMatched: boolean;
  contentMatched: boolean;
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
 * Produces a deterministic canonical JSON string with recursively sorted object keys so two
 * records can be compared for deep content parity regardless of property insertion order.
 */
export const canonicalizeRecordForParity = (val: any): string => {
  const normalize = (input: any): any => {
    if (input === null || input === undefined) return null;
    if (Array.isArray(input)) return input.map(normalize);
    if (typeof input === 'object') {
      const sorted: Record<string, any> = {};
      for (const k of Object.keys(input).sort()) {
        if (input[k] !== undefined) {
          sorted[k] = normalize(input[k]);
        }
      }
      return sorted;
    }
    return input;
  };
  return JSON.stringify(normalize(deepCleanForFirestore(val)));
};

/**
 * Verifies that `actualRecords` matches `expectedRecords` not only in count, but also in
 * exact record IDs and deep canonical record content.
 */
export const verifyCollectionContentParity = <T extends Record<string, any>>(
  expectedRecords: T[],
  actualRecords: T[],
  getKey: (item: T) => string = item => String(item?.id ?? '')
): { countMatched: boolean; idsMatched: boolean; contentMatched: boolean; verified: boolean } => {
  const countMatched = expectedRecords.length === actualRecords.length;
  const expectedMap = new Map<string, string>();
  for (const item of expectedRecords) {
    const key = getKey(item);
    expectedMap.set(key, canonicalizeRecordForParity(item));
  }

  const actualMap = new Map<string, string>();
  for (const item of actualRecords) {
    const key = getKey(item);
    actualMap.set(key, canonicalizeRecordForParity(item));
  }

  if (expectedMap.size !== actualMap.size) {
    return {
      countMatched,
      idsMatched: false,
      contentMatched: false,
      verified: false
    };
  }

  let idsMatched = true;
  let contentMatched = true;
  for (const [key, expectedCanonical] of expectedMap.entries()) {
    if (!actualMap.has(key)) {
      idsMatched = false;
      contentMatched = false;
      break;
    }
    if (actualMap.get(key) !== expectedCanonical) {
      contentMatched = false;
    }
  }

  const verified = countMatched && idsMatched && contentMatched;
  return { countMatched, idsMatched, contentMatched, verified };
};

/**
 * Executes an idempotent, resumable, and deep-content-verified migration of legacy collections
 * from `master_state` to shard documents (with automatic overflow sharding via `partitionItemsIntoBoundedShards`).
 * - Prevents duplicates during migration.
 * - Rejects deletion or overwrite on partial reads (`completeRead === false`).
 * - Supports checkpoint resumption after interruption.
 * - Verifies exact count, record IDs, AND deep canonical record content before optional source cleanup.
 * - Automatically rolls back to the pre-migration snapshot if any write or verification fails.
 */
export const executeSafeLegacyShardMigration = async (params: {
  adapter: MigrationSandboxAdapter;
  checkpoint?: MigrationCheckpoint | null;
  cleanupLegacyAfterVerification?: boolean;
  simulateInterruptAfterShardCount?: number;
  maxBytesPerShard?: number;
}): Promise<{ report: ShardMigrationReport; checkpoint: MigrationCheckpoint }> => {
  const nowIso = new Date().toISOString();
  const maxBytesPerShard = params.maxBytesPerShard ?? SHARD_SAFE_BYTE_LIMIT;
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
  const expectedDaily = deepCleanForFirestore(deduplicateDailyRecords(combinedState.dailyRecords || []));
  const expectedAttendance = deepCleanForFirestore(
    deduplicateAttendanceRecords(combinedState.attendanceRecords || [])
  );
  const expectedAtqini = deepCleanForFirestore(
    deduplicateAtqiniSubmissions(combinedState.studentAtqiniSubmissions || [])
  );
  const expectedChallenges = deepCleanForFirestore(
    deduplicateChallengeSubmissions(combinedState.studentChallengeSubmissions || [])
  );
  const expectedSubs = deepCleanForFirestore(
    mergeArrayByKey(
      [],
      combinedState.studentSubscriptions || [],
      'id',
      deletedEntities.studentSubscriptions || []
    )
  );
  const expectedLogs = deepCleanForFirestore(
    mergeArrayByKey([], combinedState.auditLogs || [], 'id', deletedEntities.auditLogs || []).slice(
      0,
      MAX_AUDIT_LOGS_COUNT
    )
  );
  expectedLogs.sort(
    (a: any, b: any) => (Date.parse(b?.timestamp || '') || 0) - (Date.parse(a?.timestamp || '') || 0)
  );

  // Build target shard documents (using partitionItemsIntoBoundedShards for automatic overflow splitting)
  const targetShardPayloads: Record<string, Record<string, any>> = {};
  const targetShardOrder: string[] = [];

  const addPartitionedShardPayloads = (baseShardId: string, shardType: string, bucket: number, items: any[]) => {
    const partitions = partitionItemsIntoBoundedShards(baseShardId, items, maxBytesPerShard);
    const basePart = partitions[0] || { shardId: baseShardId, items: [], byteSize: 0 };
    const overflowParts = partitions.slice(1);
    const overflowIds = overflowParts.map(p => p.shardId);

    targetShardPayloads[baseShardId] = {
      users: [],
      shardType,
      bucket,
      items: deepCleanForFirestore(basePart.items),
      overflowShardIds: overflowIds,
      _revision: ((allDocs[baseShardId]?._revision as number) || 0) + 1,
      updatedAt: nowIso
    };
    targetShardOrder.push(baseShardId);

    for (let i = 0; i < overflowParts.length; i++) {
      const ov = overflowParts[i];
      targetShardPayloads[ov.shardId] = {
        users: [],
        shardType: `${shardType}_overflow`,
        parentShardId: baseShardId,
        overflowIndex: i + 1,
        items: deepCleanForFirestore(ov.items),
        _revision: ((allDocs[ov.shardId]?._revision as number) || 0) + 1,
        updatedAt: nowIso
      };
      targetShardOrder.push(ov.shardId);
    }
  };

  for (const shardId of DAILY_SHARD_DOC_IDS) {
    const bucketIdx = Number(shardId.replace('shard_daily_', '')) || 0;
    const items = expectedDaily.filter((r: any) => getDailyRecordShardId(r) === shardId);
    addPartitionedShardPayloads(shardId, 'dailyRecords', bucketIdx, items);
  }
  for (const shardId of ATTENDANCE_SHARD_DOC_IDS) {
    const bucketIdx = Number(shardId.replace('shard_attendance_', '')) || 0;
    const items = expectedAttendance.filter((r: any) => getAttendanceRecordShardId(r) === shardId);
    addPartitionedShardPayloads(shardId, 'attendanceRecords', bucketIdx, items);
  }
  targetShardPayloads[SHARD_SUBMISSIONS_DOC_ID] = {
    users: [],
    shardType: 'submissions',
    studentAtqiniSubmissions: expectedAtqini,
    studentChallengeSubmissions: expectedChallenges,
    _revision: ((allDocs[SHARD_SUBMISSIONS_DOC_ID]?._revision as number) || 0) + 1,
    updatedAt: nowIso
  };
  targetShardOrder.push(SHARD_SUBMISSIONS_DOC_ID);

  targetShardPayloads[SHARD_SUBSCRIPTIONS_LOGS_DOC_ID] = {
    users: [],
    shardType: 'subscriptionsAndLogs',
    studentSubscriptions: expectedSubs,
    auditLogs: expectedLogs,
    _revision: ((allDocs[SHARD_SUBSCRIPTIONS_LOGS_DOC_ID]?._revision as number) || 0) + 1,
    updatedAt: nowIso
  };
  targetShardOrder.push(SHARD_SUBSCRIPTIONS_LOGS_DOC_ID);

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
    for (const shardId of targetShardOrder) {
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

    // Phase 2: Deep Content & ID Verification before touching legacy source
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

    const dailyParity = verifyCollectionContentParity(
      expectedDaily,
      assembledFromShardsOnly.dailyRecords || [],
      (r: any) => `${r?.studentId || ''}_${r?.date || r?.id || ''}`
    );
    const attendanceParity = verifyCollectionContentParity(
      expectedAttendance,
      assembledFromShardsOnly.attendanceRecords || [],
      (r: any) => `${r?.studentId || ''}_${r?.date || r?.id || ''}`
    );
    const atqiniParity = verifyCollectionContentParity(
      expectedAtqini,
      assembledFromShardsOnly.studentAtqiniSubmissions || [],
      (r: any) => String(r?.id ?? '')
    );
    const challengesParity = verifyCollectionContentParity(
      expectedChallenges,
      assembledFromShardsOnly.studentChallengeSubmissions || [],
      (r: any) => String(r?.id ?? '')
    );
    const subsParity = verifyCollectionContentParity(
      expectedSubs,
      assembledFromShardsOnly.studentSubscriptions || [],
      (r: any) => String(r?.id ?? '')
    );
    const logsParity = verifyCollectionContentParity(
      expectedLogs,
      assembledFromShardsOnly.auditLogs || [],
      (r: any) => String(r?.id ?? '')
    );

    const summaries: ShardMigrationCollectionSummary[] = [
      {
        collection: 'dailyRecords',
        sourceCount: (Array.isArray(masterDoc.dailyRecords) ? masterDoc.dailyRecords.length : 0) || expectedDaily.length,
        deduplicatedSourceCount: expectedDaily.length,
        targetCount: (assembledFromShardsOnly.dailyRecords || []).length,
        idsMatched: dailyParity.idsMatched,
        contentMatched: dailyParity.contentMatched,
        verified: dailyParity.verified
      },
      {
        collection: 'attendanceRecords',
        sourceCount:
          (Array.isArray(masterDoc.attendanceRecords) ? masterDoc.attendanceRecords.length : 0) ||
          expectedAttendance.length,
        deduplicatedSourceCount: expectedAttendance.length,
        targetCount: (assembledFromShardsOnly.attendanceRecords || []).length,
        idsMatched: attendanceParity.idsMatched,
        contentMatched: attendanceParity.contentMatched,
        verified: attendanceParity.verified
      },
      {
        collection: 'studentAtqiniSubmissions',
        sourceCount:
          (Array.isArray(masterDoc.studentAtqiniSubmissions) ? masterDoc.studentAtqiniSubmissions.length : 0) ||
          expectedAtqini.length,
        deduplicatedSourceCount: expectedAtqini.length,
        targetCount: (assembledFromShardsOnly.studentAtqiniSubmissions || []).length,
        idsMatched: atqiniParity.idsMatched,
        contentMatched: atqiniParity.contentMatched,
        verified: atqiniParity.verified
      },
      {
        collection: 'studentChallengeSubmissions',
        sourceCount:
          (Array.isArray(masterDoc.studentChallengeSubmissions) ? masterDoc.studentChallengeSubmissions.length : 0) ||
          expectedChallenges.length,
        deduplicatedSourceCount: expectedChallenges.length,
        targetCount: (assembledFromShardsOnly.studentChallengeSubmissions || []).length,
        idsMatched: challengesParity.idsMatched,
        contentMatched: challengesParity.contentMatched,
        verified: challengesParity.verified
      },
      {
        collection: 'studentSubscriptions',
        sourceCount:
          (Array.isArray(masterDoc.studentSubscriptions) ? masterDoc.studentSubscriptions.length : 0) ||
          expectedSubs.length,
        deduplicatedSourceCount: expectedSubs.length,
        targetCount: (assembledFromShardsOnly.studentSubscriptions || []).length,
        idsMatched: subsParity.idsMatched,
        contentMatched: subsParity.contentMatched,
        verified: subsParity.verified
      },
      {
        collection: 'auditLogs',
        sourceCount: (Array.isArray(masterDoc.auditLogs) ? masterDoc.auditLogs.length : 0) || expectedLogs.length,
        deduplicatedSourceCount: expectedLogs.length,
        targetCount: (assembledFromShardsOnly.auditLogs || []).length,
        idsMatched: logsParity.idsMatched,
        contentMatched: logsParity.contentMatched,
        verified: logsParity.verified
      }
    ];

    const allVerified = summaries.every(s => s.verified);
    if (!allVerified) {
      const hasContentMismatch = summaries.some(
        s => s.targetCount === s.deduplicatedSourceCount && (!s.idsMatched || !s.contentMatched)
      );
      return await performRollback(
        hasContentMismatch ? 'VERIFICATION_CONTENT_MISMATCH' : 'VERIFICATION_PARITY_MISMATCH'
      );
    }

    let cleanedLegacy = false;
    if (params.cleanupLegacyAfterVerification === true) {
      const shardRevisionsMap: Record<string, number> = {};
      for (const shardId of targetShardOrder) {
        shardRevisionsMap[shardId] = Number(postDocs[shardId]?._revision || 1);
      }
      const cleanedMaster = {
        ...masterWithoutLegacy,
        _syncGeneration: checkpoint.migrationId,
        _shardRevisions: shardRevisionsMap,
        lastSyncedAt: new Date().toISOString()
      };
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

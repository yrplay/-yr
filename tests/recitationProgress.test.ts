import assert from 'node:assert/strict';
import test from 'node:test';
import type { DailyRecord } from '../src/types';
import { summarizeDailyPageProgress } from '../src/services/recitationProgress';

const record = (overrides: Partial<DailyRecord> = {}): DailyRecord => ({
  id: 'r1',
  studentId: 's1',
  circleId: 'c1',
  date: '2026-10-29',
  dayName: 'الخميس',
  newMemorizationCompleted: true,
  newMemorizationWithConditions: true,
  newMemorizationPages: 2,
  revisionCompleted: true,
  revisionPages: 7,
  memorizationMistakes: 0,
  hintsCount: 0,
  tajweedErrorsCount: 0,
  recitationScore: 9,
  minorRevisionPortion: { surahNumber: 1, fromAyah: 1, toAyah: 5, pagesCount: 3, status: 'excellent' },
  tamkeenRevisionPortion: { surahNumber: 2, fromAyah: 1, toAyah: 8, pagesCount: 4, status: 'excellent' },
  conditions: {
    listenedToReader: true,
    recitedLooking: true,
    masteryRepetition: true,
    minorRevision: true,
    tamkeenRevision: true,
    achievedDistinction: false
  },
  status: 'completed',
  recordedBy: 'u1',
  recordedAt: '2026-10-29T10:00:00.000Z',
  ...overrides
});

test('page totals keep new memorization, minor revision, and tamkeen independent', () => {
  const progress = summarizeDailyPageProgress([record()]);
  assert.deepEqual(progress, {
    newMemorizationPagesDone: 2,
    revisionPagesDone: 7,
    minorRevisionPagesDone: 3,
    tamkeenRevisionPagesDone: 4,
    unclassifiedRevisionPagesDone: 0
  });
});

test('legacy aggregate revision pages remain visible as unclassified instead of being assigned to tamkeen', () => {
  const legacyRecord = record({
    id: 'legacy',
    revisionPages: 5,
    minorRevisionPortion: undefined,
    tamkeenRevisionPortion: undefined
  });
  const progress = summarizeDailyPageProgress([legacyRecord]);
  assert.equal(progress.revisionPagesDone, 5);
  assert.equal(progress.minorRevisionPagesDone, 0);
  assert.equal(progress.tamkeenRevisionPagesDone, 0);
  assert.equal(progress.unclassifiedRevisionPagesDone, 5);
});

test('uncompleted and unqualified new memorization do not inflate completed progress', () => {
  const progress = summarizeDailyPageProgress([
    record({ id: 'pending', status: 'pending' }),
    record({ id: 'without-conditions', newMemorizationWithConditions: false })
  ]);
  assert.equal(progress.newMemorizationPagesDone, 0);
  assert.equal(progress.revisionPagesDone, 7);
  assert.equal(progress.tamkeenRevisionPagesDone, 4);
});

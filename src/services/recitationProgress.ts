import type { DailyRecord } from '../types';

export interface DailyPageProgress {
  newMemorizationPagesDone: number;
  revisionPagesDone: number;
  minorRevisionPagesDone: number;
  tamkeenRevisionPagesDone: number;
  unclassifiedRevisionPagesDone: number;
}

const nonNegativeNumber = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;

export function summarizeDailyPageProgress(records: readonly DailyRecord[]): DailyPageProgress {
  return records.reduce<DailyPageProgress>((totals, record) => {
    if (record.status !== 'completed') return totals;

    const hasNewMemorizationConditions = record.newMemorizationWithConditions !== undefined
      ? Boolean(record.newMemorizationWithConditions)
      : (record.newMemorizationCompleted !== false && (
          Boolean(record.conditions?.masteryRepetition)
          || Boolean(record.conditions?.listenedToReader)
          || Boolean(record.conditions?.recitedLooking)
          || Boolean(record.criteriaRepeatCount && record.criteriaRepeatCount > 0)
          || (record.recitationScore !== undefined && record.recitationScore >= 8)
        ));

    const minorPages = nonNegativeNumber(record.minorRevisionPortion?.pagesCount);
    const tamkeenPages = nonNegativeNumber(record.tamkeenRevisionPortion?.pagesCount);
    const recordedRevisionPages = nonNegativeNumber(record.revisionPages);
    const revisionTotal = Math.max(recordedRevisionPages, minorPages + tamkeenPages);

    return {
      newMemorizationPagesDone: totals.newMemorizationPagesDone
        + (hasNewMemorizationConditions ? nonNegativeNumber(record.newMemorizationPages) : 0),
      revisionPagesDone: totals.revisionPagesDone + revisionTotal,
      minorRevisionPagesDone: totals.minorRevisionPagesDone + minorPages,
      tamkeenRevisionPagesDone: totals.tamkeenRevisionPagesDone + tamkeenPages,
      unclassifiedRevisionPagesDone: totals.unclassifiedRevisionPagesDone
        + Math.max(0, revisionTotal - minorPages - tamkeenPages)
    };
  }, {
    newMemorizationPagesDone: 0,
    revisionPagesDone: 0,
    minorRevisionPagesDone: 0,
    tamkeenRevisionPagesDone: 0,
    unclassifiedRevisionPagesDone: 0
  });
}

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

    const newPages = nonNegativeNumber(record.newMemorizationPages);
    const minorPages = nonNegativeNumber(
      record.minorRevisionPortion?.pagesCount ?? (record as any).minorPages
    );
    const tamkeenPages = nonNegativeNumber(
      record.tamkeenRevisionPortion?.pagesCount ?? (record as any).majorPages
    );
    const recordedRevisionPages = nonNegativeNumber(record.revisionPages);
    const revisionTotal = Math.max(recordedRevisionPages, minorPages + tamkeenPages);

    return {
      newMemorizationPagesDone: Math.round((totals.newMemorizationPagesDone + newPages) * 100) / 100,
      revisionPagesDone: Math.round((totals.revisionPagesDone + revisionTotal) * 100) / 100,
      minorRevisionPagesDone: Math.round((totals.minorRevisionPagesDone + minorPages) * 100) / 100,
      tamkeenRevisionPagesDone: Math.round((totals.tamkeenRevisionPagesDone + tamkeenPages) * 100) / 100,
      unclassifiedRevisionPagesDone: Math.round(
        (totals.unclassifiedRevisionPagesDone + Math.max(0, revisionTotal - minorPages - tamkeenPages)) * 100
      ) / 100
    };
  }, {
    newMemorizationPagesDone: 0,
    revisionPagesDone: 0,
    minorRevisionPagesDone: 0,
    tamkeenRevisionPagesDone: 0,
    unclassifiedRevisionPagesDone: 0
  });
}

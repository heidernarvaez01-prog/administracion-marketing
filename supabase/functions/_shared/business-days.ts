// Canonical business-day counting — pure TS, shared by the frontend
// (src/lib/business-days.ts re-exports this) and Edge Functions
// (alert-dispatch, weekly-report) so pacing math never drifts between them.
import { eachDayOfInterval, parseISO } from 'npm:date-fns@3.6.0';

export type LabDays = 'mon_fri' | 'mon_sat' | 'all';

function isBusinessDay(date: Date, labDays: LabDays): boolean {
  const day = date.getDay(); // 0=Sun, 6=Sat
  switch (labDays) {
    case 'mon_fri':
      return day >= 1 && day <= 5;
    case 'mon_sat':
      return day >= 1 && day <= 6;
    case 'all':
      return true;
  }
}

export function countBusinessDays(startDate: string, endDate: string, labDays: LabDays): number {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  if (start > end) return 0;
  const days = eachDayOfInterval({ start, end });
  return days.filter(d => isBusinessDay(d, labDays)).length;
}

export function countRemainingBusinessDays(today: Date, endDate: string, labDays: LabDays): number {
  const end = parseISO(endDate);
  if (today > end) return 0;
  const days = eachDayOfInterval({ start: today, end });
  return days.filter(d => isBusinessDay(d, labDays)).length;
}

export function countElapsedBusinessDays(startDate: string, today: Date, labDays: LabDays): number {
  const start = parseISO(startDate);
  if (today < start) return 0;
  const days = eachDayOfInterval({ start, end: today });
  return days.filter(d => isBusinessDay(d, labDays)).length;
}

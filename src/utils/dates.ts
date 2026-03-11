import { DashboardView } from '../types';

const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;

export function todayISOInBrt(): string {
  const now = new Date(Date.now() - BRT_OFFSET_MS);
  return now.toISOString().slice(0, 10);
}

export function isoDateFromDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function shiftISODate(isoDate: string, deltaDays: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return isoDateFromDate(date);
}

export function listIsoDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let current = startDate;

  while (current <= endDate) {
    dates.push(current);
    current = shiftISODate(current, 1);
  }

  return dates;
}

export function dashboardRange(view: DashboardView, anchorDate: string): {
  startDate: string;
  endDate: string;
  dayCount: number;
} {
  switch (view) {
    case 'week':
      return {
        startDate: shiftISODate(anchorDate, -6),
        endDate: anchorDate,
        dayCount: 7,
      };
    case 'month':
      return {
        startDate: shiftISODate(anchorDate, -29),
        endDate: anchorDate,
        dayCount: 30,
      };
    case 'day':
    default:
      return {
        startDate: anchorDate,
        endDate: anchorDate,
        dayCount: 1,
      };
  }
}

export function brDateLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

export function dashboardSubtitle(view: DashboardView, startDate: string, endDate: string): string {
  if (view === 'day') {
    return brDateLabel(endDate);
  }

  if (view === 'week') {
    return `${brDateLabel(startDate)} - ${brDateLabel(endDate)}`;
  }

  return `ULTIMOS 30 DIAS ATE ${brDateLabel(endDate)}`;
}

export function brtTimeLabel(loggedAt: string): string {
  const utc = new Date(`${loggedAt.replace(' ', 'T')}Z`);
  const brt = new Date(utc.getTime() - BRT_OFFSET_MS);
  return brt.toISOString().slice(11, 16);
}

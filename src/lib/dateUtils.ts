import { startOfWeek, endOfWeek, format, addDays, isWithinInterval } from "date-fns";

export function getWeekBounds(date: Date) {
  const start = startOfWeek(date, { weekStartsOn: 1 }); // Monday
  const end = endOfWeek(date, { weekStartsOn: 1 }); // Sunday
  return { start, end };
}

export function formatDateRange(start: Date, end: Date): string {
  return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
}

export function isWithinDateRange(
  date: Date,
  minDate: Date,
  maxDate: Date
): boolean {
  return isWithinInterval(date, { start: minDate, end: maxDate });
}

export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function canGoBackward(currentDate: Date, limitDays: number = 14): boolean {
  const minDate = addDays(new Date(), -limitDays);
  const { start } = getWeekBounds(addDays(currentDate, -7));
  return start >= minDate;
}

export function canGoForward(currentDate: Date, limitDays: number = 14): boolean {
  const maxDate = addDays(new Date(), limitDays);
  const { end } = getWeekBounds(addDays(currentDate, 7));
  return end <= maxDate;
}

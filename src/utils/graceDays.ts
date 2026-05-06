export function normalizeSelectedDays(selected: number[], limit: number): { selected: number[]; warning: string | null } {
  const uniqueSorted = Array.from(new Set(selected)).sort((a, b) => a - b);

  if (limit <= 0) {
    return { selected: [], warning: uniqueSorted.length > 0 ? 'La selección se limpió porque el límite es 0.' : null };
  }

  if (uniqueSorted.length <= limit) {
    return { selected: uniqueSorted, warning: null };
  }

  return {
    selected: uniqueSorted.slice(0, limit),
    warning: `La selección se ajustó a ${limit} día(s).`,
  };
}

export function toggleSelectedDayWithLimit(
  selected: number[],
  day: number,
  limit: number
): { selected: number[]; warning: string | null } {
  const normalized = normalizeSelectedDays(selected, limit).selected;

  if (normalized.includes(day)) {
    return { selected: normalized.filter((d) => d !== day), warning: null };
  }

  if (limit <= 0) {
    return { selected: normalized, warning: 'Configura primero los días de gracia (Globales).' };
  }

  if (normalized.length >= limit) {
    return { selected: normalized, warning: `Solo puedes seleccionar exactamente ${limit} día(s).` };
  }

  return { selected: [...normalized, day].sort((a, b) => a - b), warning: null };
}

export function validateExactSelection(selected: number[], limit: number): { ok: boolean; message: string | null } {
  if (limit <= 0) {
    return { ok: selected.length === 0, message: selected.length === 0 ? null : 'No se permiten selecciones cuando el límite es 0.' };
  }
  if (selected.length !== limit) {
    return { ok: false, message: `Debes seleccionar exactamente ${limit} día(s).` };
  }
  return { ok: true, message: null };
}

export type SundayGraceMode = 'COBRAR_TODOS' | 'NINGUNO' | 'ALTERNADO' | 'TODOS';

export const SUNDAY_GRACE_MODES: Array<{ value: SundayGraceMode; label: string }> = [
  { value: 'NINGUNO', label: 'Ningún domingo (no se cobra)' },
  { value: 'ALTERNADO', label: 'Alternado (se cobra 1 sí / 1 no)' },
];

const pad2 = (n: number) => String(n).padStart(2, '0');

export const dateToDateOnly = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export const dateOnlyToDate = (value: string) => {
  const s = value.includes('T') ? value.split('T')[0] : value;
  const [y, m, d] = s.split('-').map((p) => Number(p));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

export const isSunday = (year: number, monthIndex: number, dayOfMonth: number) =>
  new Date(year, monthIndex, dayOfMonth).getDay() === 0;

export const getSundaysInMonth = (year: number, monthIndex: number) => {
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const out: number[] = [];
  for (let d = 1; d <= daysInMonth; d += 1) {
    if (isSunday(year, monthIndex, d)) out.push(d);
  }
  return out;
};

export const getSundayGraceDaysInMonth = (year: number, monthIndex: number, mode: SundayGraceMode) => {
  const sundays = getSundaysInMonth(year, monthIndex);
  if (mode === 'COBRAR_TODOS') return [];
  if (mode === 'ALTERNADO') return sundays.filter((_, idx) => idx % 2 === 1);
  return sundays;
};

export const getEffectiveGraceDaysForMonth = (params: {
  year: number;
  monthIndex: number;
  recurringDays: number[];
  sundayMode: SundayGraceMode;
}) => {
  const { year, monthIndex, recurringDays, sundayMode } = params;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const manual = new Set<number>();
  for (const d of recurringDays || []) {
    const n = Number(d);
    if (Number.isFinite(n) && n >= 1 && n <= daysInMonth) manual.add(n);
  }

  const sundayGrace = new Set(getSundayGraceDaysInMonth(year, monthIndex, sundayMode));

  const effective = new Set<number>([...manual, ...sundayGrace]);
  return { effective, manual, sundayGrace };
};

export const addDays = (d: Date, days: number) => {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
};

export const advanceByChargeableDays = (params: {
  startExclusive: string;
  chargeableDays: number;
  recurringGraceDays: number[];
  sundayMode: SundayGraceMode;
}) => {
  const { startExclusive, chargeableDays, recurringGraceDays, sundayMode } = params;
  const start = dateOnlyToDate(startExclusive);
  if (!start || !Number.isFinite(chargeableDays) || chargeableDays <= 0) return startExclusive;
  let remaining = Math.floor(chargeableDays);
  let cursor = start;
  while (remaining > 0) {
    cursor = addDays(cursor, 1);
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const day = cursor.getDate();
    const { effective } = getEffectiveGraceDaysForMonth({ year: y, monthIndex: m, recurringDays: recurringGraceDays, sundayMode });
    if (effective.has(day)) continue;
    remaining -= 1;
  }
  return dateToDateOnly(cursor);
};

export const countChargeableDaysBetween = (params: {
  fromInclusive: string;
  toInclusive: string;
  recurringGraceDays: number[];
  sundayMode: SundayGraceMode;
}) => {
  const { fromInclusive, toInclusive, recurringGraceDays, sundayMode } = params;
  const from = dateOnlyToDate(fromInclusive);
  const to = dateOnlyToDate(toInclusive);
  if (!from || !to) return 0;
  if (from.getTime() > to.getTime()) return 0;

  let cursor = new Date(from);
  let count = 0;
  while (cursor.getTime() <= to.getTime()) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const day = cursor.getDate();
    const { effective } = getEffectiveGraceDaysForMonth({ year: y, monthIndex: m, recurringDays: recurringGraceDays, sundayMode });
    if (!effective.has(day)) count += 1;
    cursor = addDays(cursor, 1);
  }
  return count;
};

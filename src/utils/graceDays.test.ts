import { describe, expect, it } from 'vitest';
import {
  advanceByChargeableDays,
  countChargeableDaysBetween,
  getSundayGraceDaysInMonth,
  normalizeSelectedDays,
  toggleSelectedDayWithLimit,
  validateExactSelection,
} from './graceDays';

describe('graceDays', () => {
  it('restringe la selección a exactamente N días', () => {
    let selected: number[] = [];

    let r = toggleSelectedDayWithLimit(selected, 3, 2);
    selected = r.selected;
    expect(selected).toEqual([3]);
    expect(r.warning).toBeNull();

    r = toggleSelectedDayWithLimit(selected, 1, 2);
    selected = r.selected;
    expect(selected).toEqual([1, 3]);
    expect(r.warning).toBeNull();

    r = toggleSelectedDayWithLimit(selected, 2, 2);
    expect(r.selected).toEqual([1, 3]);
    expect(r.warning).toContain('exactamente 2');
  });

  it('permite deseleccionar aunque ya se haya alcanzado el límite', () => {
    const r = toggleSelectedDayWithLimit([1, 2], 2, 2);
    expect(r.selected).toEqual([1]);
    expect(r.warning).toBeNull();
  });

  it('ajusta la selección al reducir el límite', () => {
    const r = normalizeSelectedDays([5, 1, 3], 2);
    expect(r.selected).toEqual([1, 3]);
    expect(r.warning).toContain('ajustó');
  });

  it('valida selección exacta', () => {
    expect(validateExactSelection([], 0)).toEqual({ ok: true, message: null });
    expect(validateExactSelection([1], 2).ok).toBe(false);
    expect(validateExactSelection([1, 2], 2)).toEqual({ ok: true, message: null });
  });

  it('calcula domingos de gracia: NINGUNO (no se cobra ningún domingo)', () => {
    const sundays = getSundayGraceDaysInMonth(2026, 0, 'NINGUNO');
    expect(sundays.length).toBeGreaterThan(0);
    expect(sundays[0]).toBeGreaterThanOrEqual(1);
    expect(sundays[sundays.length - 1]).toBeLessThanOrEqual(31);
  });

  it('calcula domingos de gracia: ALTERNADO (se cobra 1 sí / 1 no)', () => {
    const all = getSundayGraceDaysInMonth(2026, 0, 'NINGUNO');
    const alt = getSundayGraceDaysInMonth(2026, 0, 'ALTERNADO');
    expect(alt.length).toBeGreaterThan(0);
    expect(alt.length).toBeLessThanOrEqual(all.length);
    expect(alt).toEqual(all.filter((_, idx) => idx % 2 === 1));
  });

  it('avance por días cobrables respeta domingos de gracia', () => {
    const end = advanceByChargeableDays({
      startExclusive: '2026-03-01',
      chargeableDays: 7,
      recurringGraceDays: [],
      sundayMode: 'NINGUNO',
    });
    expect(end).toBe('2026-03-09');
  });

  it('conteo de días cobrables excluye domingos de gracia', () => {
    const days = countChargeableDaysBetween({
      fromInclusive: '2026-03-02',
      toInclusive: '2026-03-08',
      recurringGraceDays: [],
      sundayMode: 'NINGUNO',
    });
    expect(days).toBe(6);
  });
});

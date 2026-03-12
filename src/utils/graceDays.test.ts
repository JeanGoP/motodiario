import { describe, expect, it } from 'vitest';
import { normalizeSelectedDays, toggleSelectedDayWithLimit, validateExactSelection } from './graceDays';

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
});

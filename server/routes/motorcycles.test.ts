import { describe, expect, it } from 'vitest';
import { preferRecurringDiasGracia } from './motorcycles.js';

describe('preferRecurringDiasGracia', () => {
  it('prefiere la configuración recurrente si existe', () => {
    expect(preferRecurringDiasGracia([1, 2], [10])).toEqual([1, 2]);
  });

  it('usa la configuración mensual si no hay recurrente', () => {
    expect(preferRecurringDiasGracia([], [10, 11])).toEqual([10, 11]);
    expect(preferRecurringDiasGracia(null, [10, 11])).toEqual([10, 11]);
  });
});

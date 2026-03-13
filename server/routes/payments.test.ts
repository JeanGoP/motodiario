import { describe, expect, it } from 'vitest';
import { validatePaymentPayload } from './payments.js';

describe('validatePaymentPayload', () => {
  it('rechaza payload incompleto', () => {
    expect(validatePaymentPayload({}).ok).toBe(false);
    expect(validatePaymentPayload({ amount: 10 }).ok).toBe(false);
  });

  it('rechaza monto inválido', () => {
    const res = validatePaymentPayload({
      motorcycle_id: '00000000-0000-0000-0000-000000000000',
      asociado_id: '00000000-0000-0000-0000-000000000000',
      amount: 0,
      payment_date: '2026-01-01',
      receipt_number: 'REC-1',
    });
    expect(res.ok).toBe(false);
  });

  it('rechaza fecha inválida', () => {
    const res = validatePaymentPayload({
      motorcycle_id: '00000000-0000-0000-0000-000000000000',
      asociado_id: '00000000-0000-0000-0000-000000000000',
      amount: 1000,
      payment_date: '01/01/2026',
      receipt_number: 'REC-1',
    });
    expect(res.ok).toBe(false);
  });

  it('valida cuota como entero positivo', () => {
    const res = validatePaymentPayload({
      motorcycle_id: '00000000-0000-0000-0000-000000000000',
      asociado_id: '00000000-0000-0000-0000-000000000000',
      amount: 1000,
      payment_date: '2026-01-01',
      receipt_number: 'REC-1',
      installment_number: 0,
    });
    expect(res.ok).toBe(false);
  });

  it('normaliza método de pago y lo valida', () => {
    const ok = validatePaymentPayload({
      motorcycle_id: '00000000-0000-0000-0000-000000000000',
      asociado_id: '00000000-0000-0000-0000-000000000000',
      amount: 1000,
      payment_date: '2026-01-01',
      receipt_number: 'REC-1',
      installment_number: 1,
      payment_method: 'efectivo',
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.data.payment_method).toBe('EFECTIVO');
    }

    const bad = validatePaymentPayload({
      motorcycle_id: '00000000-0000-0000-0000-000000000000',
      asociado_id: '00000000-0000-0000-0000-000000000000',
      amount: 1000,
      payment_date: '2026-01-01',
      receipt_number: 'REC-1',
      installment_number: 1,
      payment_method: 'CHEQUE',
    });
    expect(bad.ok).toBe(false);
  });
});

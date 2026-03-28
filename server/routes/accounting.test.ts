import { describe, expect, it } from 'vitest';
import { computeAsiento, validateReglaLineas } from './accounting.js';

describe('contabilidad reglas', () => {
  it('requiere líneas', () => {
    const res = validateReglaLineas([]);
    expect(res.ok).toBe(false);
  });

  it('valida que débito y crédito sumen 100%', () => {
    const base = [
      { cuenta_id: '11111111-1111-1111-1111-111111111111', movimiento: 'DEBITO', porcentaje: 100 },
      { cuenta_id: '22222222-2222-2222-2222-222222222222', movimiento: 'CREDITO', porcentaje: 60 },
      { cuenta_id: '33333333-3333-3333-3333-333333333333', movimiento: 'CREDITO', porcentaje: 40 }
    ];
    expect(validateReglaLineas(base).ok).toBe(true);
    const badDeb = validateReglaLineas([{ ...base[0], porcentaje: 90 }, ...base.slice(1)]);
    expect(badDeb.ok).toBe(false);
    const badCred = validateReglaLineas([base[0], { ...base[1], porcentaje: 50 }, base[2]]);
    expect(badCred.ok).toBe(false);
  });

  it('calcula asiento con partida doble (ejemplo 30.000)', () => {
    const lineas = [
      { cuenta_id: '11111111-1111-1111-1111-111111111111', movimiento: 'DEBITO', porcentaje: 100 },
      { cuenta_id: '22222222-2222-2222-2222-222222222222', movimiento: 'CREDITO', porcentaje: 20 },
      { cuenta_id: '33333333-3333-3333-3333-333333333333', movimiento: 'CREDITO', porcentaje: 20 },
      { cuenta_id: '44444444-4444-4444-4444-444444444444', movimiento: 'CREDITO', porcentaje: 60 }
    ];
    const res = computeAsiento({ monto: 30000, lineas });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const deb = res.data.filter((l) => l.movimiento === 'DEBITO').reduce((a, b) => a + b.valor, 0);
    const cred = res.data.filter((l) => l.movimiento === 'CREDITO').reduce((a, b) => a + b.valor, 0);
    expect(deb).toBe(30000);
    expect(cred).toBe(30000);
  });
});


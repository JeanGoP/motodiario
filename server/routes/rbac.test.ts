import { describe, expect, it } from 'vitest';
import { resolveEmpresaScope as resolveCostCentersEmpresaScope, canWrite as canWriteCostCenters, validateEmpresaIdBody as validateEmpresaIdBodyCostCenters } from './cost_centers.js';
import { resolveEmpresaScope as resolveAssociatesEmpresaScope, canWrite as canWriteAssociates, validateEmpresaIdBody as validateEmpresaIdBodyAssociates } from './associates.js';
import { resolveEmpresaScope as resolveMotorcyclesEmpresaScope, canWrite as canWriteMotorcycles, validateEmpresaIdBody as validateEmpresaIdBodyMotorcycles } from './motorcycles.js';

describe('RBAC (empresa y rol)', () => {
  const resolvers = [
    resolveCostCentersEmpresaScope,
    resolveAssociatesEmpresaScope,
    resolveMotorcyclesEmpresaScope,
  ];

  const canWrites = [
    canWriteCostCenters,
    canWriteAssociates,
    canWriteMotorcycles,
  ];

  const validateEmpresaIdBodies = [
    validateEmpresaIdBodyCostCenters,
    validateEmpresaIdBodyAssociates,
    validateEmpresaIdBodyMotorcycles,
  ];

  it('permite lectura cuando empresa del token coincide con la empresa del request', () => {
    for (const resolveEmpresaScope of resolvers) {
      expect(resolveEmpresaScope({ isSuperAdmin: false, tokenEmpresaId: 'A', requestEmpresaId: 'A', intent: 'read' })).toEqual({ ok: true, empresaId: 'A' });
    }
  });

  it('rechaza lectura cuando la empresa del request no coincide (403)', () => {
    for (const resolveEmpresaScope of resolvers) {
      expect(resolveEmpresaScope({ isSuperAdmin: false, tokenEmpresaId: 'A', requestEmpresaId: 'B', intent: 'read' })).toEqual({ ok: false, status: 403, error: 'No autorizado' });
    }
  });

  it('rechaza escritura cuando la empresa del request no coincide (400)', () => {
    for (const resolveEmpresaScope of resolvers) {
      expect(resolveEmpresaScope({ isSuperAdmin: false, tokenEmpresaId: 'A', requestEmpresaId: 'B', intent: 'write' })).toEqual({ ok: false, status: 400, error: 'No puedes operar fuera de tu empresa asignada' });
    }
  });

  it('super admin puede operar sobre cualquier empresa del request', () => {
    for (const resolveEmpresaScope of resolvers) {
      expect(resolveEmpresaScope({ isSuperAdmin: true, tokenEmpresaId: 'A', requestEmpresaId: 'B', intent: 'write' })).toEqual({ ok: true, empresaId: 'B' });
    }
  });

  it('solo admin puede escribir', () => {
    for (const canWrite of canWrites) {
      expect(canWrite({ rol: 'admin' })).toBe(true);
      expect(canWrite({ rol: 'ADMIN' })).toBe(true);
      expect(canWrite({ rol: 'user' })).toBe(false);
      expect(canWrite({ rol: null })).toBe(false);
    }
  });

  it('bloquea empresa_id en body cuando no coincide con la empresa de la sesión (400)', () => {
    for (const validateEmpresaIdBody of validateEmpresaIdBodies) {
      expect(validateEmpresaIdBody({ bodyEmpresaId: 'A', empresaId: 'A' })).toEqual({ ok: true });
      expect(validateEmpresaIdBody({ bodyEmpresaId: '', empresaId: 'A' })).toEqual({ ok: true });
      expect(validateEmpresaIdBody({ bodyEmpresaId: null, empresaId: 'A' })).toEqual({ ok: true });
      expect(validateEmpresaIdBody({ bodyEmpresaId: 'B', empresaId: 'A' })).toEqual({ ok: false, status: 400, error: 'empresa_id no coincide con la empresa de la sesión' });
    }
  });
});


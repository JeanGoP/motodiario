import { describe, expect, it } from 'vitest';
import { EMPRESA_SELECT_FIELDS, applyEmpresaErpInputs, validateEmpresaErpConfig } from './empresas.js';

describe('empresas ERP config', () => {
  it('cuando erp_sync es false, normaliza a null URL/Token', () => {
    const res = validateEmpresaErpConfig({ erp_sync: false, erp_api_url: 'https://x.com', erp_api_token: 'ABC-123' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toEqual({ erp_sync: false, erp_api_url: null, erp_api_token: null });
    }
  });

  it('requiere URL y Token cuando erp_sync es true', () => {
    const noUrl = validateEmpresaErpConfig({ erp_sync: true, erp_api_url: '', erp_api_token: 'ABC-123' });
    expect(noUrl.ok).toBe(false);

    const noToken = validateEmpresaErpConfig({ erp_sync: true, erp_api_url: 'https://erp.ejemplo.com/api', erp_api_token: '' });
    expect(noToken.ok).toBe(false);
  });

  it('valida URL http/https y longitud máxima', () => {
    const bad = validateEmpresaErpConfig({ erp_sync: true, erp_api_url: 'ftp://erp.ejemplo.com/api', erp_api_token: 'ABC-123' });
    expect(bad.ok).toBe(false);

    const tooLong = validateEmpresaErpConfig({ erp_sync: true, erp_api_url: `https://a.com/${'a'.repeat(600)}`, erp_api_token: 'ABC-123' });
    expect(tooLong.ok).toBe(false);
  });

  it('valida token (alfanuméricos y guiones) y longitud máxima', () => {
    const bad = validateEmpresaErpConfig({ erp_sync: true, erp_api_url: 'https://erp.ejemplo.com/api', erp_api_token: 'ABC 123' });
    expect(bad.ok).toBe(false);

    const tooLong = validateEmpresaErpConfig({ erp_sync: true, erp_api_url: 'https://erp.ejemplo.com/api', erp_api_token: 'A'.repeat(256) });
    expect(tooLong.ok).toBe(false);
  });

  it('aplica inputs de ERP al request', () => {
    const calls: Array<{ name: string; value: unknown }> = [];
    const request = {
      input: (name: string, _type: unknown, value: unknown) => {
        calls.push({ name, value });
        return request;
      }
    };

    const res = validateEmpresaErpConfig({ erp_sync: true, erp_api_url: 'https://erp.ejemplo.com/api', erp_api_token: 'ABC-123' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      applyEmpresaErpInputs(request as never, res.data);
    }

    expect(calls).toEqual([
      { name: 'erp_sync', value: true },
      { name: 'erp_api_url', value: 'https://erp.ejemplo.com/api' },
      { name: 'erp_api_token', value: 'ABC-123' },
    ]);
  });

  it('incluye campos ERP en el SELECT de empresas', () => {
    expect(EMPRESA_SELECT_FIELDS).toContain('erp_sync');
    expect(EMPRESA_SELECT_FIELDS).toContain('erp_api_url');
    expect(EMPRESA_SELECT_FIELDS).toContain('erp_api_token');
  });
});


import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type ContableCuenta, type ContableReglaActivaLinea, type Empresa } from '../lib/api';
import { Plus, Trash2, Save, RefreshCw } from 'lucide-react';

type LineaDraft = {
  cuenta_id: string;
  movimiento: 'DEBITO' | 'CREDITO';
  porcentaje: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

const TIPO_CUOTA_OPTIONS = [
  { value: 'CUOTA', label: 'CUOTA (Pago de motos)' },
  { value: 'ANTICIPO', label: 'ANTICIPO (Recibo de caja)' },
  { value: 'RECIBO', label: 'RECIBO (Recibo de caja)' }
] as const;

const computePreview = (monto: number, lineas: LineaDraft[]) => {
  const rows = lineas
    .filter((l) => l.cuenta_id && l.porcentaje > 0)
    .map((l) => ({ ...l, porcentaje: Number(l.porcentaje) }));

  let sumDeb = 0;
  let sumCred = 0;
  for (const l of rows) {
    if (l.movimiento === 'DEBITO') sumDeb += l.porcentaje;
    else sumCred += l.porcentaje;
  }
  const debOk = round4(sumDeb) === 100;
  const credOk = round4(sumCred) === 100;

  const computed = rows.map((l) => ({ ...l, valor: round2((monto * l.porcentaje) / 100) }));
  const deb = round2(computed.filter((l) => l.movimiento === 'DEBITO').reduce((a, b) => a + b.valor, 0));
  const cred = round2(computed.filter((l) => l.movimiento === 'CREDITO').reduce((a, b) => a + b.valor, 0));
  const diff = round2(deb - cred);
  if (diff !== 0) {
    const target = diff > 0 ? 'CREDITO' : 'DEBITO';
    const idx = computed.findIndex((l) => l.movimiento === target);
    if (idx >= 0) computed[idx] = { ...computed[idx], valor: round2(computed[idx].valor + Math.abs(diff)) };
  }

  const deb2 = round2(computed.filter((l) => l.movimiento === 'DEBITO').reduce((a, b) => a + b.valor, 0));
  const cred2 = round2(computed.filter((l) => l.movimiento === 'CREDITO').reduce((a, b) => a + b.valor, 0));

  return {
    debOk,
    credOk,
    debSumPct: round4(sumDeb),
    credSumPct: round4(sumCred),
    debTotal: deb2,
    credTotal: cred2,
    computed
  };
};

export function AccountingConfig() {
  const [tab, setTab] = useState<'cuentas' | 'reglas'>('reglas');
  const [loading, setLoading] = useState(true);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [cuentas, setCuentas] = useState<ContableCuenta[]>([]);
  const [tipoCuota, setTipoCuota] = useState('CUOTA');
  const [comentario, setComentario] = useState('');
  const [lineas, setLineas] = useState<LineaDraft[]>([]);
  const [montoPreview, setMontoPreview] = useState<number>(30000);

  const [showCuentaModal, setShowCuentaModal] = useState(false);
  const [cuentaForm, setCuentaForm] = useState<{ id?: string; codigo: string; nombre: string; activo: boolean }>({ codigo: '', nombre: '', activo: true });

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [miEmpresa, cuentasData, regla] = await Promise.all([
        api.getMiEmpresa(),
        api.getContableCuentas(),
        api.getContableReglaActiva({ tipo_cuota: tipoCuota })
      ]);
      setEmpresa(miEmpresa);
      setCuentas(cuentasData || []);
      if (regla) {
        setComentario(regla.comentario || '');
        setLineas((regla.lineas || []).map((l) => ({ cuenta_id: l.cuenta_id, movimiento: l.movimiento, porcentaje: Number(l.porcentaje) })));
      } else {
        setComentario('');
        setLineas([]);
      }
    } catch (error: unknown) {
      alert('Error: ' + (error instanceof Error ? error.message : 'Ha ocurrido un error'));
    } finally {
      setLoading(false);
    }
  }, [tipoCuota]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const cuentasById = useMemo(() => Object.fromEntries(cuentas.map((c) => [c.id, c])), [cuentas]);

  const preview = useMemo(() => computePreview(Number(montoPreview) || 0, lineas), [montoPreview, lineas]);

  const addLinea = (movimiento: 'DEBITO' | 'CREDITO') => {
    const firstCuenta = cuentas.find((c) => c.activo)?.id || '';
    setLineas((prev) => [...prev, { cuenta_id: firstCuenta, movimiento, porcentaje: 0 }]);
  };

  const removeLinea = (idx: number) => setLineas((prev) => prev.filter((_, i) => i !== idx));

  const updateLinea = (idx: number, patch: Partial<LineaDraft>) => {
    setLineas((prev) => prev.map((l, i) => i === idx ? ({ ...l, ...patch }) : l));
  };

  const openCuentaCreate = () => {
    setCuentaForm({ codigo: '', nombre: '', activo: true });
    setShowCuentaModal(true);
  };

  const openCuentaEdit = (c: ContableCuenta) => {
    setCuentaForm({ id: c.id, codigo: c.codigo, nombre: c.nombre, activo: c.activo });
    setShowCuentaModal(true);
  };

  const saveCuenta = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { codigo: cuentaForm.codigo.trim(), nombre: cuentaForm.nombre.trim(), activo: !!cuentaForm.activo };
      if (cuentaForm.id) await api.updateContableCuenta(cuentaForm.id, payload);
      else await api.createContableCuenta(payload);
      setShowCuentaModal(false);
      await loadAll();
    } catch (error: unknown) {
      alert('Error: ' + (error instanceof Error ? error.message : 'Ha ocurrido un error'));
    }
  };

  const deleteCuenta = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar esta cuenta contable?')) return;
    try {
      await api.deleteContableCuenta(id);
      await loadAll();
    } catch (error: unknown) {
      alert('Error: ' + (error instanceof Error ? error.message : 'Ha ocurrido un error'));
    }
  };

  const saveRegla = async () => {
    try {
      if (!tipoCuota.trim()) throw new Error('Falta tipo de cuota');
      if (lineas.length === 0) throw new Error('Agrega al menos una línea');
      if (!preview.debOk) throw new Error('Los porcentajes de DÉBITO deben sumar 100%');
      if (!preview.credOk) throw new Error('Los porcentajes de CRÉDITO deben sumar 100%');
      if (preview.debTotal !== preview.credTotal) throw new Error('Partida doble inválida (débito != crédito)');
      const payload = {
        tipo_cuota: tipoCuota.trim().toUpperCase(),
        comentario: comentario.trim() ? comentario.trim() : null,
        lineas: lineas.map((l) => ({ cuenta_id: l.cuenta_id, movimiento: l.movimiento, porcentaje: Number(l.porcentaje) }))
      };
      await api.createContableRegla(payload);
      await loadAll();
      alert('Configuración contable guardada (nueva versión)');
    } catch (error: unknown) {
      alert('Error: ' + (error instanceof Error ? error.message : 'Ha ocurrido un error'));
    }
  };

  const cuentaLabel = (l: ContableReglaActivaLinea | LineaDraft) => {
    const c = cuentasById[l.cuenta_id];
    if (!c) return 'Cuenta';
    return `${c.codigo} - ${c.nombre}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-700"></div>
      </div>
    );
  }

  const empresaId = (() => {
    try {
      return window.localStorage.getItem('empresa_id') || '';
    } catch {
      return '';
    }
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Configuración Contable</h2>
          <p className="text-slate-500 mt-1">
            {empresa ? `Empresa: ${empresa.nombre} (${empresa.codigo})` : (empresaId ? `Empresa ID: ${empresaId}` : 'Empresa: (no seleccionada)')}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => loadAll()} className="btn btn-secondary whitespace-nowrap">
            <RefreshCw className="w-4 h-4 mr-2" />
            Recargar
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => setTab('reglas')}
            className={`px-5 py-3 text-sm font-semibold ${tab === 'reglas' ? 'text-slate-900 border-b-2 border-accent-600' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Reglas
          </button>
          <button
            type="button"
            onClick={() => setTab('cuentas')}
            className={`px-5 py-3 text-sm font-semibold ${tab === 'cuentas' ? 'text-slate-900 border-b-2 border-accent-600' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Cuentas
          </button>
        </div>

        {tab === 'cuentas' && (
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div className="text-sm text-slate-600">Administra el catálogo de cuentas contables de la empresa.</div>
              <button onClick={openCuentaCreate} className="btn btn-primary whitespace-nowrap">
                <Plus className="w-4 h-4 mr-2" />
                Nueva Cuenta
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-4 py-2">Código</th>
                    <th className="text-left px-4 py-2">Nombre</th>
                    <th className="text-left px-4 py-2">Estado</th>
                    <th className="text-right px-4 py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cuentas.map((c) => (
                    <tr key={c.id} className="border-t border-slate-100">
                      <td className="px-4 py-2 font-mono">{c.codigo}</td>
                      <td className="px-4 py-2">{c.nombre}</td>
                      <td className="px-4 py-2">
                        <span className={`badge ${c.activo ? 'badge-success' : 'badge-slate'}`}>{c.activo ? 'Activa' : 'Inactiva'}</span>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => openCuentaEdit(c)} className="btn btn-secondary">Editar</button>
                          <button onClick={() => deleteCuenta(c.id)} className="btn btn-ghost text-red-600 hover:bg-red-50 hover:text-red-700 px-3">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {cuentas.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">No hay cuentas configuradas</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'reglas' && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">Tipo de cuota</label>
                    <select className="input-field font-mono" value={tipoCuota} onChange={(e) => setTipoCuota(e.target.value)}>
                      {TIPO_CUOTA_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="input-label">Monto de ejemplo</label>
                    <input className="input-field font-mono" type="number" value={montoPreview} onChange={(e) => setMontoPreview(Number(e.target.value))} min={0} step={1} />
                  </div>
                </div>

                <div>
                  <label className="input-label">Comentario (opcional)</label>
                  <input className="input-field" value={comentario} onChange={(e) => setComentario(e.target.value)} />
                </div>

                <div className="flex gap-2">
                  <button onClick={() => addLinea('DEBITO')} className="btn btn-secondary whitespace-nowrap">
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar débito
                  </button>
                  <button onClick={() => addLinea('CREDITO')} className="btn btn-secondary whitespace-nowrap">
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar crédito
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="text-left px-4 py-2">Movimiento</th>
                        <th className="text-left px-4 py-2">Cuenta</th>
                        <th className="text-right px-4 py-2">%</th>
                        <th className="text-right px-4 py-2">Valor</th>
                        <th className="text-right px-4 py-2">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineas.map((l, idx) => {
                        const computed = preview.computed[idx];
                        return (
                          <tr key={idx} className="border-t border-slate-100">
                            <td className="px-4 py-2">
                              <select
                                className="input-field"
                                value={l.movimiento}
                                onChange={(e) => updateLinea(idx, { movimiento: e.target.value === 'CREDITO' ? 'CREDITO' : 'DEBITO' })}
                              >
                                <option value="DEBITO">DÉBITO</option>
                                <option value="CREDITO">CRÉDITO</option>
                              </select>
                            </td>
                            <td className="px-4 py-2">
                              <select
                                className="input-field"
                                value={l.cuenta_id}
                                onChange={(e) => updateLinea(idx, { cuenta_id: e.target.value })}
                              >
                                <option value="">{cuentaLabel(l)}</option>
                                {cuentas.map((c) => (
                                  <option key={c.id} value={c.id} disabled={!c.activo}>
                                    {c.codigo} - {c.nombre}{c.activo ? '' : ' (inactiva)'}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-2 text-right">
                              <input
                                className="input-field font-mono text-right"
                                type="number"
                                value={l.porcentaje}
                                onChange={(e) => updateLinea(idx, { porcentaje: Number(e.target.value) })}
                                min={0}
                                step={0.01}
                              />
                            </td>
                            <td className="px-4 py-2 text-right font-mono">{computed ? computed.valor.toLocaleString('es-CO') : '-'}</td>
                            <td className="px-4 py-2 text-right">
                              <button onClick={() => removeLinea(idx)} className="btn btn-ghost text-red-600 hover:bg-red-50 hover:text-red-700 px-3">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {lineas.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-500">Agrega líneas para definir la regla</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-4">
                <div className="card p-5 border border-slate-200">
                  <div className="text-sm font-bold text-slate-900 mb-3">Validaciones</div>
                  <div className="text-sm text-slate-700 space-y-2">
                    <div className="flex justify-between">
                      <span>DÉBITO (%)</span>
                      <span className={`font-mono ${preview.debOk ? 'text-green-700' : 'text-red-700'}`}>{preview.debSumPct}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>CRÉDITO (%)</span>
                      <span className={`font-mono ${preview.credOk ? 'text-green-700' : 'text-red-700'}`}>{preview.credSumPct}</span>
                    </div>
                    <div className="h-px bg-slate-200 my-2"></div>
                    <div className="flex justify-between">
                      <span>Total débitos</span>
                      <span className={`font-mono ${preview.debTotal === preview.credTotal ? 'text-slate-900' : 'text-red-700'}`}>{preview.debTotal.toLocaleString('es-CO')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total créditos</span>
                      <span className={`font-mono ${preview.debTotal === preview.credTotal ? 'text-slate-900' : 'text-red-700'}`}>{preview.credTotal.toLocaleString('es-CO')}</span>
                    </div>
                  </div>
                </div>

                <button onClick={saveRegla} className="btn btn-primary w-full justify-center">
                  <Save className="w-4 h-4 mr-2" />
                  Guardar configuración contable
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showCuentaModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-900">{cuentaForm.id ? 'Editar Cuenta' : 'Nueva Cuenta'}</h3>
              <button onClick={() => setShowCuentaModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors rounded-md">×</button>
            </div>
            <form onSubmit={saveCuenta} className="p-6 space-y-4">
              <div>
                <label className="input-label">Código</label>
                <input className="input-field font-mono" value={cuentaForm.codigo} onChange={(e) => setCuentaForm((p) => ({ ...p, codigo: e.target.value }))} required />
              </div>
              <div>
                <label className="input-label">Nombre</label>
                <input className="input-field" value={cuentaForm.nombre} onChange={(e) => setCuentaForm((p) => ({ ...p, nombre: e.target.value }))} required />
              </div>
              <div className="flex items-center gap-2">
                <input id="cuenta_activo" type="checkbox" checked={cuentaForm.activo} onChange={(e) => setCuentaForm((p) => ({ ...p, activo: e.target.checked }))} />
                <label htmlFor="cuenta_activo" className="text-sm text-slate-700">Activa</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCuentaModal(false)} className="btn btn-secondary flex-1 justify-center">Cancelar</button>
                <button type="submit" className="btn btn-primary flex-1 justify-center">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

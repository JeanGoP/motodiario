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

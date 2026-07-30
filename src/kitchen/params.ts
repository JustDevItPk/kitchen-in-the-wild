/** Kitchen-local render params (subset used by lighting / water / contacts). */

export interface KitchenParams {
  timeOfDay: number;
  /** comma-separated ablation flags: ao,gi,water,bloom,contact */
  ablate: Set<string>;
}

export function ablated(params: KitchenParams, flag: string): boolean {
  return params.ablate.has(flag);
}

/** Build kitchen params from LAAS URL + optional default ablations. */
export function kitchenParamsFromUrl(
  timeOfDay: number,
  search: string = window.location.search,
  defaultAblate: string[] = [],
): KitchenParams {
  const q = new URLSearchParams(search);
  const raw = q.get('ablate') ?? '';
  const ablate = new Set([
    ...defaultAblate,
    ...raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  ]);
  return { timeOfDay, ablate };
}

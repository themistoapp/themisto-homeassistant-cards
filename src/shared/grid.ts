import type { Layout } from "../types";

// HA sections view: 56px rows with 8px gaps.
export const ROW = 56;
export const GAP = 8;
export const rowsToPx = (rows: number) => rows * ROW + (rows - 1) * GAP;
export const pxToRows = (px: number) => Math.max(1, Math.ceil((px + GAP) / (ROW + GAP)));

export interface GridOptions { columns?: number | "full"; rows?: number | "auto"; min_columns?: number; min_rows?: number; max_rows?: number }
export type Concrete = Exclude<Layout, "auto" | "wide" | "tall">;
export type Presets = Partial<Record<Concrete, GridOptions>>;

/**
 * Picks the concrete layout for "auto" from the card's measured height. A card resized to
 * N rows lands on the largest preset whose row count fits. Presets designed for a full-width
 * card (9+ columns) are skipped when the card is narrower than WIDE_PX, so a tall 6-column card
 * gets the stacked layout rather than a squeezed wide one.
 */
export const WIDE_PX = 440;
export function layoutForHeight(presets: Presets, height: number, width = Infinity): Concrete {
  const order: Concrete[] = ["large", "standard", "compact"];
  for (const l of order) {
    const p = presets[l];
    const wide = typeof p?.columns === "number" && p.columns >= 9;
    if (wide && width < WIDE_PX) continue;
    if (p && typeof p.rows === "number" && height >= rowsToPx(p.rows) - 2) return l;
  }
  return presets.compact ? "compact" : "standard";
}

/**
 * Resolves the "wide" and "tall" aliases to the card's own size of that shape: wide is the size
 * that spans 9+ columns, tall the tallest narrow size. Anything else passes through.
 */
export function resolveLayout(presets: Presets, layout: Layout | undefined): Layout | undefined {
  if (layout !== "wide" && layout !== "tall") return layout;
  const entries = (Object.entries(presets) as [Concrete, GridOptions][]).filter(([, p]) => typeof p.columns === "number");
  const pick = layout === "wide"
    ? entries.find(([, p]) => (p.columns as number) >= 9)
    : entries.filter(([, p]) => (p.columns as number) < 9 && typeof p.rows === "number").sort((a, b) => (b[1].rows as number) - (a[1].rows as number))[0];
  return pick ? pick[0] : "auto";
}

export function gridOptionsFor(presets: Presets, layout: Layout | undefined): GridOptions {
  const r = resolveLayout(presets, layout);
  const l: Concrete = !r || r === "auto" || r === "wide" || r === "tall" ? "standard" : r;
  const p = presets[l] || presets.standard || {};
  const min = presets.compact || p;
  return { ...p, min_rows: typeof min.rows === "number" ? min.rows : p.min_rows, min_columns: min.min_columns ?? 3 };
}

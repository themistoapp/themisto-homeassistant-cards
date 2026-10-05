import type { HassEntity, HomeAssistant } from "../types";

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const domainOf = (entityId?: string) => (entityId || "").split(".")[0];

export const isUnavailable = (s?: HassEntity) => !s || s.state === "unavailable" || s.state === "unknown";

export const num = (v: unknown, fallback = NaN) => {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
};

export const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Friendly name with the device/room prefix trimmed where HA already shows it elsewhere. */
export const friendlyName = (s?: HassEntity, fallback = "") => s?.attributes?.friendly_name || fallback || s?.entity_id || "";

/**
 * Text override rule shared by every card:
 * undefined or "" → default, whitespace only → hidden (""), anything else → the override.
 */
export function text(override: string | undefined, fallback: string): string {
  if (override === undefined || override === null || override === "") return fallback;
  if (override.trim() === "") return "";
  return override;
}

// Same names HA's ui_color selector produces; anything else is treated as a literal CSS colour.
const THEME_COLOURS = new Set([
  "primary", "accent", "disabled", "red", "pink", "purple", "deep-purple", "indigo", "blue", "light-blue", "cyan",
  "teal", "green", "light-green", "lime", "yellow", "amber", "orange", "deep-orange", "brown", "light-grey", "grey",
  "dark-grey", "blue-grey", "black", "white",
]);

export function cssColour(value: string | undefined, fallback: string): string {
  if (!value || value === "default" || value === "none") return fallback;
  if (THEME_COLOURS.has(value)) return `var(--${value}-color)`;
  return value;
}

export function locale(hass?: HomeAssistant) {
  return hass?.locale?.language || hass?.language || "en-GB";
}

export function fmtNumber(hass: HomeAssistant | undefined, value: number, decimals?: number) {
  return value.toLocaleString(locale(hass), decimals === undefined ? { maximumFractionDigits: 2 } : { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** "4 min ago" style relative time, short enough for a chip. */
export function relativeTime(iso: string | undefined, now = Date.now()): string {
  if (!iso) return "";
  const s = Math.max(0, (now - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

export function fireEvent(node: EventTarget, type: string, detail?: unknown) {
  node.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
}

/** Values that may be a single entity id or a list (summed slots). */
export const asList = (v?: string | string[]) => (Array.isArray(v) ? v.filter(Boolean) : v ? [v] : []);

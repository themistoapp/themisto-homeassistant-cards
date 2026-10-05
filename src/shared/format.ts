import type { HassEntity, HomeAssistant } from "../types";
import { fmtNumber, isUnavailable, locale, num } from "./util";

export interface Measurement { value: string; unit: string; raw: number }

/** Power sensors get W ↔ kW scaling so a figure never needs more than 4 digits. */
export function formatPower(hass: HomeAssistant | undefined, watts: number): { value: string; unit: string } {
  const a = Math.abs(watts);
  if (a < 1000) return { value: fmtNumber(hass, Math.round(watts), 0), unit: "W" };
  // 3.42 kW, 7.2 kW (no trailing zero), 12.3 kW
  const kw = watts / 1000;
  const d = a >= 10000 || Math.round(Math.abs(kw) * 100) % 10 === 0 ? 1 : 2;
  return { value: fmtNumber(hass, kw, d), unit: "kW" };
}

/** Network throughput in Mb/s → kb/s, Mb/s or Gb/s. */
export function formatRate(hass: HomeAssistant | undefined, mbps: number): { value: string; unit: string } {
  if (mbps < 1) return { value: fmtNumber(hass, Math.round(mbps * 1000), 0), unit: "kb/s" };
  if (mbps < 1000) return { value: fmtNumber(hass, Math.round(mbps), 0), unit: "Mb/s" };
  return { value: fmtNumber(hass, mbps / 1000, 2), unit: "Gb/s" };
}

const RATE_TO_MBPS: Record<string, number> = {
  "bit/s": 1e-6, "kbit/s": 1e-3, "mbit/s": 1, "gbit/s": 1e3,
  "b/s": 8e-6, "kb/s": 8e-3, "mb/s": 8, "gb/s": 8e3,
  "kib/s": 8.192e-3, "mib/s": 8.389, "bps": 1e-6, "kbps": 1e-3, "mbps": 1,
};
/** Converts any throughput unit HA integrations use into Mb/s (bits). */
export function toMbps(value: number, unit = "Mbit/s"): number {
  const k = RATE_TO_MBPS[unit.trim().toLowerCase()];
  return k === undefined ? value : value * k;
}

export interface MeasureOptions { unit?: string; decimals?: number; scale_power?: boolean; attribute?: string }

/** Formats a sensor (or one attribute of it) honouring the card's unit/decimals overrides. */
export function measure(hass: HomeAssistant | undefined, s: HassEntity | undefined, o: MeasureOptions = {}): Measurement {
  if (!s || (!o.attribute && isUnavailable(s))) return { value: "–", unit: "", raw: NaN };
  const rawValue = o.attribute ? s.attributes[o.attribute] : s.state;
  const raw = num(rawValue);
  const nativeUnit = o.attribute ? "" : s.attributes.unit_of_measurement || "";
  if (!Number.isFinite(raw)) {
    const value = !o.attribute && hass?.formatEntityState ? hass.formatEntityState(s) : String(rawValue ?? "–");
    return { value, unit: "", raw };
  }
  const unitLower = String(nativeUnit).toLowerCase();
  if (o.scale_power !== false && !o.unit && (unitLower === "w" || unitLower === "kw")) {
    const p = formatPower(hass, unitLower === "kw" ? raw * 1000 : raw);
    return { ...p, raw };
  }
  const decimals = o.decimals ?? s.attributes.suggested_display_precision ?? (Number.isInteger(raw) ? 0 : 1);
  const unit = o.unit ?? nativeUnit;
  // Currency symbols go in front: £3.84, not 3.84 £.
  if (/^[£$€¥]$/.test(unit)) return { value: `${unit}${fmtNumber(hass, raw, o.decimals ?? 2)}`, unit: "", raw };
  // ISO codes (GBP, EUR) from monetary sensors: let the locale draw the symbol, e.g. £3.72.
  if (/^[A-Z]{3}$/.test(unit) && (s.attributes.device_class === "monetary" || CURRENCIES.has(unit))) {
    try {
      const d = o.decimals ?? 2;
      return { value: raw.toLocaleString(locale(hass), { style: "currency", currency: unit, minimumFractionDigits: d, maximumFractionDigits: d }), unit: "", raw };
    } catch { /* unknown code: fall through to "3.72 XYZ" */ }
  }
  return { value: fmtNumber(hass, raw, decimals), unit, raw };
}

const CURRENCIES = new Set(["GBP", "EUR", "USD", "AUD", "CAD", "NZD", "CHF", "SEK", "NOK", "DKK", "JPY"]);

/** HA's translated state ("Heating", "Locked") with a plain fallback. */
export function stateText(hass: HomeAssistant | undefined, s?: HassEntity): string {
  if (!s) return "";
  if (hass?.formatEntityState) return hass.formatEntityState(s);
  const u = s.attributes.unit_of_measurement;
  return `${s.state}${u ? ` ${u}` : ""}`;
}

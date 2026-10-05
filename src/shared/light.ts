import { html, nothing } from "lit";
import type { HassEntity } from "../types";
import { cssColour, num } from "./util";

export interface TempPreset { kelvin: number; name?: string }
export interface ColourPreset { color: string; name?: string }

const COLOUR_MODES = ["hs", "rgb", "rgbw", "rgbww", "xy"];

export function caps(s?: HassEntity) {
  const modes: string[] = s?.attributes.supported_color_modes || [];
  return {
    dimmable: modes.some((m) => m !== "onoff"),
    temperature: modes.includes("color_temp"),
    colour: modes.some((m) => COLOUR_MODES.includes(m)),
    minK: num(s?.attributes.min_color_temp_kelvin, 2000),
    maxK: num(s?.attributes.max_color_temp_kelvin, 6500),
  };
}

export const brightnessPct = (s?: HassEntity) => (s?.state === "on" ? Math.max(1, Math.round((num(s.attributes.brightness, 255) / 255) * 100)) : 0);

/** Default temperature presets: common white points inside the light's range, at most 4. */
export function defaultTemps(minK: number, maxK: number): TempPreset[] {
  const pts = [2200, 2700, 3000, 4000, 5000, 6500].filter((k) => k >= minK - 50 && k <= maxK + 50);
  if (pts.length <= 4) return pts.map((kelvin) => ({ kelvin }));
  return [pts[0], pts[1], pts[Math.floor(pts.length / 2) + 1], pts[pts.length - 1]].map((kelvin) => ({ kelvin }));
}

/** Kelvin → approximate display colour (Tanner Helland's fit), for the preset dots. */
export function kelvinToCss(k: number): string {
  const t = k / 100;
  const r = t <= 66 ? 255 : 329.7 * Math.pow(t - 60, -0.1332);
  const g = t <= 66 ? 99.47 * Math.log(t) - 161.12 : 288.12 * Math.pow(t - 60, -0.0755);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
  const c = (v: number) => Math.round(Math.min(255, Math.max(0, v)));
  return `rgb(${c(r)}, ${c(g)}, ${c(b)})`;
}

export function describeLight(s: HassEntity): string {
  if (s.state !== "on") return "Off";
  const mode = s.attributes.color_mode;
  if (mode === "color_temp" && s.attributes.color_temp_kelvin) {
    const k = num(s.attributes.color_temp_kelvin);
    return `${Math.round(k / 10) * 10} K · ${k <= 2900 ? "Warm white" : k >= 5000 ? "Cool white" : "Neutral"}`;
  }
  if (COLOUR_MODES.includes(mode)) return "Colour";
  return "On";
}

/** Resolves a ui_color value (theme name or CSS colour) to [r,g,b] via the element's computed style. */
export function resolveRgb(el: Element, value: string): [number, number, number] | undefined {
  const probe = document.createElement("span");
  probe.style.color = cssColour(value, value);
  probe.style.display = "none";
  el.shadowRoot?.appendChild(probe) ?? el.appendChild(probe);
  const m = getComputedStyle(probe).color.match(/\d+(\.\d+)?/g);
  probe.remove();
  return m && m.length >= 3 ? [Math.round(+m[0]), Math.round(+m[1]), Math.round(+m[2])] : undefined;
}

/** Row of colour-temperature and colour preset dots. Selected = matches the light's current state. */
export function presetDots(s: HassEntity, temps: TempPreset[], colours: ColourPreset[], onTemp: (k: number) => void, onColour: (c: string) => void) {
  if (!temps.length && !colours.length) return nothing;
  const on = s.state === "on";
  const curK = s.attributes.color_mode === "color_temp" ? num(s.attributes.color_temp_kelvin) : NaN;
  return html`<div class="dots">
    ${temps.map((p) => html`<button style="background:${kelvinToCss(p.kelvin)}" title=${p.name || `${p.kelvin} K`} aria-label=${p.name || `${p.kelvin} kelvin`}
      aria-pressed=${on && Math.abs(curK - p.kelvin) < 120} @click=${() => onTemp(p.kelvin)}></button>`)}
    ${temps.length && colours.length ? html`<i class="gap"></i>` : nothing}
    ${colours.map((p) => html`<button style="background:${cssColour(p.color, p.color)}" title=${p.name || p.color} aria-label=${p.name || p.color} @click=${() => onColour(p.color)}></button>`)}
  </div>`;
}

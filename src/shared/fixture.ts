import { css, html, nothing } from "lit";
import { FIXTURES } from "../cards/light-fixtures";
import type { HassEntity } from "../types";
import { brightnessPct, caps, kelvinToCss } from "./light";
import { choose, type Schema } from "./editor";

export type LightType = "none" | "pendant" | "downlight" | "strip" | "pole";

export const lightTypeField = (name = "light_type"): Schema => choose(name, [["none", "None (icon only)"], ["pendant", "Black pendant"], ["downlight", "White downlight"], ["strip", "Light strip (shelf)"], ["pole", "Light bar (vertical)"]]);

// Width ÷ height of each fitting's drawing.
const RATIO: Record<Exclude<LightType, "none">, number> = { pendant: FIXTURES.pendant.ratio, downlight: FIXTURES.downlight.ratio, strip: 1.25, pole: 0.5 };

// Plain white bulbs report no colour; show them as warm white rather than the card's accent.
const WARM_WHITE = "#ffe3bd";

/** The colour the light is actually giving out, for the glow. */
function glowColour(s: HassEntity, fallback?: string) {
  const rgb = s.attributes.rgb_color;
  if (Array.isArray(rgb) && rgb.length >= 3) return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  if (s.attributes.color_temp_kelvin) return kelvinToCss(Number(s.attributes.color_temp_kelvin));
  return fallback || WARM_WHITE;
}

export const hasFixture = (type?: string): type is Exclude<LightType, "none"> => !!type && type in RATIO;

/**
 * Picture of the fitting with its opening lit in the light's colour, brighter with brightness.
 * Fits inside a w × h px box (keeping its shape), so the same drawing works as a hero or a row icon.
 * `colour` is the user's "colour when on", used only when the light reports no colour of its own.
 */
export function fixture(type: string | undefined, s: HassEntity | undefined, box: { w: number; h: number }, colour?: string) {
  if (!hasFixture(type) || !s) return nothing;
  const on = s.state === "on";
  const i = on ? (caps(s).dimmable ? 0.4 + 0.6 * (brightnessPct(s) / 100) : 1) : 0;
  const r = RATIO[type], h = Math.min(box.h, box.w / r);
  const style = `--glow:${glowColour(s, colour)};--i:${i.toFixed(2)};--fxh:${h.toFixed(1)}px;--r:${r.toFixed(3)}`;
  if (type === "strip" || type === "pole") return html`<div class="fx ${type} ${on ? "on" : ""}" style=${style}><i></i></div>`;
  const f = FIXTURES[type], b = f.bulb;
  return html`<div class="fx ${type}" style=${style}><img src=${f.src} alt="">
    <i class="bulb" style="left:${b.x}%;top:${b.y}%;width:${b.w}%;height:${b.h}%"></i></div>`;
}

/** Glow sizes scale with the drawing (--fxh) so it reads the same at 30px or 84px. */
export const fixtureStyles = css`
  .fx { --u: calc(var(--fxh, 84px) / 84); position: relative; flex: none; height: var(--fxh, 84px); width: calc(var(--fxh, 84px) * var(--r, 1)); pointer-events: none; }
  .fx img { display: block; width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 calc(6 * var(--u)) calc(10 * var(--u)) rgba(0,0,0,.25)); }
  .fx .bulb { position: absolute; transform: translate(-50%, -50%); border-radius: 50%; opacity: var(--i, 0); transition: opacity .3s, background .3s, box-shadow .3s;
    background: radial-gradient(closest-side, color-mix(in srgb, var(--glow) 30%, white) 0%, var(--glow) 62%, color-mix(in srgb, var(--glow) 55%, transparent) 100%);
    box-shadow: 0 0 calc(5 * var(--u)) calc(1 * var(--u)) var(--glow), 0 0 calc(16 * var(--u)) calc(4 * var(--u)) color-mix(in srgb, var(--glow) 50%, transparent); }
  /* Pendant: light falls out of the bottom. */
  .fx.pendant .bulb::after { content: ""; position: absolute; left: -35%; right: -35%; top: 50%; height: 260%;
    background: radial-gradient(ellipse 50% 70% at 50% 0%, color-mix(in srgb, var(--glow) 40%, transparent), transparent); filter: blur(calc(4 * var(--u))); }
  /* Strip: a hairline shelf edge with diffused light washing up the wall behind it. */
  .fx.strip i, .fx.pole i { position: absolute; background: color-mix(in srgb, var(--tm-text) 35%, transparent); transition: background .3s, box-shadow .3s; }
  .fx.strip i { left: 0; right: 0; bottom: 18%; height: 1px; }
  .fx.strip::before { content: ""; position: absolute; left: 0; right: 0; bottom: 18%; height: 78%; opacity: var(--i, 0); transition: opacity .3s;
    background: linear-gradient(to top, color-mix(in srgb, var(--glow) 80%, transparent), color-mix(in srgb, var(--glow) 22%, transparent) 50%, transparent);
    -webkit-mask: linear-gradient(to right, transparent, #000 16%, #000 84%, transparent); mask: linear-gradient(to right, transparent, #000 16%, #000 84%, transparent); filter: blur(calc(3 * var(--u))); }
  .fx.strip.on i { background: color-mix(in srgb, var(--glow) 55%, var(--tm-text)); box-shadow: 0 -1px calc(5 * var(--u)) var(--glow); }
  /* Pole: a vertical hairline bar glowing out to both sides, fading at the ends. */
  .fx.pole i { top: 4%; bottom: 4%; left: 50%; width: 1px; transform: translateX(-50%); }
  .fx.pole::before { content: ""; position: absolute; inset: 4% 0; opacity: var(--i, 0); transition: opacity .3s;
    background: linear-gradient(to right, transparent, color-mix(in srgb, var(--glow) 25%, transparent) 25%, color-mix(in srgb, var(--glow) 85%, transparent) 50%, color-mix(in srgb, var(--glow) 25%, transparent) 75%, transparent);
    -webkit-mask: linear-gradient(to bottom, transparent, #000 14%, #000 86%, transparent); mask: linear-gradient(to bottom, transparent, #000 14%, #000 86%, transparent); filter: blur(calc(3 * var(--u))); }
  .fx.pole.on i { background: color-mix(in srgb, var(--glow) 55%, var(--tm-text)); box-shadow: 0 0 calc(5 * var(--u)) var(--glow); }
  @media (prefers-reduced-motion: reduce) { .fx *, .fx::before { transition: none; } }
`;

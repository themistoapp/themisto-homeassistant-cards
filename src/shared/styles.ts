import { css } from "lit";

/**
 * Themisto tokens. Light values on :host, dark values when the card sees hass.themes.darkMode
 * (the base card mirrors it onto the `dark` attribute). Names follow the site's LAYOUT.md.
 */
export const tokens = css`
  :host {
    --tm-text: #111a2c; --tm-text-2: #3b4d6a; --tm-muted: #6a7c99;
    --tm-accent: #2451d6; --tm-accent-soft: rgba(36, 81, 214, 0.08);
    --tm-read: rgba(252, 252, 254, 0.8); --tm-read-2: rgba(17, 26, 44, 0.045); --tm-solid: #fff; --tm-glass-strong: rgba(255, 255, 255, 0.8);
    --tm-line: rgba(17, 26, 44, 0.1); --tm-line-strong: rgba(36, 81, 214, 0.35);
    --tm-ok: #10b981; --tm-bad: #ef4444; --tm-idle: #94a3b8; --tm-warn: #c77a06;
    --tm-heat: #ea580c; --tm-cool: #2563eb; --tm-lamp: #e0a800; --tm-lamp-soft: rgba(250, 204, 21, 0.2);
    --tm-solar: #eab308; --tm-grid: #8b5cf6;
    /* "On" for switches, sliders and power buttons: the accent, as on the brand page's switch. */
    --tm-on: var(--tm-accent); --tm-on-ink: #fff; --tm-on-knob: #fff;
    --tm-shadow: 0 1px 2px rgba(17, 26, 44, 0.06), 0 6px 18px rgba(17, 26, 44, 0.07);
    --tm-display: Themisto, "Arial Black", sans-serif;
    --tm-body: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    --tm-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    display: block; height: 100%;
  }
  :host([dark]) {
    --tm-text: #e8edf5; --tm-text-2: #a9bbd6; --tm-muted: #7189ad;
    --tm-accent: #6fa9f4; --tm-accent-soft: rgba(111, 169, 244, 0.1);
    --tm-read: rgba(9, 14, 26, 0.84); --tm-read-2: rgba(140, 180, 240, 0.07); --tm-solid: #101a2e; --tm-glass-strong: rgba(18, 26, 44, 0.78);
    --tm-line: rgba(140, 180, 240, 0.14); --tm-line-strong: rgba(111, 169, 244, 0.45);
    --tm-ok: #34d399; --tm-bad: #f87171; --tm-idle: #4a6fa5; --tm-warn: #fbbf24;
    --tm-heat: #fb923c; --tm-cool: #60a5fa; --tm-lamp: #facc15; --tm-lamp-soft: rgba(250, 204, 21, 0.16);
    --tm-on-ink: #06101f;
    --tm-shadow: 0 1px 2px rgba(0, 0, 0, 0.35), 0 8px 20px rgba(0, 0, 0, 0.3);
  }
`;

export const base = css`
  * { box-sizing: border-box; }
  button { font: inherit; color: inherit; background: none; border: 0; padding: 0; margin: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  button:disabled { cursor: default; opacity: 0.4; }
  button:focus-visible, [tabindex]:focus-visible { outline: 2px solid var(--tm-accent); outline-offset: 2px; }
  svg { fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; display: block; }
  ha-icon { --mdc-icon-size: 100%; display: grid; width: 100%; height: 100%; }

  ha-card.tm {
    position: relative; height: 100%; display: flex; flex-direction: column; container-type: inline-size;
    border: 1px solid var(--tm-line); border-radius: 22px; background: var(--tm-read); box-shadow: var(--tm-shadow);
    overflow: hidden; color: var(--tm-text); font: 14px/1.45 var(--tm-body); --pad: 16px; --c: var(--tm-accent);
  }
  ha-card.tm.glass { backdrop-filter: blur(20px) saturate(150%); -webkit-backdrop-filter: blur(20px) saturate(150%); }
  ha-card.tm[data-l="compact"] { --pad: 12px; }
  ha-card.tm.na { opacity: 0.62; }
  ha-card.tm.actionable { cursor: pointer; }
  .in { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 12px; padding: var(--pad); }
  .row { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .sp { flex: 1; min-width: 0; }
  .kick { display: block; font: 500 11px/1.1 var(--tm-mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--tm-accent); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ttl { display: block; margin: 0; font: 900 18px/1.05 var(--tm-display); text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-block: 0.08em; }
  .nm { font-weight: 600; font-size: 13px; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sub { font: 11px/1.3 var(--tm-mono); color: var(--tm-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .hd { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; min-width: 0; }
  .hd { flex-wrap: wrap; row-gap: 6px; }
  .hd > .titles, .hd > .titlerow { min-width: 0; flex: 1 1 110px; }
  .hd > .titles { display: grid; gap: 4px; }
  /* Status pill: neutral mono text, colour carried by the dot and a light tint (never coloured text on tint). */
  .chip { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 10px; border: 1px solid color-mix(in srgb, var(--cc, var(--tm-idle)) 40%, var(--tm-line)); border-radius: 999px; background: color-mix(in srgb, var(--cc, var(--tm-idle)) 12%, transparent); color: var(--tm-text-2); font: 500 10.5px/1 var(--tm-mono); letter-spacing: 0.04em; white-space: nowrap; flex: none; font-variant-numeric: tabular-nums; max-width: 100%; overflow: hidden; }
  .chip > i { width: 7px; height: 7px; border-radius: 50%; background: var(--cc, var(--tm-idle)); flex: none; }
  .chip svg, .chip ha-icon { width: 13px; height: 13px; flex: none; color: var(--cc, currentColor); }
  button.chip:not(:disabled):hover { border-color: var(--tm-line-strong); }
  .itile { display: grid; place-items: center; width: 36px; height: 36px; flex: none; border-radius: 10px; color: var(--c); background: color-mix(in srgb, var(--c) 15%, transparent); }
  .itile svg, .itile ha-icon { width: 20px; height: 20px; }
  .itile.sm { width: 30px; height: 30px; border-radius: 8px; }
  .itile.sm svg, .itile.sm ha-icon { width: 16px; height: 16px; }
  .hero { font: 900 var(--hero, 44px)/1 var(--tm-display); padding-block: 0.12em; white-space: nowrap; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
  .u { font: 500 12px var(--tm-mono); color: var(--tm-muted); margin-left: 5px; letter-spacing: 0; }
  .sv { font: 900 17px/1.15 var(--tm-display); padding-block: 0.06em; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .stat { display: grid; gap: 4px; min-width: 0; text-align: left; }
  /* Labels name a value and stay muted; only the card's eyebrow takes the accent. */
  .stat .kick { font-size: 10.5px; letter-spacing: 0.06em; color: var(--tm-muted); }
  .rbtn { display: grid; place-items: center; width: 40px; height: 40px; flex: none; border-radius: 50%; border: 1px solid var(--tm-line); background: var(--tm-read-2); }
  .rbtn svg { width: 18px; height: 18px; }
  .rbtn.sm { width: 34px; height: 34px; }
  .rbtn.lg { width: 46px; height: 46px; }
  .rbtn:not(:disabled):hover { border-color: var(--tm-line-strong); background: var(--tm-accent-soft); }
  .pbtn { height: 28px; padding: 0 12px; border-radius: 999px; font: 500 12px var(--tm-body); white-space: nowrap; color: var(--tm-accent); background: var(--tm-accent-soft); transition: background 0.15s; }
  .pbtn:not(:disabled):hover { background: color-mix(in srgb, var(--tm-accent) 18%, transparent); }
  .seg { display: flex; padding: 3px; gap: 2px; border-radius: 999px; border: 1px solid var(--tm-line); background: var(--tm-glass-strong); flex: none; }
  .seg button { flex: 1; min-width: 0; height: 32px; border-radius: 999px; font: 500 12.5px var(--tm-body); color: var(--tm-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: background 0.15s, color 0.15s; }
  .seg button[aria-pressed="true"] { background: var(--tm-accent-soft); color: var(--tm-accent); }
  .sw { position: relative; width: 36px; height: 20px; flex: none; border-radius: 999px; border: 1px solid var(--tm-line); background: var(--tm-line); transition: background-color 0.15s, border-color 0.15s; }
  .sw i { position: absolute; top: 1px; left: 1px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(17, 26, 44, 0.25); transition: transform 0.18s cubic-bezier(0.4, 0, 0.2, 1); }
  .sw.on { background: var(--on, var(--tm-on)); border-color: var(--on, var(--tm-on)); }
  .sw.on i { transform: translateX(16px); background: var(--on-knob, var(--tm-on-knob)); }
  .msg { font-size: 12px; color: var(--tm-muted); }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; animation: none !important; } }
`;

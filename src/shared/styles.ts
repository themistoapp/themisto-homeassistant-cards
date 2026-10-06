import { css } from "lit";

/**
 * Themisto tokens. Light values on :host, dark values when the card sees hass.themes.darkMode
 * (the base card mirrors it onto the `dark` attribute). Values follow themisto.app/brand.
 *
 * Type: two display sizes (section title for readings, card title for titles and tile figures),
 * then body, button, small, eyebrow and label. Every font size and box radius in a card comes from
 * these tokens; tests/brand.test.ts fails on anything else. The thermostat dial is the one exception.
 */
export const tokens = css`
  :host {
    --tm-text: #111a2c; --tm-text-2: #3b4d6a; --tm-muted: #6a7c99;
    --tm-accent: #2451d6; --tm-accent-soft: rgba(36, 81, 214, 0.08);
    --tm-glass: rgba(250, 250, 252, 0.62); --tm-glass-border: rgba(255, 255, 255, 0.75);
    --tm-read: rgba(252, 252, 254, 0.8); --tm-read-2: rgba(17, 26, 44, 0.045); --tm-solid: #fff; --tm-glass-strong: rgba(255, 255, 255, 0.8);
    --tm-line: rgba(17, 26, 44, 0.1); --tm-line-strong: rgba(36, 81, 214, 0.35);
    --tm-ok: #10b981; --tm-warn: #f59e0b; --tm-bad: #ef4444; --tm-info: #38bdf8; --tm-idle: #94a3b8;
    --tm-heat: #ea580c; --tm-cool: #2563eb; --tm-lamp: #e0a800; --tm-lamp-soft: rgba(250, 204, 21, 0.2);
    --tm-solar: #eab308; --tm-grid: #8b5cf6;
    /* "On" for switches, sliders and power buttons: the accent, as on the brand page's switch. */
    --tm-on: var(--tm-accent); --tm-on-ink: #fff; --tm-on-knob: #fff;
    --tm-shadow: 0 1px 2px rgba(17, 26, 44, 0.06), 0 6px 18px rgba(17, 26, 44, 0.07);
    --tm-display: Themisto, "Arial Black", sans-serif;
    --tm-body: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    --tm-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    /* One box radius; icon tiles keep their own two. */
    --tm-radius: 16px; --tm-radius-icon: 10px; --tm-radius-icon-sm: 8px;
    /* Type scale, in px so cards don't depend on Home Assistant's root font size. */
    --tm-fs-section: 27.2px; --tm-fs-section-c: 22.4px; --tm-fs-card: 17.6px;
    --tm-fs-body: 14px; --tm-fs-button: 13.6px; --tm-fs-small: 12.8px; --tm-fs-eyebrow: 11.2px; --tm-fs-label: 10.6px;
    display: block; height: 100%;
  }
  :host([dark]) {
    --tm-text: #e8edf5; --tm-text-2: #a9bbd6; --tm-muted: #7189ad;
    --tm-accent: #6fa9f4; --tm-accent-soft: rgba(111, 169, 244, 0.1);
    --tm-glass: rgba(14, 20, 34, 0.55); --tm-glass-border: rgba(140, 180, 240, 0.14);
    --tm-read: rgba(9, 14, 26, 0.84); --tm-read-2: rgba(140, 180, 240, 0.07); --tm-solid: #101a2e; --tm-glass-strong: rgba(18, 26, 44, 0.78);
    --tm-line: rgba(140, 180, 240, 0.14); --tm-line-strong: rgba(111, 169, 244, 0.45);
    --tm-ok: #34d399; --tm-warn: #fbbf24; --tm-bad: #f87171; --tm-info: #7dd3fc; --tm-idle: #4a6fa5;
    --tm-heat: #fb923c; --tm-cool: #60a5fa; --tm-lamp: #facc15; --tm-lamp-soft: rgba(250, 204, 21, 0.16);
    --tm-on-ink: #06101f;
    --tm-shadow: 0 1px 2px rgba(0, 0, 0, 0.35), 0 8px 20px rgba(0, 0, 0, 0.3);
  }
`;

/**
 * Shared card styles. Internal class names map onto themisto.app's brand classes:
 *   .kick = .eyebrow · .ttl = .t-card · .hero = .t-section (a reading) · .sv = .t-card figure
 *   .label = .label · .chip = .pill · .rbtn = .icon-btn · .pbtn = .btn-soft · .qbtn = .btn-quiet
 *   .choice = .choice · .seg = .segmented · .panel = .panel · .meter = the 6px bar
 */
export const base = css`
  * { box-sizing: border-box; }
  button { font: inherit; color: inherit; background: none; border: 0; padding: 0; margin: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; }
  button:disabled { cursor: default; opacity: 0.4; }
  button:focus-visible, [tabindex]:focus-visible { outline: 2px solid var(--tm-accent); outline-offset: 2px; }
  svg { fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; display: block; }
  ha-icon { --mdc-icon-size: 100%; display: grid; width: 100%; height: 100%; }

  /* Surfaces: the card is glass (top level); what you read inside it is a .panel. */
  ha-card.tm {
    position: relative; height: 100%; display: flex; flex-direction: column; container-type: inline-size;
    border: 1px solid var(--tm-line); border-radius: var(--tm-radius); background: var(--tm-read); box-shadow: var(--tm-shadow);
    overflow: hidden; color: var(--tm-text); font: var(--tm-fs-body)/1.45 var(--tm-body); --pad: 16px; --c: var(--tm-accent);
  }
  ha-card.tm.glass { background: var(--tm-glass); border-color: var(--tm-glass-border); backdrop-filter: blur(20px) saturate(150%); -webkit-backdrop-filter: blur(20px) saturate(150%); }
  ha-card.tm[data-l="compact"] { --pad: 12px; }
  ha-card.tm.na { opacity: 0.62; }
  ha-card.tm.actionable { cursor: pointer; }
  .panel { min-width: 0; border-radius: var(--tm-radius); border: 1px solid var(--tm-line); background: var(--tm-read); }
  .in { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 12px; padding: var(--pad); }
  .row { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .sp { flex: 1; min-width: 0; }

  /* Type */
  .kick { display: block; font: 400 var(--tm-fs-eyebrow)/1.1 var(--tm-mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--tm-accent); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ttl { display: block; margin: 0; font: 900 var(--tm-fs-card)/1.15 var(--tm-display); text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-block: 0.08em; }
  .nm { font-weight: 600; font-size: var(--tm-fs-body); line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sub { font: 400 var(--tm-fs-small)/1.3 var(--tm-body); color: var(--tm-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .label, .stat .kick { display: block; font: 400 var(--tm-fs-label)/1.2 var(--tm-mono); letter-spacing: 0.06em; text-transform: uppercase; color: var(--tm-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .hero { font: 900 var(--hero, var(--tm-fs-section))/1 var(--tm-display); padding-block: 0.12em; white-space: nowrap; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
  ha-card[data-l="compact"] .hero { --hero: var(--tm-fs-section-c); }
  .u { font: 400 var(--tm-fs-small) var(--tm-mono); color: var(--tm-muted); margin-left: 5px; letter-spacing: 0; }
  .sv { font: 900 var(--tm-fs-card)/1.15 var(--tm-display); padding-block: 0.06em; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .msg { font-size: var(--tm-fs-small); color: var(--tm-muted); }

  .hd { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; min-width: 0; flex-wrap: wrap; row-gap: 6px; }
  .hd > .titles, .hd > .titlerow { min-width: 0; flex: 1 1 110px; }
  .hd > .titles { display: grid; gap: 4px; }
  .stat { display: grid; gap: 4px; min-width: 0; text-align: left; }

  /* Pill: tinted fill, no outline; the dot carries the colour. Only where nothing else shows the state. */
  .chip { display: inline-flex; align-items: center; gap: 0.4em; padding: 4.8px 11.2px; border-radius: 999px; background: color-mix(in srgb, var(--cc, var(--tm-idle)) 16%, transparent); color: var(--tm-text); font: 600 var(--tm-fs-small)/1.2 var(--tm-body); white-space: nowrap; flex: none; font-variant-numeric: tabular-nums; max-width: 100%; overflow: hidden; }
  .chip > i { width: 7px; height: 7px; border-radius: 50%; background: var(--cc, var(--tm-idle)); flex: none; }
  .chip svg, .chip ha-icon { width: 13px; height: 13px; flex: none; color: var(--cc, currentColor); }
  /* Very narrow cards (under 200px): pills drop to label size rather than be cut. */
  @container (max-width: 200px) { .chip { padding: 3px 8px; gap: 0.3em; font-size: var(--tm-fs-label); } .chip > i { width: 6px; height: 6px; } .chip .more { display: none; } }
  button.chip:not(:disabled):hover { background: color-mix(in srgb, var(--cc, var(--tm-idle)) 24%, transparent); }

  .itile { display: grid; place-items: center; width: 36px; height: 36px; flex: none; border-radius: var(--tm-radius-icon); color: var(--c); background: color-mix(in srgb, var(--c) 15%, transparent); }
  .itile svg, .itile ha-icon { width: 20px; height: 20px; }
  .itile.sm { width: 28px; height: 28px; border-radius: var(--tm-radius-icon-sm); }
  .itile.sm svg, .itile.sm ha-icon { width: 16px; height: 16px; }

  /* Buttons: 36px; 44px (.lg) only for a card's one main action. */
  .rbtn { display: grid; place-items: center; width: 36px; height: 36px; flex: none; border-radius: 50%; border: 1px solid var(--tm-line); background: transparent; color: var(--tm-text-2); transition: background 0.15s, border-color 0.15s, color 0.15s; }
  .rbtn svg { width: 18px; height: 18px; }
  .rbtn.lg { width: 44px; height: 44px; }
  .rbtn.lg svg { width: 20px; height: 20px; }
  .rbtn:not(:disabled):hover { border-color: var(--tm-line-strong); background: var(--tm-accent-soft); color: var(--tm-text); }
  .pbtn { display: inline-flex; align-items: center; justify-content: center; height: 36px; padding: 0 16px; border-radius: 999px; font: 600 var(--tm-fs-button) var(--tm-body); white-space: nowrap; color: var(--tm-accent); background: var(--tm-accent-soft); transition: background 0.15s; }
  .pbtn:not(:disabled):hover { background: color-mix(in srgb, var(--tm-accent) 18%, transparent); }
  .qbtn { height: 36px; padding: 0 16px; border-radius: 999px; font: 600 var(--tm-fs-button) var(--tm-body); color: var(--tm-muted); }
  .qbtn:not(:disabled):hover { color: var(--tm-text); }
  /* Choice chips: pick one from a set (favourites, presets). */
  .choice { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 36px; padding: 0 13.6px; border-radius: 999px; border: 1px solid var(--tm-line); background: transparent; font: 400 var(--tm-fs-small) var(--tm-body); color: var(--tm-text-2); white-space: nowrap; flex: none; transition: background 0.15s, border-color 0.15s, color 0.15s; }
  .choice:not(:disabled):hover { border-color: var(--tm-line-strong); color: var(--tm-text); }
  .choice[aria-pressed="true"] { background: var(--tm-accent-soft); border-color: var(--tm-line-strong); color: var(--tm-text); }
  .seg { display: flex; padding: 3px; gap: 2px; border-radius: 999px; border: 1px solid var(--tm-line); background: var(--tm-glass-strong); flex: none; }
  .seg button { flex: 1; min-width: 0; height: 28px; border-radius: 999px; font: 500 var(--tm-fs-small) var(--tm-body); color: var(--tm-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: background 0.15s, color 0.15s; }
  .seg button[aria-pressed="true"] { background: var(--tm-accent-soft); color: var(--tm-accent); }

  .sw { position: relative; width: 36px; height: 20px; flex: none; border-radius: 999px; border: 1px solid var(--tm-line); background: var(--tm-line); transition: background-color 0.15s, border-color 0.15s; }
  .sw i { position: absolute; top: 1px; left: 1px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(17, 26, 44, 0.25); transition: transform 0.18s cubic-bezier(0.4, 0, 0.2, 1); }
  .sw.on { background: var(--on, var(--tm-on)); border-color: var(--on, var(--tm-on)); }
  .sw.on i { transform: translateX(16px); background: var(--on-knob, var(--tm-on-knob)); }

  /* Meters (progress, battery, solar, range): one 6px bar. --mc sets the fill. */
  .meter { position: relative; height: 6px; border-radius: 99px; background: var(--tm-line); overflow: hidden; flex: none; }
  .meter > i { position: absolute; inset: 0 auto 0 0; border-radius: inherit; background: var(--mc, var(--tm-text-2)); transition: width 0.3s; }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; animation: none !important; } }
`;

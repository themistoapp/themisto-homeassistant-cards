import { css, html, nothing } from "lit";
import { ThemistoCard } from "../shared/base-card";
import { actions, appearance, bool, choose, colour, editorFor, entity, iconField, list, numberField, section, textField, titleFields, grid, type EditorSpec } from "../shared/editor";
import { icon } from "../shared/icons";
import { cap, clamp, friendlyName, isUnavailable, num } from "../shared/util";
import type { BaseConfig, HassEntity, HomeAssistant } from "../types";

interface ModeOpt { mode: string; label?: string }
interface Preset { name: string; icon?: string; temperature: number; hvac_mode?: string }
export interface ThermostatConfig extends BaseConfig {
  entity: string;
  modes?: ModeOpt[];
  presets?: Preset[];
  step?: number;
  humidity_entity?: string;
  show_current?: boolean;
  show_humidity?: boolean;
  show_modes?: boolean;
  show_presets?: boolean;
  heating_colour?: string; cooling_colour?: string; idle_colour?: string; off_colour?: string;
}

const ALL_MODES = ["off", "heat", "cool", "heat_cool", "auto", "dry", "fan_only"];
const MODE_LABEL: Record<string, string> = { heat_cool: "Heat/Cool", fan_only: "Fan" };

/** Rounds to the step and clamps to the entity's range. Exported for tests. */
export function stepTarget(current: number, delta: number, step: number, min: number, max: number) {
  const v = Math.round((current + delta * step) / step) * step;
  return clamp(Number(v.toFixed(2)), min, max);
}

export class ThemistoThermostatCard extends ThemistoCard<ThermostatConfig> {
  static override presets = { compact: { columns: 6, rows: 2 }, standard: { columns: 6, rows: 4 }, large: { columns: 6, rows: 5 } };
  static override properties = { ...ThemistoCard.properties, _pending: { state: true }, _end: { state: true } };
  declare _pending?: { low?: number; high?: number; t?: number; timer?: number; sent?: number };
  declare _end: "low" | "high";

  constructor() { super(); this._end = "low"; }

  static override styles = [
    ...ThemistoCard.styles,
    css`
      /* The dial keeps the round, ticked thermostat face; everything around it is the standard Themisto card. */
      ha-card.thermostat { --dial-idle: #1c2a47; --dial-off: #3b4d6a; }
      :host([dark]) ha-card.thermostat { --dial-idle: #15213a; --dial-off: #22304a; }
      .climate-in { gap: 10px; }

      .dial-row { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; gap: 14px; }
      .dial {
        --dial-size: 132px; position: relative; width: var(--dial-size); height: var(--dial-size); flex: none;
        display: grid; place-items: center; align-content: center; overflow: hidden; border-radius: 50%; color: #fff;
        background: radial-gradient(circle at 42% 34%, color-mix(in srgb, var(--face), white 12%), var(--face) 58%, color-mix(in srgb, var(--face), black 18%));
        box-shadow: inset 0 0 0 5px color-mix(in srgb, var(--face), black 45%), inset 10px 12px 22px rgba(255,255,255,.06), inset -12px -14px 24px rgba(0,0,0,.18), var(--tm-shadow);
      }
      .dial::after { content: ""; position: absolute; inset: 7px 20px auto; height: 27%; border-radius: 50%; background: linear-gradient(rgba(255,255,255,.1), transparent); pointer-events: none; }
      .tick-ring { position: absolute; inset: 9px; border-radius: 50%; background: repeating-conic-gradient(from -118deg, rgba(255,255,255,.72) 0deg 1.1deg, transparent 1.1deg 7.5deg); -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 6px)); mask: radial-gradient(farthest-side, transparent calc(100% - 6px), #000 calc(100% - 6px)); opacity: .42; pointer-events: none; }
      .active-tick { position: absolute; inset: 7px; z-index: 2; transform: rotate(var(--current-angle)); pointer-events: none; }
      .active-tick::before { content: ""; position: absolute; top: 0; left: 50%; width: 3px; height: 10px; border-radius: 3px; transform: translateX(-50%); background: #fff; box-shadow: 0 0 5px rgba(255,255,255,.4); }
      .dial-status { z-index: 1; margin-bottom: 3px; font: 500 9px/1 var(--tm-mono); letter-spacing: .12em; text-transform: uppercase; color: rgba(255,255,255,.8); }
      .dial-target { z-index: 1; font: 900 42px/1 var(--tm-display); padding-block: .06em; white-space: nowrap; font-variant-numeric: tabular-nums; }
      .dial-target .degree { display: inline-block; margin-left: 1px; font-size: .42em; vertical-align: top; transform: translateY(.1em); }
      .dial-target.word { font-size: 30px; }
      .dial-target.range { display: flex; align-items: baseline; gap: 2px; font-size: 24px; }
      .dial-target.range button { font: inherit; opacity: .5; }
      .dial-target.range button[aria-pressed="true"] { opacity: 1; }
      .dial-current { z-index: 1; margin-top: 5px; color: rgba(255,255,255,.75); font: 500 9.5px/1 var(--tm-mono); letter-spacing: .04em; }
      .dial-current strong { color: #fff; font-weight: 600; font-variant-numeric: tabular-nums; }
      .dial-current.pending { color: #fff; }

      .seg button { font-size: 12px; }
      .presets { display: grid; grid-template-columns: repeat(auto-fit, minmax(0, 1fr)); gap: 6px; }
      .presets button { display: inline-flex; align-items: center; justify-content: center; gap: 5px; min-width: 0; overflow: hidden; height: 30px; padding: 0 6px; border-radius: 999px; border: 1px solid var(--tm-line); background: var(--tm-read-2); font: 500 12px var(--tm-body); white-space: nowrap; color: var(--tm-text-2); transition: background 0.15s, border-color 0.15s; }
      .presets button svg, .presets button ha-icon { width: 14px; height: 14px; flex: none; }
      .presets button:hover { border-color: var(--tm-line-strong); }
      .presets button[aria-pressed="true"] { border-color: var(--tm-line-strong); background: var(--tm-accent-soft); color: var(--tm-accent); }

      .compact-climate { display: grid; grid-template-columns: 82px minmax(0, 1fr) 34px; align-items: center; gap: 12px; }
      .compact-climate .dial { --dial-size: 80px; box-shadow: inset 0 0 0 4px color-mix(in srgb, var(--face), black 45%), var(--tm-shadow); }
      .compact-climate .tick-ring { inset: 6px; -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px)); mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 4px)); }
      .compact-climate .active-tick { inset: 5px; }
      .compact-climate .active-tick::before { width: 2px; height: 7px; }
      .compact-climate .dial-status { font-size: 6.5px; margin-bottom: 1px; }
      .compact-climate .dial-target { font-size: 24px; }
      .compact-climate .dial-target.word { font-size: 18px; }
      .compact-climate .dial-target.range { font-size: 14px; }
      .compact-climate .dial-current { display: none; }
      .compact-copy { min-width: 0; display: grid; gap: 6px; }
      .compact-copy .ttl { font-size: 16px; }
      .compact-reading { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; color: var(--tm-muted); font: 500 10px/1.2 var(--tm-mono); letter-spacing: .06em; text-transform: uppercase; }
      .compact-reading strong { color: var(--tm-text); font: 900 14px/1 var(--tm-display); letter-spacing: 0; font-variant-numeric: tabular-nums; padding-block: .06em; }
      .compact-stepper { display: grid; gap: 6px; }

      ha-card[data-l="large"] .dial { --dial-size: 150px; }
      ha-card[data-l="large"] .dial-target { font-size: 48px; }
      @container (max-width: 260px) { .dial-row { gap: 8px; } .dial { --dial-size: 120px; } .dial-row > .rbtn { width: 34px; height: 34px; } }
      @container (max-width: 220px) {
        /* The dial colour already shows the state; the chip would wrap and squeeze the dial. */
        .hd .chip { display: none; }
        .dial-row { position: relative; gap: 0; }
        .dial-row > .rbtn { position: absolute; z-index: 3; bottom: 1px; width: 30px; height: 30px; background: var(--tm-read); }
        .dial-row > .rbtn:first-child { left: 0; } .dial-row > .rbtn:last-child { right: 0; }
        .dial, ha-card[data-l="large"] .dial { --dial-size: 112px; }
        ha-card[data-l="large"] .dial-target { font-size: 40px; }
        .presets button span { display: none; }
        .presets button svg, .presets button ha-icon { display: block; }
        .compact-climate { grid-template-columns: minmax(0, 1fr) 30px; gap: 8px; }
        .compact-climate .dial { --dial-size: 74px; justify-self: center; }
        .compact-climate .dial-target { font-size: 22px; }
        .compact-copy { display: none; }
        .compact-stepper .rbtn { width: 30px; height: 30px; }
      }
      @container (min-width: 221px) and (max-width: 360px) { .presets button svg, .presets button ha-icon { display: none; } }
    `,
  ];

  protected override validate(c: ThermostatConfig) { if (!c.entity) throw new Error("Choose a climate entity"); }
  protected watchedEntities() { return [this._config?.entity, this._config?.humidity_entity]; }

  static getConfigElement() { return editorFor(ThemistoThermostatCard); }
  static getStubConfig(hass: HomeAssistant) {
    return { entity: Object.keys(hass.states).find((e) => e.startsWith("climate.")) || "climate.example", presets: [{ name: "Eco", icon: "leaf", temperature: 18 }, { name: "Comfort", icon: "heart", temperature: 21 }] };
  }
  static editor(hass: HomeAssistant, c: Record<string, any>): EditorSpec {
    const s = c.entity ? hass.states[c.entity] : undefined;
    const modes: string[] = s?.attributes.hvac_modes || ALL_MODES;
    const modeOpts = modes.map((m) => [m, MODE_LABEL[m] || cap(m)] as [string, string]);
    return {
      schema: [
        entity("entity", "climate"),
        ...titleFields(),
        section("Readings", [grid(bool("show_current"), bool("show_humidity")), entity("humidity_entity", "sensor", { filter: { domain: "sensor", device_class: "humidity" } })], { icon: "mdi:thermometer" }),
        section("Modes", [bool("show_modes"), list("modes", { mode: { ...choose("mode", modeOpts), label: "Mode", required: true }, label: { ...textField("label"), label: "Button text" } }, "label", "mode")], { icon: "mdi:sun-snowflake-variant" }),
        section("Presets", [bool("show_presets"), list("presets", {
          name: { ...textField("name"), label: "Name", required: true },
          icon: { ...iconField(), label: "Icon" },
          temperature: { ...numberField("temperature", 5, 35, 0.5, "°"), label: "Temperature", required: true },
          hvac_mode: { ...choose("hvac_mode", modeOpts), label: "Also set mode (optional)" },
        }, "name", "temperature")], { icon: "mdi:star-outline" }),
        appearance(["compact", "standard", "large"], [numberField("step", 0.1, 5, 0.1, "°")]),
        section("Colours", [grid(colour("heating_colour"), colour("cooling_colour")), grid(colour("idle_colour"), colour("off_colour"))], { icon: "mdi:palette" }),
        actions(),
      ],
      labels: { show_current: "Current temperature", show_humidity: "Humidity", humidity_entity: "Humidity sensor (optional)", show_modes: "Mode buttons", modes: "Modes to show", show_presets: "Preset buttons", presets: "Presets", step: "Step override", heating_colour: "Heating", cooling_colour: "Cooling", idle_colour: "Idle", off_colour: "Off" },
      helpers: {
        modes: "Leave empty to show every mode the thermostat supports, in its own order.",
        presets: "Your own named temperatures. Shown on the large size. Tapping one sets the target.",
        humidity_entity: "Used when the thermostat doesn't report humidity itself.",
        step: "Leave blank to use the thermostat's own step.",
      },
    };
  }

  private send(s: HassEntity) {
    const p = this._pending!;
    const data: Record<string, unknown> = { entity_id: s.entity_id };
    if (p.t !== undefined) data.temperature = p.t;
    if (p.low !== undefined || p.high !== undefined) {
      data.target_temp_low = p.low ?? num(s.attributes.target_temp_low);
      data.target_temp_high = p.high ?? num(s.attributes.target_temp_high);
    }
    this.call("climate", "set_temperature", data);
    // Keep showing the pending figure until HA confirms it, or 4 s at most.
    this._pending = { ...p, timer: undefined, sent: Date.now() };
    setTimeout(() => { if (this._pending?.sent && Date.now() - this._pending.sent >= 3900) this._pending = undefined; }, 4000);
  }

  private bump(s: HassEntity, dir: number, range: boolean) {
    const a = s.attributes;
    const step = this._config!.step || num(a.target_temp_step, a.temperature_unit === "°F" ? 1 : 0.5);
    const min = num(a.min_temp, 7), max = num(a.max_temp, 35);
    const p = { ...(this._pending || {}) };
    clearTimeout(p.timer);
    if (range) {
      const key = this._end;
      const cur = p[key] ?? num(key === "low" ? a.target_temp_low : a.target_temp_high, 20);
      p[key] = stepTarget(cur, dir, step, min, max);
    } else {
      p.t = stepTarget(p.t ?? num(a.temperature, 20), dir, step, min, max);
    }
    p.sent = undefined;
    p.timer = window.setTimeout(() => this.send(s), 600);
    this._pending = p;
  }

  protected override willUpdate() {
    // Drop the pending figure once HA reports it.
    const s = this.stateOf(this._config?.entity), p = this._pending;
    if (!s || !p?.sent) return;
    const a = s.attributes;
    const done = (p.t === undefined || num(a.temperature) === p.t) && (p.low === undefined || num(a.target_temp_low) === p.low) && (p.high === undefined || num(a.target_temp_high) === p.high);
    if (done) this._pending = undefined;
  }

  override render() {
    const c = this._config!, s = this.stateOf(c.entity);
    const name = this.t(c.name, friendlyName(s, c.entity));
    if (!s) return this.unavailable(name, `Entity not found: ${c.entity}`, icon("therm"));
    if (isUnavailable(s)) return this.unavailable(name, "Unavailable", icon("therm"));
    const a = s.attributes;
    const off = s.state === "off";
    const range = s.state === "heat_cool" && a.target_temp_low !== undefined;
    const p = this._pending;
    const step = c.step || num(a.target_temp_step, 0.5);
    const dec = step < 1 ? 1 : 0;
    const f = (v: number) => (Number.isFinite(v) ? v.toFixed(dec) : "–");
    const target = p?.t ?? num(a.temperature);
    const low = p?.low ?? num(a.target_temp_low), high = p?.high ?? num(a.target_temp_high);
    const action = String(a.hvac_action || (off ? "off" : "idle"));
    const col = { heating: this.colour(c.heating_colour, "var(--tm-heat)"), preheating: this.colour(c.heating_colour, "var(--tm-heat)"), cooling: this.colour(c.cooling_colour, "var(--tm-cool)"), off: this.colour(c.off_colour, "var(--tm-muted)") }[action] || this.colour(c.idle_colour, "var(--tm-idle)");
    const actionText = this.hass?.formatEntityAttributeValue ? this.hass.formatEntityAttributeValue(s, "hvac_action", action) : cap(action);
    const hum = c.humidity_entity ? num(this.stateOf(c.humidity_entity)?.state) : num(a.current_humidity);
    const current = num(a.current_temperature);
    const dialNow = c.show_current !== false && Number.isFinite(current) ? html`Current <strong>${f(current)}°</strong>` : nothing;
    const pend = !!p;
    const face = action === "heating" || action === "preheating" || action === "cooling" ? col : action === "off" ? (c.off_colour ? col : "var(--dial-off)") : (c.idle_colour ? col : "var(--dial-idle)");
    const min = num(a.min_temp, 7), max = num(a.max_temp, 35);
    const angle = Number.isFinite(current) ? -118 + ((clamp(current, min, max) - min) / Math.max(max - min, 1)) * 236 : -118;
    const chip = html`<span class="chip" style="--cc:${off ? "var(--tm-idle)" : col}"><i></i>${actionText}</span>`;
    const dialStyle = `--state:${col};--face:${face};--current-angle:${angle}deg`;
    const btn = (d: number) => html`<button class="rbtn ${this.cardLayout === "compact" ? "sm" : ""}" ?disabled=${off} @click=${() => this.bump(s, d, range)} aria-label=${d < 0 ? "Lower target" : "Raise target"}>${icon(d < 0 ? "minus" : "plus")}</button>`;
    const dialTarget = off
      ? html`<div class="dial-target word">OFF</div>`
      : range
        ? html`<div class="dial-target range"><button aria-pressed=${this._end === "low"} @click=${() => (this._end = "low")} aria-label="Edit low target">${f(low)}</button><span>–</span><button aria-pressed=${this._end === "high"} @click=${() => (this._end = "high")} aria-label="Edit high target">${f(high)}</button><span class="degree">°</span></div>`
        : html`<div class="dial-target">${f(target)}<span class="degree">°</span></div>`;
    const dial = html`<div class="dial" style=${dialStyle}>
      <div class="tick-ring" aria-hidden="true"></div><div class="active-tick" aria-hidden="true"></div>
      <div class="dial-status">${pend ? "Sending" : off ? "" : "Target"}</div>${dialTarget}
      ${dialNow ? html`<div class="dial-current ${pend ? "pending" : ""}">${dialNow}</div>` : nothing}
    </div>`;

    if (this.cardLayout === "compact") {
      return this.shell(html`<div class="in compact-climate" style=${dialStyle}>
        ${dial}
        <div class="compact-copy">${name ? html`<span class="ttl">${name}</span>` : nothing}
          ${c.show_current !== false && Number.isFinite(current) ? html`<div class="compact-reading"><span>Current</span><strong>${f(current)}°</strong></div>` : nothing}
          ${c.show_humidity !== false && Number.isFinite(hum) ? html`<div class="compact-reading"><span>Humidity</span><strong>${Math.round(hum)}%</strong></div>` : nothing}
        </div>
        <div class="compact-stepper">${btn(1)}${btn(-1)}</div>
      </div>`, { cls: "thermostat", style: dialStyle });
    }

    const supported: string[] = a.hvac_modes || [];
    const modes: ModeOpt[] = (c.modes?.length ? c.modes : supported.map((mode): ModeOpt => ({ mode }))).filter((m) => supported.includes(m.mode));
    const showModes = c.show_modes !== false && modes.length > 1;
    const presets = this.cardLayout === "large" && c.show_presets !== false ? c.presets || [] : [];
    return this.shell(html`<div class="in climate-in" style=${dialStyle}>
      ${this.header(this.t(c.kicker, "Thermostat"), name, chip)}
      <div class="dial-row">${btn(-1)}${dial}${btn(1)}</div>
      ${showModes ? html`<div class="seg" role="group" aria-label="Mode">${modes.map((m) => html`<button aria-pressed=${s.state === m.mode}
        @click=${() => this.call("climate", "set_hvac_mode", { entity_id: c.entity, hvac_mode: m.mode })}>${m.label || this.hass?.formatEntityState?.(s, m.mode) || MODE_LABEL[m.mode] || cap(m.mode)}</button>`)}</div>` : nothing}
      ${presets.length ? html`<div class="presets">${presets.map((pr) => html`<button aria-pressed=${!off && num(a.temperature) === pr.temperature && (!pr.hvac_mode || pr.hvac_mode === s.state)} title="${pr.name} · ${f(pr.temperature)}°"
        @click=${() => { clearTimeout(this._pending?.timer); this._pending = undefined; this.call("climate", "set_temperature", { entity_id: c.entity, temperature: pr.temperature, ...(pr.hvac_mode ? { hvac_mode: pr.hvac_mode } : off ? { hvac_mode: supported.find((m) => m !== "off") } : {}) }); }}>
        ${pr.icon ? icon(pr.icon) : nothing}<span>${pr.name}</span></button>`)}</div>` : nothing}
    </div>`, { cls: "thermostat", style: dialStyle });
  }
}

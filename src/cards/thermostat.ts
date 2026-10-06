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

/** Temperatures show to the nearest half degree. Exported for tests. */
export function half(v: number) { return Math.round(v * 2) / 2; }
/** "20.5" / "21", or "–". Exported for tests. */
export function fmtHalf(v: number) { return Number.isFinite(v) ? String(half(v)) : "–"; }

/** Dial angle for a temperature: 300 degrees from −150 (min) to +150 (max). Exported for tests. */
export function dialAngle(t: number, min: number, max: number) {
  return -150 + ((clamp(t, min, max) - min) / Math.max(max - min, 1)) * 300;
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
      /*
       * The dial is modelled on the Nest Learning Thermostat (3rd gen): a brushed-steel bezel round a
       * black glass face that turns orange when heating and blue when cooling, a ring of ticks lit
       * between the current temperature and the target, the current temperature as a small number
       * on the ring, and a large light-weight target with the half degree as a superscript.
       * It is an instrument face, so it is the one place cards use their own type sizes (brand-exception).
       */
      /* Like the real thing, the face keeps the same deep orange and blue in light and dark themes. */
      ha-card.thermostat { --dial-idle: #0b0d11; --dial-off: #0b0d11; --dial-heat: #ef5f12; --dial-cool: #1f74d4; }
      .climate-in { gap: 10px; }

      .dial-row { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; gap: 14px; }
      .dial { --dial-size: 132px; --bezel: 5px; position: relative; width: var(--dial-size); height: var(--dial-size); flex: none; border-radius: 50%; padding: var(--bezel);
        background: conic-gradient(from 200deg, #f4f6f8, #9aa1aa, #e9ecef, #7e858e, #dfe3e7, #a3aab3, #f4f6f8);
        box-shadow: 0 1px 0 rgba(255,255,255,.6) inset, 0 10px 24px -10px rgba(0,0,0,.55), var(--tm-shadow); }
      .face { position: relative; width: 100%; height: 100%; border-radius: 50%; overflow: hidden; display: grid; place-items: center; align-content: center; color: #fff;
        background: radial-gradient(circle at 50% 30%, color-mix(in srgb, var(--face), white 14%), var(--face) 55%, color-mix(in srgb, var(--face), black 30%));
        box-shadow: inset 0 0 0 1px rgba(0,0,0,.6), inset 0 6px 14px rgba(0,0,0,.35); transition: background .6s; }
      /* Glass: a soft highlight across the top of the face. */
      .face::after { content: ""; position: absolute; inset: 4% 14% auto; height: 34%; border-radius: 50%; background: linear-gradient(rgba(255,255,255,.12), transparent); pointer-events: none; }
      /* Ticks: 300 degrees of fine marks; .lit repeats them brighter between current and target. */
      .ticks { position: absolute; inset: 6px; border-radius: 50%; pointer-events: none;
        background: repeating-conic-gradient(from 0deg, var(--tick) 0deg 0.7deg, transparent 0.7deg 3deg);
        -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 9px), #000 calc(100% - 9px)), conic-gradient(from var(--m-from), #000 0deg var(--m-span), transparent var(--m-span));
        -webkit-mask-composite: source-in; mask: radial-gradient(farthest-side, transparent calc(100% - 9px), #000 calc(100% - 9px)) intersect, conic-gradient(from var(--m-from), #000 0deg var(--m-span), transparent var(--m-span)); }
      .ticks.all { --tick: rgba(255,255,255,.28); --m-from: -150deg; --m-span: 300deg; }
      .ticks.lit { --tick: rgba(255,255,255,.95); }
      .mark { position: absolute; inset: 4px; transform: rotate(var(--a)); pointer-events: none; z-index: 1; }
      .mark::before { content: ""; position: absolute; top: 0; left: 50%; width: 3px; height: 15px; border-radius: 2px; transform: translateX(-50%); background: #fff; box-shadow: 0 0 6px rgba(255,255,255,.5); }
      .mark.now::before { width: 2px; height: 11px; top: 2px; opacity: .85; }
      /* Sits on the tick ring beside its own tick, breaking the ticks around it as on the Nest. */
      .now-t { position: absolute; z-index: 2; transform: translate(-50%, -50%); padding: 1px 3px; border-radius: 99px; background: var(--face); font: 600 10.6px/1 var(--tm-body); font-variant-numeric: tabular-nums; color: #fff; pointer-events: none; }
      .dial-status { z-index: 1; min-height: 1em; margin-bottom: 2px; font: 600 10.6px/1 var(--tm-body); letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,.85); }
      .dial-target { z-index: 1; display: flex; align-items: flex-start; font: 300 44px/1 var(--tm-body); letter-spacing: -0.03em; white-space: nowrap; font-variant-numeric: tabular-nums; }
      .dial-target sup { font-size: .36em; line-height: 1; margin: .14em 0 0 .06em; letter-spacing: 0; }
      .dial-target.word { font-size: 26px; font-weight: 400; letter-spacing: .08em; }
      .dial-target.range { align-items: baseline; gap: 4px; font-size: 26px; }
      .dial-target.range button { font: inherit; opacity: .5; }
      .dial-target.range button[aria-pressed="true"] { opacity: 1; }
      .dial-eco { z-index: 1; height: 16px; margin-top: 3px; color: #6ee7a1; }
      .dial-eco svg { width: 16px; height: 16px; }

      .presets { display: grid; grid-template-columns: repeat(auto-fit, minmax(0, 1fr)); gap: 6px; }
      .presets .choice { min-width: 0; overflow: hidden; padding: 0 6px; }
      .presets .choice svg, .presets .choice ha-icon { width: 14px; height: 14px; flex: none; }

      .compact-climate { display: grid; grid-template-columns: 86px minmax(0, 1fr) 36px; align-items: center; gap: 12px; }
      .compact-climate .dial { --dial-size: 86px; --bezel: 4px; }
      .compact-climate .ticks { inset: 4px; }
      .compact-climate .mark { inset: 3px; }
      .compact-climate .mark::before { height: 10px; width: 2px; }
      .compact-climate .mark.now, .compact-climate .now-t, .compact-climate .dial-status, .compact-climate .dial-eco { display: none; }
      .compact-climate .dial-target { font-size: 28px; }
      .compact-climate .dial-target.word { font-size: 17px; }
      .compact-climate .dial-target.range { font-size: 16px; }
      .compact-copy { min-width: 0; display: grid; gap: 6px; }
      .compact-reading { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
      .compact-reading .sv { font-size: var(--tm-fs-card); }
      .compact-stepper { display: grid; gap: 6px; }

      ha-card[data-l="large"] .dial { --dial-size: 150px; }
      ha-card[data-l="large"] .dial-target { font-size: 50px; }
      @container (max-width: 260px) { .dial-row { gap: 8px; } .dial { --dial-size: 120px; } }
      @container (max-width: 220px) {
        .dial-row { position: relative; gap: 0; }
        .dial-row > .rbtn { position: absolute; z-index: 3; bottom: 1px; background: var(--tm-read); }
        .dial-row > .rbtn:first-child { left: 0; } .dial-row > .rbtn:last-child { right: 0; }
        .dial, ha-card[data-l="large"] .dial { --dial-size: 112px; }
        ha-card[data-l="large"] .dial-target, .dial-target { font-size: 38px; }
        .presets .choice span { display: none; }
        .compact-climate { grid-template-columns: minmax(0, 1fr) 36px; gap: 8px; }
        .compact-climate .dial { --dial-size: 80px; justify-self: center; }
        .compact-copy { display: none; }
      }
      @container (min-width: 221px) and (max-width: 360px) { .presets .choice svg, .presets .choice ha-icon { display: none; } }
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
        appearance(["compact", "standard", ["large", "Tall"]], [numberField("step", 0.1, 5, 0.1, "°")]),
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
    const f = fmtHalf;
    const target = p?.t ?? num(a.temperature);
    const low = p?.low ?? num(a.target_temp_low), high = p?.high ?? num(a.target_temp_high);
    const action = String(a.hvac_action || (off ? "off" : "idle"));
    const col = { heating: this.colour(c.heating_colour, "var(--dial-heat)"), preheating: this.colour(c.heating_colour, "var(--dial-heat)"), cooling: this.colour(c.cooling_colour, "var(--dial-cool)"), off: this.colour(c.off_colour, "var(--tm-muted)") }[action] || this.colour(c.idle_colour, "var(--tm-idle)");
    const actionText = this.hass?.formatEntityAttributeValue ? this.hass.formatEntityAttributeValue(s, "hvac_action", action) : cap(action);
    const hum = c.humidity_entity ? num(this.stateOf(c.humidity_entity)?.state) : num(a.current_humidity);
    const current = num(a.current_temperature);
    const pend = !!p;
    const active = action === "heating" || action === "preheating" || action === "cooling";
    const face = active ? col : action === "off" ? (c.off_colour ? col : "var(--dial-off)") : (c.idle_colour ? col : "var(--dial-idle)");
    const min = num(a.min_temp, 7), max = num(a.max_temp, 35);
    const showNow = c.show_current !== false && Number.isFinite(current);
    const aNow = showNow ? dialAngle(current, min, max) : NaN;
    const aSet = off ? NaN : range ? dialAngle(this._end === "low" ? low : high, min, max) : dialAngle(target, min, max);
    // Lit ticks run between the current temperature and the target.
    const lit = Number.isFinite(aNow) && Number.isFinite(aSet) ? { from: Math.min(aNow, aSet), span: Math.abs(aSet - aNow) } : undefined;
    // The current temperature's number sits on the tick ring, 11 degrees beside its own tick, on the
    // side away from the target so the lit arc stays clear.
    const side = Number.isFinite(aSet) && aSet < aNow ? 1 : -1;
    const rad = ((aNow + side * 11) * Math.PI) / 180;
    const nowPos = showNow ? `left:calc(50% + (var(--dial-size) / 2 - var(--bezel) - 11px) * ${Math.sin(rad).toFixed(4)});top:calc(50% - (var(--dial-size) / 2 - var(--bezel) - 11px) * ${Math.cos(rad).toFixed(4)})` : "";
    const dialStyle = `--state:${col};--face:${face}`;
    const btn = (d: number) => html`<button class="rbtn ${this.cardLayout === "compact" ? "" : "lg"}" ?disabled=${off} @click=${() => this.bump(s, d, range)} aria-label=${d < 0 ? "Lower target" : "Raise target"}>${icon(d < 0 ? "minus" : "plus")}</button>`;
    const big = (v: number) => { const h = half(v); return Number.isFinite(h) ? html`${Math.floor(h)}${h % 1 ? html`<sup>5</sup>` : nothing}` : "–"; };
    const dialTarget = off
      ? html`<div class="dial-target word">OFF</div>`
      : range
        ? html`<div class="dial-target range"><button aria-pressed=${this._end === "low"} @click=${() => (this._end = "low")} aria-label="Edit low target">${f(low)}</button><span>•</span><button aria-pressed=${this._end === "high"} @click=${() => (this._end = "high")} aria-label="Edit high target">${f(high)}</button></div>`
        : html`<div class="dial-target" aria-label="Target ${f(target)}°">${big(target)}</div>`;
    const status = pend ? "Sending" : active ? actionText : "";
    const eco = String(a.preset_mode || "").toLowerCase() === "eco";
    const dial = html`<div class="dial" style=${dialStyle} role="img" aria-label="${status || (off ? "Off" : "Idle")}${showNow ? `, currently ${f(current)}°` : ""}"><div class="face">
      <div class="ticks all" aria-hidden="true"></div>
      ${lit ? html`<div class="ticks lit" aria-hidden="true" style="--m-from:${lit.from}deg;--m-span:${lit.span}deg"></div>` : nothing}
      ${Number.isFinite(aSet) ? html`<div class="mark" style="--a:${aSet}deg" aria-hidden="true"></div>` : nothing}
      ${showNow ? html`<div class="mark now" style="--a:${aNow}deg" aria-hidden="true"></div><span class="now-t" style=${nowPos} aria-hidden="true">${f(current)}</span>` : nothing}
      <div class="dial-status">${status}</div>${dialTarget}
      <div class="dial-eco">${eco ? icon("leaf") : nothing}</div>
    </div></div>`;

    if (this.cardLayout === "compact") {
      return this.shell(html`<div class="in compact-climate" style=${dialStyle}>
        ${dial}
        <div class="compact-copy">${name ? html`<span class="ttl">${name}</span>` : nothing}
          ${showNow ? html`<div class="compact-reading"><span class="label">Current</span><span class="sv">${f(current)}°</span></div>` : nothing}
          ${c.show_humidity !== false && Number.isFinite(hum) ? html`<div class="compact-reading"><span class="label">Humidity</span><span class="sv">${Math.round(hum)}%</span></div>` : nothing}
        </div>
        <div class="compact-stepper">${btn(1)}${btn(-1)}</div>
      </div>`, { cls: "thermostat", style: dialStyle });
    }

    const supported: string[] = a.hvac_modes || [];
    const modes: ModeOpt[] = (c.modes?.length ? c.modes : supported.map((mode): ModeOpt => ({ mode }))).filter((m) => supported.includes(m.mode));
    const showModes = c.show_modes !== false && modes.length > 1;
    const presets = this.cardLayout === "large" && c.show_presets !== false ? c.presets || [] : [];
    return this.shell(html`<div class="in climate-in" style=${dialStyle}>
      ${this.header(this.t(c.kicker, "Thermostat"), name)}
      <div class="dial-row">${btn(-1)}${dial}${btn(1)}</div>
      ${showModes ? html`<div class="seg" role="group" aria-label="Mode">${modes.map((m) => html`<button aria-pressed=${s.state === m.mode}
        @click=${() => this.call("climate", "set_hvac_mode", { entity_id: c.entity, hvac_mode: m.mode })}>${m.label || this.hass?.formatEntityState?.(s, m.mode) || MODE_LABEL[m.mode] || cap(m.mode)}</button>`)}</div>` : nothing}
      ${presets.length ? html`<div class="presets">${presets.map((pr) => html`<button class="choice" aria-pressed=${!off && num(a.temperature) === pr.temperature && (!pr.hvac_mode || pr.hvac_mode === s.state)} title="${pr.name} · ${f(pr.temperature)}°"
        @click=${() => { clearTimeout(this._pending?.timer); this._pending = undefined; this.call("climate", "set_temperature", { entity_id: c.entity, temperature: pr.temperature, ...(pr.hvac_mode ? { hvac_mode: pr.hvac_mode } : off ? { hvac_mode: supported.find((m) => m !== "off") } : {}) }); }}>
        ${pr.icon ? icon(pr.icon) : nothing}<span>${pr.name}</span></button>`)}</div>` : nothing}
    </div>`, { cls: "thermostat", style: dialStyle });
  }
}

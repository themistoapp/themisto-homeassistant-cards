import { css, html, nothing, unsafeCSS } from "lit";
import type { ActionSet } from "../shared/actions";
import "../components/tm-fit";
import "../components/tm-graph";
import type { PropertyValues } from "lit";
import { bucket, subscribeHistory } from "../shared/history";
import { ThemistoCard } from "../shared/base-card";
import { INDRA_LOGO_MASK } from "./indra-logo";
import { actions, appearance, bool, colour, editorFor, entity, grid, numberField, section, textField, titleFields, type EditorSpec } from "../shared/editor";
import { measure } from "../shared/format";
import { icon } from "../shared/icons";
import { cap, friendlyName, isUnavailable } from "../shared/util";
import type { BaseConfig, HassEntity, HomeAssistant } from "../types";

export interface ChargerConfig extends BaseConfig {
  entity?: string;
  power?: string;
  power_threshold?: number;
  energy?: string;
  energy_label?: string;
  cost?: string;
  cost_label?: string;
  charging_states?: string;
  image?: string; image_entity?: string; show_image?: boolean;
  lights?: boolean;
  idle_colour?: string; charging_colour?: string;
  show_graph?: boolean; hours?: number; graph_colour?: string;
  charging_text?: string; plugged_text?: string; idle_text?: string;
}

export type ChargerState = "charging" | "plugged" | "idle" | "unavailable";

/**
 * Charger state from a status entity. `extra` lists extra state values (comma separated) that mean
 * charging, for integrations with their own wording. Exported for tests.
 */
export function chargerState(s: HassEntity | undefined, extra = ""): ChargerState {
  if (!s || isUnavailable(s)) return "unavailable";
  const v = s.state.toLowerCase().trim();
  const custom = extra.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (custom.includes(v)) return "charging";
  if (["on", "true", "charging", "charge", "fast_charging", "boost", "boosting"].includes(v)) return "charging";
  if (/plug|connected|waiting|ready|paused|suspended/.test(v) && !/un|not|dis/.test(v)) return "plugged";
  return "idle";
}

/** A power sensor's reading in watts (kW and MW are converted), or undefined if it has no number. */
export function powerWatts(s: HassEntity | undefined): number | undefined {
  if (!s || isUnavailable(s)) return undefined;
  const v = parseFloat(s.state);
  if (!Number.isFinite(v)) return undefined;
  const u = String(s.attributes.unit_of_measurement || "W").toLowerCase();
  return u === "kw" ? v * 1000 : u === "mw" ? v * 1e6 : v;
}

/**
 * Charging comes from the power monitor when there is one: at or above `threshold` watts is charging.
 * Below it, the status entity (if any) still tells plugged in from idle. Without a power reading,
 * the status entity decides on its own. Exported for tests.
 */
export function deriveChargerState(status: HassEntity | undefined, power: HassEntity | undefined, extra = "", threshold = 10): ChargerState {
  const w = powerWatts(power);
  if (w === undefined) return chargerState(status, extra);
  if (w >= threshold) return "charging";
  const st = status ? chargerState(status, extra) : "idle";
  return st === "charging" ? "plugged" : st === "unavailable" ? "idle" : st;
}

// Positions on the Indra Smart PRO image (indra.webp), as % of the image.
const INDRA = { logo: { x: 42.56, y: 18.91, w: 13.85, h: 5.47 }, dots: { x: 49.6, y: [31.7, 33.1, 34.6, 36.1], w: 2 } };

export class ThemistoChargerCard extends ThemistoCard<ChargerConfig> {
  static override presets = { compact: { columns: 6, rows: 2 }, standard: { columns: 6, rows: 4 }, large: { columns: 12, rows: 4 } };
  static override properties = { ...ThemistoCard.properties, _ratio: { state: true }, _values: { state: true }, _hover: { state: true } };
  declare _ratio?: number;
  declare _values?: (number | null)[];
  declare _hover?: number | null;
  private _unsub?: () => void;
  private _subKey = "";

  private get hours() { return Math.min(168, Math.max(1, this._config?.hours || 24)); }

  /** One live history subscription for the power sensor (same engine as the sensor card). */
  private resubscribe() {
    const c = this._config;
    const key = c && this._hass && c.power && c.show_graph !== false && this.cardLayout !== "compact" ? `${c.power}|${this.hours}` : "";
    if (key === this._subKey) return;
    this._unsub?.(); this._unsub = undefined; this._subKey = key; this._values = undefined;
    if (!key) return;
    const id = c!.power!, hours = this.hours;
    this._unsub = subscribeHistory(this._hass!, [id], hours, (data) => {
      const end = Date.now(), start = end - hours * 3600_000;
      this._values = bucket(data[id] || [], start, end, hours <= 24 ? 96 : Math.min(168, hours * 2));
    });
  }
  protected override willUpdate(changed: PropertyValues) { super.willUpdate(changed); this.resubscribe(); }
  override disconnectedCallback() { super.disconnectedCallback(); this._unsub?.(); this._unsub = undefined; this._subKey = ""; }

  static override styles = [
    ...ThemistoCard.styles,
    css`
      .subs { display: flex; flex-wrap: wrap; column-gap: .5em; white-space: normal; }
      .subs > span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
      .subs > span + span::before { content: "· "; }
      /* Fixed-share image column; tm-fit sizes the picture inside it so it can never cover the text. */
      .ch { display: grid; grid-template-columns: minmax(0, 32%) minmax(0, 1fr); gap: 16px; }
      .ch.compact { grid-template-columns: minmax(0, 20%) minmax(0, 1fr); }
      @container (min-width: 480px) { .ch { grid-template-columns: minmax(0, 22%) minmax(0, 1fr); } .ch.compact { grid-template-columns: minmax(0, 14%) minmax(0, 1fr); } }
      .img { position: relative; min-width: 0; min-height: 0; display: grid; }
      .img::before { content: ""; position: absolute; inset: 15% -10%; border-radius: 50%; background: radial-gradient(closest-side, color-mix(in srgb, var(--logo) 18%, transparent), transparent); transition: background .6s; }
      tm-fit img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 10px 14px rgba(0,0,0,.3)); }
      .body { display: flex; flex-direction: column; justify-content: center; gap: 10px; min-width: 0; min-height: 0; }
      .body.has-graph { justify-content: flex-start; gap: 8px; }
      .body tm-graph { flex: 1; min-height: 36px; --graph-color: var(--gcol); }
      .hero { --hero: 40px; }
      .compact .hero { --hero: 26px; }
      .compact { gap: 12px; }
      .compact .body { gap: 4px; }

      /* Lights: logo ring and the four status dots, drawn as soft glows over the image. */
      /* The logo's own white circle and lettering, recoloured and glowing (mask cut from the photo). */
      .logo { position: absolute; pointer-events: none; filter: drop-shadow(0 0 1.5px var(--logo)) drop-shadow(0 0 6px var(--logo)); animation: breathe 3.2s ease-in-out infinite; }
      .logo b { position: absolute; inset: 0; background: var(--logo); transition: background .6s;
        -webkit-mask: url(${unsafeCSS(INDRA_LOGO_MASK)}) center / 100% 100% no-repeat; mask: url(${unsafeCSS(INDRA_LOGO_MASK)}) center / 100% 100% no-repeat; }
      .dot { position: absolute; transform: translate(-50%, -50%); border-radius: 50%; pointer-events: none; }
      .dot { aspect-ratio: 1; min-width: 3px; background: var(--dot); opacity: 0; box-shadow: 0 0 4px 1px var(--dot), 0 0 10px 3px color-mix(in srgb, var(--dot) 45%, transparent); }
      /* Each dot gets its own delay inline (top to bottom), then a pause before the next sweep. */
      .charging .dot { animation: cascade 2.2s ease-in-out infinite; }
      .plugged .dot { opacity: .55; }
      /* The photo shows the dots lit; when idle, cover them so they read as off. */
      .idle .dot { opacity: 1; background: #141518; box-shadow: none; }
      @keyframes cascade { 0% { opacity: .1; } 12% { opacity: 1; } 34% { opacity: .1; } 100% { opacity: .1; } }
      @keyframes breathe { 50% { opacity: .7; } }
      @media (prefers-reduced-motion: reduce) { .charging .dot { animation: none; opacity: .9; } .logo { animation: none; } }
      @container (max-width: 220px) { .ch { grid-template-columns: minmax(0, 1fr); } .ch > .img { display: none; } }
    `,
  ];

  protected override validate(c: ChargerConfig) { if (!c.entity && !c.power) throw new Error("Choose the charger's power monitor or status entity"); }
  protected watchedEntities() { const c = this._config; return c ? [c.entity, c.power, c.energy, c.cost, c.image_entity] : []; }

  /** Tapping the card opens the charger's details unless a tap action is set. */
  override cardActions(): ActionSet {
    const a = super.cardActions();
    return { ...a, tap_action: a.tap_action || { action: "more-info" } };
  }

  static getConfigElement() { return editorFor(ThemistoChargerCard); }
  static getStubConfig(hass: HomeAssistant) {
    const e = Object.keys(hass.states).find((id) => /charg|indra|wallbox|ohme|zappi|evse/.test(id) && !id.startsWith("sensor.") ) || Object.keys(hass.states).find((id) => /charg|indra|evse/.test(id));
    return { entity: e || "sensor.ev_charger_status", name: "Charger" };
  }
  static editor(): EditorSpec {
    return {
      schema: [
        grid(entity("power", "sensor"), numberField("power_threshold", 0, 10000, 1, "W")),
        entity("entity"),
        ...titleFields(false),
        grid(entity("energy", "sensor"), textField("energy_label")),
        grid(entity("cost", "sensor"), textField("cost_label")),
        section("Graph", [grid(bool("show_graph"), numberField("hours", 1, 168, 1, "h")), colour("graph_colour")], { icon: "mdi:chart-areaspline" }),
        textField("charging_states"),
        section("Image and lights", [bool("show_image"), textField("image"), entity("image_entity"), bool("lights"), grid(colour("idle_colour"), colour("charging_colour"))], { icon: "mdi:ev-station", expanded: true }),
        section("Status text", [grid(textField("charging_text"), textField("plugged_text")), textField("idle_text")], { icon: "mdi:format-text" }),
        appearance(["compact", "standard", ["large", "Wide"]]),
        actions(),
      ],
      labels: { entity: "Charger status (optional)", power: "Power monitor", power_threshold: "Charging above", energy: "Energy (optional)", energy_label: "Energy label", cost: "Cost (optional)", cost_label: "Cost label", charging_states: "Other states that mean charging", show_image: "Show image", image: "Image URL", image_entity: "…or an entity with a picture", lights: "Animate the charger's lights", idle_colour: "Logo when idle", charging_colour: "Lights when charging", charging_text: "Charging", plugged_text: "Plugged in", idle_text: "Idle", show_graph: "Show power graph", hours: "Graph history", graph_colour: "Graph colour" },
      helpers: {
        power: "Charging is when this reads at or above the threshold (default 10 W).",
        entity: "Optional. Tells plugged in from idle. Without a power monitor it decides charging too: on, charging or boost count as charging; plugged, connected or waiting count as plugged in.",
        energy_label: "Shown after the energy figure, e.g. \"this session\" or \"today\". Blank for none.",
        cost_label: "Shown after the cost, e.g. \"this session\" or \"this month\". Blank for none.",
        charging_states: "Comma separated, for chargers with their own wording, e.g. \"active, delivering\".",
        image: "e.g. https://themisto.app/home-assistant/cards/indra.webp",
        lights: "The logo glows pink when idle; the logo and four dots glow blue-white, pulsing downwards, while charging. Positions match the Indra image.",
      },
    };
  }

  override render() {
    const c = this._config!;
    const s = this.stateOf(c.entity);
    const st = deriveChargerState(s, this.stateOf(c.power), c.charging_states, c.power_threshold ?? 10);
    const name = this.t(c.name, friendlyName(s, "Charger"));
    const idleCol = this.colour(c.idle_colour, "#ff5fae");
    const chgCol = this.colour(c.charging_colour, "#cfe8ff");
    // Logo: blue-white while charging, pink otherwise. Dots: always the charging colour, lit only when plugged/charging.
    const logoCol = st === "charging" ? chgCol : idleCol;
    const label = { charging: this.t(c.charging_text, "Charging"), plugged: this.t(c.plugged_text, "Plugged in"), idle: this.t(c.idle_text, "Idle"), unavailable: "Unavailable" }[st];
    const chipCol = st === "charging" ? "var(--tm-ok)" : st === "plugged" ? "var(--tm-accent)" : "var(--tm-idle)";
    const chip = html`<span class="chip" style="--cc:${chipCol}">${st === "charging" ? icon("bolt") : html`<i></i>`}${label}</span>`;
    const p = c.power ? measure(this._hass, this.stateOf(c.power)) : undefined;
    const showPower = !!p && p.value !== "–" && st === "charging";
    const rawState = s && !isUnavailable(s) && st !== "charging" && !["on", "off"].includes(s.state) ? this.hass?.formatEntityState?.(s) ?? cap(s.state) : "";

    const pic = c.image_entity ? this.stateOf(c.image_entity)?.attributes.entity_picture : undefined;
    const src = pic || c.image?.trim();
    const lights = c.lights !== false && st !== "unavailable";
    const img = src && c.show_image !== false ? html`<div class="img ${st}" style="--logo:${logoCol};--dot:${chgCol}">
      <tm-fit .ratio=${this._ratio || 0.485}>
        <img src=${src} alt="" @load=${(ev: Event) => { const i = ev.target as HTMLImageElement; if (i.naturalHeight) this._ratio = i.naturalWidth / i.naturalHeight; }}>
        ${lights ? html`<i class="logo" style="left:${INDRA.logo.x}%;top:${INDRA.logo.y}%;width:${INDRA.logo.w}%;height:${INDRA.logo.h}%"><b></b></i>
          ${INDRA.dots.y.map((y, i) => html`<i class="dot" style="left:${INDRA.dots.x}%;top:${y}%;width:${INDRA.dots.w}%;animation-delay:${i * 0.28}s"></i>`)}` : nothing}
      </tm-fit></div>` : nothing;

    const figure = showPower ? html`<span class="hero">${p!.value}<span class="u">${p!.unit}</span></span>` : html`<span class="hero" style="--hero:${this.cardLayout === "compact" ? 22 : 30}px">${label}</span>`;
    const fig = (id: string | undefined, lbl: string | undefined) => {
      const m = id ? measure(this._hass, this.stateOf(id)) : undefined;
      return m && m.value !== "–" ? [m.value + (m.unit ? ` ${m.unit}` : ""), this.t(lbl, "")].filter(Boolean).join(" ") : "";
    };
    const sub = [fig(c.energy, c.energy_label), fig(c.cost, c.cost_label), rawState && rawState.toLowerCase() !== label.toLowerCase() ? rawState : ""].filter(Boolean);
    // Each part stays whole; on narrow cards they wrap onto a second line instead of being cut off.
    const subs = (parts: string[]) => parts.length ? html`<span class="sub subs">${parts.map((p) => html`<span>${p}</span>`)}</span>` : nothing;

    if (this.cardLayout === "compact") {
      return this.shell(html`<div class="in ch compact">${img}<div class="body">
        <div class="row" style="justify-content:space-between"><span class="nm">${name}</span>${chip}</div>
        ${figure}${subs(sub)}</div></div>`, { na: st === "unavailable" });
    }
    const graph = c.power && c.show_graph !== false ? html`<tm-graph style="--gcol:${this.colour(c.graph_colour, "var(--tm-ok)")}" .values=${this._values || []} type="area"
      @graph-hover=${(ev: CustomEvent) => (this._hover = ev.detail.index)}></tm-graph>` : nothing;
    // While hovering the graph, the sub line shows that point in time instead.
    let subLine: string[] = sub;
    if (this._hover != null && this._values?.[this._hover] != null) {
      const n = this._values.length, t = new Date(Date.now() - (n - 1 - this._hover) * (this.hours * 3600_000 / n));
      const v = measure(this._hass, { ...this.stateOf(c.power)!, state: String(this._values[this._hover]) });
      subLine = [`${t.toLocaleTimeString(this._hass?.locale?.language || "en-GB", { hour: "2-digit", minute: "2-digit" })} · ${v.value} ${v.unit}`];
    }
    return this.shell(html`<div class="in ch">${img}<div class="body ${graph !== nothing ? "has-graph" : ""}">
      ${this.header(this.t(c.kicker, "EV charger"), name, chip)}
      ${figure}${subs(subLine)}${graph}
    </div></div>`, { na: st === "unavailable" });
  }
}

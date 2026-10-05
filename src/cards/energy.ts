import { css, html, nothing } from "lit";
import "../components/tm-fit";
import { ThemistoCard } from "../shared/base-card";
import { actions, appearance, bool, choose, colour, editorFor, entity, grid, numberField, section, textField, titleFields, type EditorSpec } from "../shared/editor";
import { formatPower, measure } from "../shared/format";
import { icon } from "../shared/icons";
import { isUnavailable, num } from "../shared/util";
import type { BaseConfig, HomeAssistant } from "../types";

export interface EnergyConfig extends BaseConfig {
  grid_power?: string; grid_energy?: string; grid_cost?: string; grid_invert?: boolean; grid_name?: string; grid_colour?: string;
  solar_power?: string; solar_energy?: string; solar_name?: string; solar_colour?: string;
  battery_power?: string; battery_soc?: string; battery_invert?: boolean; battery_name?: string; battery_colour?: string;
  home_power?: string; home_energy?: string; home_name?: string; home_colour?: string;
  image?: string; image_entity?: string; show_image?: boolean; show_chip?: boolean;
  /** Glow on the unit's light bar, filled to the battery's state of charge. Positions are % of the image. */
  soc_glow?: boolean; glow_colour?: "green" | "blue"; glow_x?: number; glow_top?: number; glow_bottom?: number; glow_width?: number;
  /** Below this many watts a flow counts as idle. */
  idle_watts?: number;
}

type Flow = "in" | "out" | "idle";

/**
 * Direction of a signed power reading, using HA's energy dashboard convention
 * (grid: + import / − export; battery: + discharge / − charge). `invert` flips it. Exported for tests.
 */
export function flow(watts: number, invert = false, idle = 10): Flow {
  if (!Number.isFinite(watts) || Math.abs(watts) < idle) return "idle";
  return (invert ? -watts : watts) > 0 ? "in" : "out";
}

/** Reads a power sensor in watts, whatever unit it reports. */
function watts(s?: { state: string; attributes: Record<string, any> }) {
  if (!s) return NaN;
  const v = num(s.state);
  return String(s.attributes.unit_of_measurement || "W").toLowerCase() === "kw" ? v * 1000 : v;
}

/** The STREAM's own light-bar colours. */
const GLOW = { green: "#3ee08a", blue: "#4aa8ff" };

// Where the light strip sits on the EcoFlow STREAM image (ecoflow-stream.webp), in % of the image.
const STREAM_BAR = { x: 50.9, top: 42.1, bottom: 89.6, width: 1.8 };

export class ThemistoEnergyCard extends ThemistoCard<EnergyConfig> {
  static override properties = { ...ThemistoCard.properties, _ratio: { state: true } };
  /** Image aspect ratio once loaded, so the glow overlay lines up with the drawn image. */
  declare _ratio?: number;
  static override presets = { compact: { columns: 6, rows: 4 }, standard: { columns: 6, rows: 6 }, large: { columns: 12, rows: 4 } };

  static override styles = [
    ...ThemistoCard.styles,
    css`
      .en { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 12px; }
      .en.has-img { grid-template-rows: auto minmax(70px, 1fr) auto; }
      .img { position: relative; min-width: 0; min-height: 0; display: grid; }
      .img::before { content: ""; position: absolute; inset: 10% 20%; border-radius: 50%; background: radial-gradient(closest-side, color-mix(in srgb, var(--tm-accent) 22%, transparent), transparent); }
      tm-fit img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 10px 14px rgba(0,0,0,.28)); }
      /* SoC light bar: a track along the strip, filled from the bottom, with a soft halo. */
      .lb { position: absolute; transform: translateX(-50%); border-radius: 99px; overflow: visible; }
      .lb .fill { position: absolute; left: 0; right: 0; bottom: 0; border-radius: 99px; background: var(--gc);
        box-shadow: 0 0 4px 1px var(--gc), 0 0 14px 4px color-mix(in srgb, var(--gc) 55%, transparent); transition: height .6s ease; }
      .lb.chg .fill { animation: breathe 2.4s ease-in-out infinite; }
      @keyframes breathe { 50% { box-shadow: 0 0 2px 0 var(--gc), 0 0 8px 2px color-mix(in srgb, var(--gc) 35%, transparent); opacity: .75; } }
      .tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: minmax(88px, 1fr); gap: 8px; min-height: 0; }
      .tiles.n1 { grid-template-columns: minmax(0, 1fr); }
      .t { display: flex; flex-direction: column; justify-content: space-between; gap: 4px; min-width: 0; min-height: 0; padding: 10px 12px; border-radius: 14px; background: var(--tm-read-2); text-align: left; cursor: pointer; overflow: hidden; }
      .t:hover { box-shadow: inset 0 0 0 1px var(--tm-line-strong); }
      .t .top { display: flex; align-items: center; gap: 7px; min-width: 0; }
      .t .ic { display: grid; place-items: center; width: 24px; height: 24px; flex: none; border-radius: 8px; color: var(--tc); background: color-mix(in srgb, var(--tc) 16%, transparent); }
      .t .ic svg, .t .ic ha-icon { width: 14px; height: 14px; }
      .t .lbl { flex: 1; min-width: 0; font: 900 13px/1.1 var(--tm-display); text-transform: uppercase; color: var(--tm-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-block: 0.08em; }
      .t .chip { height: 20px; padding: 0 7px; gap: 5px; font-size: 10.5px; }
      .t .chip > i { width: 5px; height: 5px; }
      .t .hero { --hero: 26px; padding-block: 0.06em; }
      .t .sub { font-size: 10.5px; }
      .soc { display: flex; align-items: center; gap: 8px; width: 100%; min-width: 0; }
      .soc .bar { flex: 1; height: 6px; border-radius: 99px; background: var(--tm-line); overflow: hidden; }
      .soc .bar i { display: block; height: 100%; border-radius: inherit; background: var(--tc); }
      .soc .sv { font-size: 12px; }
      /* Wide cards: image in its own column on the left. */
      /* Wide cards: title and image share the left column; tiles get the full height on the right. */
      .side { display: contents; }
      @container (min-width: 480px) {
        .en.has-img { grid-template-columns: minmax(110px, 28%) minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); column-gap: 16px; }
        .en.has-img .side { display: flex; flex-direction: column; gap: 8px; min-height: 0; }
        .en.has-img .side .hd { flex-direction: column; align-items: flex-start; gap: 6px; flex: none; }
        .en.has-img .side .hd > .titles { flex: none; width: 100%; }
        .en.has-img .side .img { flex: 1; }
      }
      @container (max-width: 360px) { .t .chip { display: none; } }
      @container (max-width: 300px) { .t { padding: 8px 9px; } .t .hero { --hero: 21px; } }
      @container (max-width: 230px) { .tiles { grid-template-columns: minmax(0, 1fr); grid-auto-rows: minmax(72px, 1fr); } }
    `,
  ];

  protected override validate(c: EnergyConfig) {
    if (!c.grid_power && !c.solar_power && !c.battery_power && !c.home_power) throw new Error("Set at least one power sensor (grid, solar, battery or home)");
  }
  private glow(socId?: string, charging = false) {
    const c = this._config!;
    const soc = num(this.stateOf(socId)?.state);
    if (c.soc_glow === false || !socId || !Number.isFinite(soc)) return nothing;
    const x = c.glow_x ?? STREAM_BAR.x, top = c.glow_top ?? STREAM_BAR.top, bottom = c.glow_bottom ?? STREAM_BAR.bottom, w = c.glow_width ?? STREAM_BAR.width;
    const pct = Math.max(0, Math.min(100, soc));
    const gc = GLOW[c.glow_colour === "blue" ? "blue" : "green"];
    return html`<i class="lb ${charging ? "chg" : ""}" style="left:${x}%;top:${top}%;height:${bottom - top}%;width:max(2px, ${w}%);--gc:${gc}" aria-hidden="true"><i class="fill" style="height:${pct}%"></i></i>`;
  }

  protected watchedEntities() {
    const c = this._config;
    return c ? [c.grid_power, c.grid_energy, c.grid_cost, c.solar_power, c.solar_energy, c.battery_power, c.battery_soc, c.home_power, c.home_energy, c.image_entity] : [];
  }

  static getConfigElement() { return editorFor(ThemistoEnergyCard); }
  static getStubConfig(hass: HomeAssistant) {
    const find = (re: RegExp) => Object.keys(hass.states).find((e) => e.startsWith("sensor.") && re.test(e) && hass.states[e].attributes.device_class === "power");
    return { name: "Energy", grid_power: find(/grid/), solar_power: find(/solar|pv/), battery_power: find(/battery/), home_power: find(/home|house|load/) };
  }
  static editor(): EditorSpec {
    const tile = (key: string, title: string, mdi: string, extra: ReturnType<typeof entity>[], invert = false) =>
      section(title, [entity(`${key}_power`, "sensor"), ...extra, ...(invert ? [bool(`${key}_invert`)] : []), grid(textField(`${key}_name`), colour(`${key}_colour`))], { icon: mdi });
    return {
      schema: [
        ...titleFields(false),
        tile("grid", "Grid", "mdi:transmission-tower", [entity("grid_energy", "sensor"), entity("grid_cost", "sensor")], true),
        tile("solar", "Solar", "mdi:solar-power", [entity("solar_energy", "sensor")]),
        tile("battery", "Battery", "mdi:home-battery", [entity("battery_soc", "sensor")], true),
        tile("home", "Home", "mdi:home-lightning-bolt", [entity("home_energy", "sensor")]),
        section("Image", [bool("show_image"), textField("image"), entity("image_entity"), grid(bool("soc_glow"), choose("glow_colour", [["green", "Green"], ["blue", "Blue"]])),
          grid(numberField("glow_x", 0, 100, 0.1, "%"), numberField("glow_width", 0.2, 10, 0.1, "%")), grid(numberField("glow_top", 0, 100, 0.1, "%"), numberField("glow_bottom", 0, 100, 0.1, "%"))], { icon: "mdi:image-outline" }),
        appearance(["compact", "standard", ["large", "Wide"]], [grid(bool("show_chip"), numberField("idle_watts", 0, 500, 1, "W"))]),
        actions(),
      ],
      labels: {
        grid_power: "Power now", grid_energy: "Energy today", grid_cost: "Cost today", grid_invert: "Export shows as positive",
        solar_power: "Power now", solar_energy: "Energy today",
        battery_power: "Power now", battery_soc: "State of charge", battery_invert: "Charging shows as positive",
        home_power: "Power now", home_energy: "Energy today (optional)",
        grid_name: "Label", solar_name: "Label", battery_name: "Label", home_name: "Label",
        grid_colour: "Colour", solar_colour: "Colour", battery_colour: "Colour", home_colour: "Colour",
        show_image: "Show image", soc_glow: "Light bar glows with the battery level", glow_colour: "Light bar colour", glow_x: "Light bar across", glow_width: "Light bar width", glow_top: "Light bar top", glow_bottom: "Light bar bottom", image: "Image URL", image_entity: "…or an entity with a picture", show_chip: "Grid status chip", idle_watts: "Count as idle below",
      },
      helpers: {
        grid_invert: "Turn on if the grid sensor goes negative when you're importing.",
        battery_invert: "Turn on if the battery sensor goes negative when it's discharging.",
        image: "e.g. https://themisto.app/home-assistant/cards/ecoflow-stream.webp",
        soc_glow: "Fills the unit's light strip from the bottom to the state of charge. Needs the battery state of charge sensor.",
        glow_x: "Positions are percentages of the image. The defaults line up with the EcoFlow STREAM image; leave them blank for that.",
        name: "Leave blank for \"Energy\". A single space hides it.",
      },
    };
  }

  private power(id?: string) {
    const s = this.stateOf(id);
    return s && !isUnavailable(s) ? watts(s) : NaN;
  }
  private extra(id?: string, suffix = "") {
    const s = this.stateOf(id);
    if (!id || !s || isUnavailable(s)) return "";
    const m = measure(this._hass, s);
    return `${m.value}${m.unit ? ` ${m.unit}` : ""}${suffix}`;
  }

  private tile(key: "grid" | "solar" | "battery" | "home", label: string, ic: string, col: string, dirText: string, f: Flow, w: number, sub: unknown) {
    const c = this._config!;
    const id = c[`${key}_power`];
    const p = Number.isFinite(w) ? formatPower(this._hass, Math.abs(w)) : { value: "–", unit: "" };
    return html`<button class="t ${f === "idle" ? "idle" : ""}" style="--tc:${col}" @click=${() => this.elementAction(id)} aria-label="${label}: ${p.value} ${p.unit}">
      <div class="top"><span class="ic">${icon(ic)}</span><span class="lbl">${label}</span>${dirText ? html`<span class="chip" style="--cc:${f === "idle" ? "var(--tm-idle)" : col}"><i></i>${dirText}</span>` : nothing}</div>
      <span class="hero">${p.value}${p.unit ? html`<span class="u">${p.unit}</span>` : nothing}</span>
      ${sub || nothing}
    </button>`;
  }

  override render() {
    const c = this._config!;
    const idle = c.idle_watts ?? 10;
    const tiles = [];
    let gridFlow: Flow = "idle";
    let gridW = NaN;
    if (c.grid_power) {
      gridW = this.power(c.grid_power);
      gridFlow = flow(gridW, c.grid_invert, idle);
      const sub = [this.extra(c.grid_energy), this.extra(c.grid_cost)].filter(Boolean).join(" · ");
      tiles.push(this.tile("grid", this.t(c.grid_name, "Grid"), "grid", this.colour(c.grid_colour, "var(--tm-grid)"),
        { in: "Importing", out: "Exporting", idle: "Idle" }[gridFlow], gridFlow, gridW, sub ? html`<span class="sub">${sub}</span>` : nothing));
    }
    if (c.solar_power) {
      const w = this.power(c.solar_power);
      const on = Number.isFinite(w) && w >= idle;
      const sub = this.extra(c.solar_energy, " today");
      tiles.push(this.tile("solar", this.t(c.solar_name, "Solar"), "solar", this.colour(c.solar_colour, "var(--tm-solar)"),
        on ? "Generating" : "Idle", on ? "in" : "idle", w, sub ? html`<span class="sub">${sub}</span>` : nothing));
    }
    let batteryCharging = false;
    if (c.battery_power) {
      const w = this.power(c.battery_power);
      const f = flow(w, c.battery_invert, idle);
      batteryCharging = f === "out";
      const soc = num(this.stateOf(c.battery_soc)?.state);
      const col = this.colour(c.battery_colour, "var(--tm-ok)");
      const barCol = soc < 15 ? "var(--tm-bad)" : soc < 30 ? "var(--tm-warn)" : col;
      const sub = c.battery_soc && Number.isFinite(soc)
        ? html`<div class="soc"><div class="bar"><i style="width:${Math.max(0, Math.min(100, soc))}%;background:${barCol}"></i></div><span class="sv">${Math.round(soc)}%</span></div>` : nothing;
      tiles.push(this.tile("battery", this.t(c.battery_name, "Battery"), "battery", col, { in: "Discharging", out: "Charging", idle: "Idle" }[f], f, w, sub));
    }
    if (c.home_power) {
      const w = this.power(c.home_power);
      const sub = this.extra(c.home_energy, " today");
      tiles.push(this.tile("home", this.t(c.home_name, "Home"), "home", this.colour(c.home_colour, "var(--tm-accent)"),
        "Using", "in", w, sub ? html`<span class="sub">${sub}</span>` : nothing));
    }

    const pic = c.image_entity ? this.stateOf(c.image_entity)?.attributes.entity_picture : undefined;
    const src = pic || c.image?.trim();
    const showImg = !!src && c.show_image !== false && this.cardLayout !== "compact";
    const chip = c.show_chip !== false && c.grid_power && Number.isFinite(gridW)
      ? html`<span class="chip" style="--cc:${gridFlow === "out" ? "var(--tm-ok)" : gridFlow === "in" ? this.colour(c.grid_colour, "var(--tm-grid)") : "var(--tm-idle)"}"><i></i>${
        gridFlow === "idle" ? "Off grid" : gridFlow === "out" ? "Exporting" : "Importing"}</span>` : nothing;

    return this.shell(html`<div class="in en ${showImg ? "has-img" : ""}">
      <div class="side">${this.header(this.t(c.kicker, "Home energy"), this.t(c.name, "Energy"), chip)}
      ${showImg ? html`<div class="img"><tm-fit .ratio=${this._ratio || 0.69}>
        <img src=${src} alt="" @load=${(e: Event) => { const i = e.target as HTMLImageElement; if (i.naturalHeight) this._ratio = i.naturalWidth / i.naturalHeight; }}>
        ${this.glow(c.battery_soc, batteryCharging)}</tm-fit></div>` : nothing}</div>
      <div class="tiles n${tiles.length}">${tiles}</div>
    </div>`);
  }
}

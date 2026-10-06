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
  image?: string; image_entity?: string; show_image?: boolean;
  /** The solar system's peak output in kW; sets the solar tile's bar. */
  solar_peak?: number;
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
      .tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: minmax(64px, 1fr); gap: 8px; min-height: 0; }
      .tiles.n1 { grid-template-columns: minmax(0, 1fr); }
      /* A tile is a panel: the icon says what it is (no name), then the figure and its detail. The
         icon sits beside the figure; on narrow standard cards it sits above, so the detail line keeps
         its width. */
      .t { display: grid; grid-template-columns: auto minmax(0, 1fr); align-content: center; align-items: center; column-gap: 12px; row-gap: 3px; min-width: 0; min-height: 0; padding: 10px 12px; text-align: left; cursor: pointer; overflow: hidden; }
      .t:hover { border-color: var(--tm-line-strong); }
      .t > .itile { grid-row: 1 / span 3; }
      .t > :not(.itile) { grid-column: 2; min-width: 0; }
      .t.idle .itile { --c: var(--tm-idle) !important; }
      .t .hero { --hero: var(--tm-fs-card); padding-block: 0.06em; }
      .bar { display: flex; align-items: center; gap: 8px; width: 100%; min-width: 0; }
      .bar .meter { flex: 1; }
      .bar .sv { font-size: var(--tm-fs-small); }
      .bar.chg .meter > i { background: repeating-linear-gradient(-45deg, var(--mc) 0 6px, color-mix(in srgb, var(--mc) 70%, #fff) 6px 12px); background-size: 17px 17px; animation: chg 1s linear infinite; }
      @keyframes chg { to { background-position: 17px 0; } }
      ha-card[data-l="compact"] .t { column-gap: 10px; padding: 8px 10px; }
      ha-card[data-l="compact"] .t .itile { width: 28px; height: 28px; border-radius: var(--tm-radius-icon-sm); }
      ha-card[data-l="compact"] .t .itile svg, ha-card[data-l="compact"] .t .itile ha-icon { width: 16px; height: 16px; }
      ha-card[data-l="compact"] .t .sub { display: none; }
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
      @container (max-width: 400px) {
        ha-card[data-l="standard"] .t { grid-template-columns: minmax(0, 1fr); align-content: space-between; }
        ha-card[data-l="standard"] .t > .itile { grid-row: auto; width: 28px; height: 28px; border-radius: var(--tm-radius-icon-sm); }
        ha-card[data-l="standard"] .t > .itile svg, ha-card[data-l="standard"] .t > .itile ha-icon { width: 16px; height: 16px; }
        ha-card[data-l="standard"] .t > :not(.itile) { grid-column: 1; }
      }
      /* A wide card squeezed onto a phone has no room for the picture. */
      @container (max-width: 479px) { ha-card[data-l="large"] .en.has-img { grid-template-rows: auto minmax(0, 1fr); } ha-card[data-l="large"] .en .img { display: none; } }
      /* Phone width (a half-width card is ~185px): one column of tiles, icon beside the figure, no picture. */
      @container (max-width: 230px) {
        .en.has-img { grid-template-rows: auto minmax(0, 1fr); } .en .img { display: none; }
        .tiles, .tiles.n4 { grid-template-columns: minmax(0, 1fr); grid-auto-rows: minmax(0, 1fr); gap: 6px; }
        ha-card:not([data-l="compact"]) .t, .t { grid-template-columns: auto minmax(0, 1fr); align-content: center; column-gap: 10px; padding: 4px 10px; }
        ha-card:not([data-l="compact"]) .t > .itile, .t > .itile { grid-row: 1 / span 3; }
        ha-card:not([data-l="compact"]) .t > :not(.itile), .t > :not(.itile) { grid-column: 2; }
        ha-card[data-l="compact"] .t { row-gap: 0; padding: 3px 10px; }
        ha-card[data-l="compact"] .t .bar { display: none; }
      }
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
        tile("solar", "Solar", "mdi:solar-power", [entity("solar_energy", "sensor"), numberField("solar_peak", 0.1, 100, 0.1, "kW")]),
        tile("battery", "Battery", "mdi:home-battery", [entity("battery_soc", "sensor")], true),
        tile("home", "Home", "mdi:home-lightning-bolt", [entity("home_energy", "sensor")]),
        section("Image", [bool("show_image"), textField("image"), entity("image_entity"), grid(bool("soc_glow"), choose("glow_colour", [["green", "Green"], ["blue", "Blue"]])),
          grid(numberField("glow_x", 0, 100, 0.1, "%"), numberField("glow_width", 0.2, 10, 0.1, "%")), grid(numberField("glow_top", 0, 100, 0.1, "%"), numberField("glow_bottom", 0, 100, 0.1, "%"))], { icon: "mdi:image-outline" }),
        appearance(["compact", "standard", ["large", "Wide"]], [numberField("idle_watts", 0, 500, 1, "W")]),
        actions(),
      ],
      labels: {
        grid_power: "Power now", grid_energy: "Energy today", grid_cost: "Cost today", grid_invert: "Export shows as positive",
        solar_power: "Power now", solar_energy: "Energy today",
        battery_power: "Power now", battery_soc: "State of charge", battery_invert: "Charging shows as positive",
        home_power: "Power now", home_energy: "Energy today (optional)",
        grid_name: "Label", solar_name: "Label", battery_name: "Label", home_name: "Label",
        grid_colour: "Colour", solar_colour: "Colour", battery_colour: "Colour", home_colour: "Colour",
        show_image: "Show image", soc_glow: "Light bar glows with the battery level", glow_colour: "Light bar colour", glow_x: "Light bar across", glow_width: "Light bar width", glow_top: "Light bar top", glow_bottom: "Light bar bottom", image: "Image URL", image_entity: "…or an entity with a picture", solar_peak: "Peak output", idle_watts: "Count as idle below",
      },
      helpers: {
        grid_invert: "Turn on if the grid sensor goes negative when you're importing.",
        battery_invert: "Turn on if the battery sensor goes negative when it's discharging.",
        image: "e.g. https://themisto.app/home-assistant/cards/ecoflow-stream.webp",
        solar_peak: "Your system's maximum output, e.g. 4.2 kW. Shows a bar of output against it; leave blank for none.",
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

  /** One tile: icon (what it is), figure, then a meter and/or detail line. The name and direction stay in the accessible label. */
  private tile(key: "grid" | "solar" | "battery" | "home", label: string, ic: string, col: string, dirText: string, f: Flow, w: number, ...below: unknown[]) {
    const c = this._config!;
    const id = c[`${key}_power`];
    const p = Number.isFinite(w) ? formatPower(this._hass, Math.abs(w)) : { value: "–", unit: "" };
    return html`<button class="t panel ${f === "idle" ? "idle" : ""}" @click=${() => this.elementAction(id)} aria-label="${[label, dirText].filter(Boolean).join(", ")}: ${p.value} ${p.unit}">
      <span class="itile" style="--c:${col}">${icon(ic)}</span>
      <span class="hero">${p.value}${p.unit ? html`<span class="u">${p.unit}</span>` : nothing}</span>
      ${below.filter((b) => b && b !== nothing)}
    </button>`;
  }

  private bar(pct: number, colour: string, charging = false) {
    const v = Math.max(0, Math.min(100, pct));
    return html`<div class="bar ${charging ? "chg" : ""}"><div class="meter" style="--mc:${colour}"><i style="width:${v}%"></i></div><span class="sv">${Math.round(v)}%</span></div>`;
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
      // Importing is the usual case; only exporting is written out.
      const sub = [gridFlow === "out" ? "Exporting" : "", this.extra(c.grid_energy), this.extra(c.grid_cost)].filter(Boolean).join(" · ");
      tiles.push(this.tile("grid", this.t(c.grid_name, "Grid"), "grid", this.colour(c.grid_colour, "var(--tm-grid)"),
        { in: "Importing", out: "Exporting", idle: "Idle" }[gridFlow], gridFlow, gridW, sub ? html`<span class="sub">${sub}</span>` : nothing));
    }
    if (c.solar_power) {
      const w = this.power(c.solar_power);
      const on = Number.isFinite(w) && w >= idle;
      const sub = this.extra(c.solar_energy, " today");
      const col = this.colour(c.solar_colour, "var(--tm-solar)");
      // Output against the system's peak, when the peak is set.
      const peak = num(c.solar_peak) * 1000;
      const meter = peak > 0 && Number.isFinite(w) ? this.bar((Math.max(0, w) / peak) * 100, col) : nothing;
      tiles.push(this.tile("solar", this.t(c.solar_name, "Solar"), "solar", col,
        on ? "Generating" : "Idle", on ? "in" : "idle", w, meter, sub ? html`<span class="sub">${sub}</span>` : nothing));
    }
    let batteryCharging = false;
    if (c.battery_power) {
      const w = this.power(c.battery_power);
      const f = flow(w, c.battery_invert, idle);
      batteryCharging = f === "out";
      const soc = num(this.stateOf(c.battery_soc)?.state);
      const col = this.colour(c.battery_colour, "var(--tm-ok)");
      const barCol = soc < 15 ? "var(--tm-bad)" : soc < 30 ? "var(--tm-warn)" : col;
      const meter = c.battery_soc && Number.isFinite(soc) ? this.bar(soc, barCol, f === "out") : nothing;
      tiles.push(this.tile("battery", this.t(c.battery_name, "Battery"), "battery", col, { in: "Discharging", out: "Charging", idle: "Idle" }[f], f, w, meter));
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

    return this.shell(html`<div class="in en ${showImg ? "has-img" : ""}">
      <div class="side">${this.header(this.t(c.kicker, "Home energy"), this.t(c.name, "Energy"))}
      ${showImg ? html`<div class="img"><tm-fit .ratio=${this._ratio || 0.69}>
        <img src=${src} alt="" @load=${(e: Event) => { const i = e.target as HTMLImageElement; if (i.naturalHeight) this._ratio = i.naturalWidth / i.naturalHeight; }}>
        ${this.glow(c.battery_soc, batteryCharging)}</tm-fit></div>` : nothing}</div>
      <div class="tiles n${tiles.length}">${tiles}</div>
    </div>`);
  }
}

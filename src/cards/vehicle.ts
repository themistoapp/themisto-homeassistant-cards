import { css, html, nothing } from "lit";
import { ThemistoCard } from "../shared/base-card";
import { actions, appearance, choose, colour, editorFor, entity, numberField, section, textField, titleFields, grid, bool, type EditorSpec } from "../shared/editor";
import { measure } from "../shared/format";
import { icon } from "../shared/icons";
import { domainOf, isUnavailable, num, relativeTime } from "../shared/util";
import type { BaseConfig, HassEntity, HomeAssistant } from "../types";

const CHIP_SLOTS = ["level", "range", "odometer", "lock", "doors", "windows", "plugged", "location"] as const;
const CHIP_LABELS: Record<(typeof CHIP_SLOTS)[number], string> = { level: "Fuel / battery level", range: "Range", odometer: "Odometer", lock: "Lock", doors: "Doors", windows: "Windows", plugged: "Plugged in", location: "Location" };
type Hero = "level" | "range" | "odometer";
/** "updated" was a chip before 2.8; old configs may still list it, and it is ignored. */
type ChipSlot = (typeof CHIP_SLOTS)[number] | "updated";

export interface VehicleConfig extends BaseConfig {
  fuel_type?: "ice" | "ev" | "phev";
  level?: string;
  range?: string; odometer?: string;
  /** Which figure leads the card. auto = level if set, otherwise range. */
  primary?: "auto" | Hero;
  /** Range that counts as a full tank / battery, for the bar when range leads. */
  full_range?: number;
  /** Capacity for an absolute fuel/battery level such as litres or kWh, used to fill the bar. */
  level_capacity?: number;
  charging?: string; charging_power?: string; charge_limit?: string; time_to_full?: string; plugged?: string;
  lock?: string; doors?: string; windows?: string; location?: string; moving?: string; precondition?: string;
  image?: string; image_entity?: string; image_zoom?: number; image_offset_y?: number;
  chips?: ChipSlot[];
  show_updated?: boolean;
  /** Optional timestamp sensor for when the car last reported. Falls back to the level/range sensor's last change. */
  updated?: string;
  low_level?: number; critical_level?: number;
  level_colour?: string; low_colour?: string; critical_colour?: string; charging_colour?: string;
  charging_text?: string; parked_text?: string; driving_text?: string;
}

/** True for the many ways integrations say "charging". Exported for tests. */
export function isCharging(s?: HassEntity) {
  if (!s || isUnavailable(s)) return false;
  const v = s.state.toLowerCase();
  return v === "on" || v === "true" || v === "charging" || v === "charge" || v === "fast_charging";
}
const isOn = (s?: HassEntity) => !!s && s.state === "on";

/** Range as a percentage of a full tank. Exported for tests. */
export function levelFromRange(range: number, full?: number): number {
  if (!full || full <= 0 || !Number.isFinite(range)) return NaN;
  return Math.max(0, Math.min(100, Math.round((range / full) * 100)));
}

/**
 * Lock state from a lock entity, a lock binary_sensor (on = unlocked) or a text sensor such as
 * BMW's doors_lock ("LOCKED", "SECURED", "SELECTIVE_LOCKED", "UNLOCKED"). Exported for tests.
 */
export function lockState(s: HassEntity): "locked" | "partial" | "unlocked" {
  const d = domainOf(s.entity_id), v = s.state.toLowerCase();
  if (d === "lock") return v === "locked" ? "locked" : "unlocked";
  if (d === "binary_sensor") return v === "on" ? "unlocked" : "locked";
  if (/selective|partial/.test(v)) return "partial";
  return /^(locked|secured|double_?locked|closed)$/.test(v) ? "locked" : "unlocked";
}

/** Open/closed from a binary_sensor (on = open) or a text sensor ("OPEN", "CLOSED"). Exported for tests. */
export function isOpen(s: HassEntity): boolean {
  if (domainOf(s.entity_id) === "binary_sensor") return s.state === "on";
  const v = s.state.toLowerCase();
  return /open|ajar/.test(v) && !/closed|not/.test(v);
}

export class ThemistoVehicleCard extends ThemistoCard<VehicleConfig> {
  static override properties = { ...ThemistoCard.properties, _failed: { state: true } };
  /** Source that failed to load, so the icon shows instead of a broken image. */
  declare _failed?: string;
  static override presets = { compact: { columns: 6, rows: 3 }, standard: { columns: 6, rows: 5 }, large: { columns: 12, rows: 4 } };

  static override styles = [
    ...ThemistoCard.styles,
    css`
      .img { position: relative; flex: 1; min-height: 44px; display: grid; place-items: center; overflow: hidden; }
      .img img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; transform: translateY(var(--oy, 0)) scale(var(--zoom, 1)); filter: drop-shadow(0 10px 12px rgba(0,0,0,.25)); }
      .img::after { content: ""; position: absolute; left: 14%; right: 14%; bottom: 4%; height: 12px; border-radius: 50%; background: radial-gradient(closest-side, rgba(0,0,0,.28), transparent); z-index: -1; }
      .ph { width: 96px; height: 96px; border-radius: var(--tm-radius); display: grid; place-items: center; background: color-mix(in srgb, var(--c) 12%, transparent); color: var(--c); }
      .ph svg { width: 52px; height: 52px; stroke-width: 1.4; }
      .lv { position: relative; height: 6px; border-radius: 99px; background: var(--tm-line); flex: none; }
      .lv-f { position: absolute; inset: 0 auto 0 0; border-radius: inherit; background: var(--lc); transition: width .3s; }
      .lv-f.chg { background: repeating-linear-gradient(-45deg, var(--lc) 0 8px, color-mix(in srgb, var(--lc) 70%, #fff) 8px 16px); background-size: 22.6px 22.6px; animation: chg 1s linear infinite; }
      @keyframes chg { to { background-position: 22.6px 0; } }
      .lv-t { position: absolute; top: -3px; bottom: -3px; width: 2px; margin-left: -1px; border-radius: 99px; background: var(--tm-text); }
      .chips { display: flex; flex-wrap: wrap; gap: 6px; }
      .chips .chip { --cc: var(--tm-text-2); }
      .chips .chip span { overflow: hidden; text-overflow: ellipsis; }
      .chips .chip.loc { max-width: 18ch; }


      /*
       * One layout at every size:
       *   name ............ updated
       *   [ car ]   RANGE
       *   [ car ]   248 mi
       *   [ car ]   ▬▬▬▬▬▬▬▬
       *   [status] [chip] [chip] [chip]
       * Chips span the full width so they stay full size on small cards. On wide cards (520px+)
       * they move up under the bar, and the figure + chips sit centred beside the car.
       */
      .side { display: grid; grid-template-columns: var(--imgw, 48%) minmax(0, 1fr); column-gap: var(--gx, 16px); row-gap: var(--gy, 12px);
        grid-template-areas: "hd hd" "img lvl" "ch ch"; grid-template-rows: auto minmax(56px, 1fr) minmax(0, max-content); }
      .side > .hd { grid-area: hd; flex-wrap: nowrap; align-items: baseline; }
      .side > .hd > .titles { flex: 1 1 auto; }
      .side > .hd .upd { flex: none; white-space: nowrap; font: 400 var(--tm-fs-small)/1.3 var(--tm-body); }
      .side > .img { grid-area: img; height: 100%; min-height: 0; }
      .side > .lvl { grid-area: lvl; align-self: center; min-width: 0; }
      .side > .chips { grid-area: ch; position: relative; min-height: 0; overflow: hidden; align-content: flex-start; }

      .lvl { display: grid; gap: 6px; }
      .lvl .hero { padding-block: 0.04em; line-height: 1; overflow: hidden; text-overflow: ellipsis; }
      .lvl .lv { margin-top: 4px; }
      .lvl .sub { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

      /* Per size: image share, spacing, figure size. */
      .v-c { --imgw: 44%; --gx: 12px; --gy: 8px; }
      .v-c .hd .kick, .v-c .lvl > .label { display: none; }
      .v-c .lv { margin-top: 2px; }
      .v-s { --imgw: 50%; }
      .v-l { --imgw: 50%; --gx: 20px; }

      @container (min-width: 520px) {
        /* The reading takes the height it needs; the chips get the rest (and hide any that don't fit). */
        .side { grid-template-areas: "hd hd" "img lvl" "img ch"; grid-template-rows: auto auto minmax(0, 1fr); }
        .side > .lvl { align-self: end; }
        .side > .chips { align-self: stretch; }
      }
      @container (max-width: 360px) {
        .v-l, .v-s { --gx: 14px; }
        .side .ph { width: 44px; height: 44px; border-radius: var(--tm-radius-icon); } .side .ph svg { width: 26px; height: 26px; }
      }
      /* Half-width cards on a phone (~180px): updated drops under the name, figure shrinks to fit. */
      @container (max-width: 250px) {
        .side { --imgw: 44%; --gx: 10px; --gy: 8px; } .lvl .hero { --hero: var(--tm-fs-section-c); }
        .side > .hd { flex-wrap: wrap; row-gap: 2px; }
        .side > .hd > .titles { flex-basis: 100%; }
        .side .hd .kick, .side .lvl > .label { display: none; }
      }
    `,
  ];

  protected override validate(c: VehicleConfig) { if (!c.level && !c.range) throw new Error("Choose a fuel/battery level or a range entity"); }

  /** The figure that leads the card. */
  /** The one big figure. auto = level if set, otherwise range. */
  private hero(c: VehicleConfig): Hero {
    if (c.primary === "odometer" && c.odometer) return "odometer";
    return c.primary === "range" || (c.primary !== "level" && !c.level && !!c.range) ? "range" : "level";
  }
  protected watchedEntities() {
    const c = this._config;
    return c ? [c.level, c.range, c.odometer, c.charging, c.charging_power, c.charge_limit, c.time_to_full, c.plugged, c.lock, c.doors, c.windows, c.location, c.moving, c.precondition, c.image_entity, c.updated] : [];
  }

  static getConfigElement() { return editorFor(ThemistoVehicleCard); }
  static getStubConfig(hass: HomeAssistant) {
    const level = Object.keys(hass.states).find((e) => /fuel|battery_level|state_of_charge|soc/.test(e) && e.startsWith("sensor."));
    return { name: "Car", fuel_type: "ice", level: level || "sensor.car_fuel_level" };
  }
  static editor(_hass: HomeAssistant, c: Record<string, any>): EditorSpec {
    const ev = c.fuel_type === "ev" || c.fuel_type === "phev";
    return {
      schema: [
        ...titleFields(false),
        choose("fuel_type", [["ice", "Petrol / diesel"], ["ev", "Electric"], ["phev", "Plug-in hybrid"]]),
        section("Image", [textField("image"), entity("image_entity"), grid(numberField("image_zoom", 50, 200, 5, "%", "slider"), numberField("image_offset_y", -50, 50, 1, "%", "slider"))], { icon: "mdi:image-outline", expanded: true }),
        section("Levels", [entity("level", "sensor"), entity("range", "sensor"), entity("odometer", "sensor"),
          grid(choose("primary", [["auto", "Auto"], ["level", "Fuel / battery level"], ["range", "Range"], ["odometer", "Odometer"]]), numberField("full_range", 1, 2000, 1, "mi")),
          numberField("level_capacity", 1, 500, 1)], { icon: "mdi:gauge", expanded: true }),
        ...(ev ? [section("Charging", [entity("charging", ["binary_sensor", "sensor"]), entity("charging_power", "sensor"), entity("charge_limit", ["sensor", "number"]), entity("time_to_full", "sensor"), entity("plugged", ["binary_sensor", "sensor"])], { icon: "mdi:ev-station" })] : []),
        section("Security and location", [entity("lock", ["lock", "binary_sensor", "sensor"]), entity("doors", ["binary_sensor", "sensor"]), entity("windows", ["binary_sensor", "sensor"]), entity("location", ["device_tracker", "sensor"]), entity("moving", "binary_sensor"), entity("precondition", ["button", "switch", "input_boolean"])], { icon: "mdi:shield-car" }),
        section("Chips", [choose("chips", CHIP_SLOTS.map((k) => [k, CHIP_LABELS[k]] as [string, string]), { multiple: true, reorder: true, mode: "list" })], { icon: "mdi:label-multiple-outline" }),
        section("Last updated", [bool("show_updated"), entity("updated", "sensor")], { icon: "mdi:clock-outline" }),
        section("Status text", [grid(textField("parked_text"), textField("driving_text")), textField("charging_text")], { icon: "mdi:format-text" }),
        appearance(["compact", "standard", ["large", "Wide"]]),
        section("Colours", [grid(numberField("low_level", 0, 100, 1, "%"), numberField("critical_level", 0, 100, 1, "%")), grid(colour("level_colour"), colour("charging_colour")), grid(colour("low_colour"), colour("critical_colour"))], { icon: "mdi:palette" }),
        actions(),
      ],
      labels: {
        fuel_type: "Type", image: "Image URL", image_entity: "…or an entity with a picture", image_zoom: "Zoom", image_offset_y: "Move up/down",
        level: ev ? "Battery level (%)" : "Fuel level", range: "Range", primary: "Hero figure", full_range: "Range when full", level_capacity: "Level when full", odometer: "Odometer", charging: "Charging", charging_power: "Charging power", charge_limit: "Charge limit", time_to_full: "Time to full", plugged: "Plugged in",
        lock: "Lock", doors: "Doors", windows: "Windows", location: "Location", moving: "Driving / moving", precondition: "Pre-condition button",
        chips: "Chips to show (in this order)", show_updated: "Show when the car last reported", updated: "Last updated sensor (optional)",
        parked_text: "Parked", driving_text: "Driving", charging_text: "Charging",
        low_level: "Low below", critical_level: "Critical below", level_colour: "Level bar", charging_colour: "Charging", low_colour: "Low", critical_colour: "Critical",
      },
      helpers: {
        image: "A transparent PNG or WebP works best, e.g. https://themisto.app/home-assistant/cards/m140i.webp.",
        image_entity: "Any entity with a picture, e.g. the car's device tracker or an image entity. Used before the URL. With neither set, the location tracker's picture is used if it has one.",
        level: "Leave blank if your car only reports range.",
        full_range: "The range you'd see on a full tank or battery. With range as the main figure, the bar fills against this. Use the same unit as the range sensor.",
        level_capacity: "For a level sensor reported in litres or kWh, enter the full capacity to show a proportional bar. Percentage sensors do not need this.",
        lock: "A lock, a binary sensor, or a text sensor that says LOCKED / SECURED / UNLOCKED.",
        chips: "Leave empty for all of them. A chip only shows when its entity is set above, and the hero figure is never repeated as a chip.",
        charging_text: "Leave blank for \"Charging 7.2 kW\".",
        parked_text: "Leave blank to show no chip while parked.",
        updated: "A timestamp sensor, e.g. the car's last update. Without it, the time the range or level last changed is used.",
      },
    };
  }

  /** "Updated 4 min ago" under the name: from the timestamp sensor if set, else the level/range sensor. */
  private updatedLine() {
    const c = this._config!;
    if (c.show_updated === false) return nothing;
    const u = this.stateOf(c.updated);
    const iso = u && !isUnavailable(u) && !Number.isNaN(Date.parse(u.state)) ? u.state : this.stateOf(c.level || c.range)?.last_updated;
    return iso ? html`<span class="sub upd" title=${new Date(iso).toLocaleString()}>Updated ${relativeTime(iso)}</span>` : nothing;
  }

  private _clock?: number;
  private _chipRO?: ResizeObserver;
  override connectedCallback() {
    super.connectedCallback();
    this._clock = window.setInterval(() => this.requestUpdate(), 60_000);
    this._chipRO = new ResizeObserver(() => this.fitChips());
  }
  override disconnectedCallback() { super.disconnectedCallback(); clearInterval(this._clock); this._chipRO?.disconnect(); }
  protected override updated() {
    const box = this.renderRoot.querySelector<HTMLElement>(".side .chips");
    this._chipRO?.disconnect();
    if (box) { this._chipRO?.observe(box); this.fitChips(); }
  }
  /** Beside the car, chips that don't fully fit are hidden whole rather than cut in half. */
  private fitChips() {
    const box = this.renderRoot.querySelector<HTMLElement>(".side .chips");
    if (!box) return;
    const kids = [...box.children] as HTMLElement[];
    kids.forEach((k) => (k.style.visibility = ""));
    const max = box.clientHeight;
    kids.forEach((k) => { if (k.offsetTop + k.offsetHeight > max + 1) k.style.visibility = "hidden"; });
  }

  private chip(slot: ChipSlot) {
    const c = this._config!;
    const ent = slot === "updated" ? undefined : c[slot];
    if (slot === "updated") return nothing;
    if (slot === "plugged" && c.fuel_type === "ice") return nothing;
    const s = this.stateOf(ent);
    if (!ent || !s || isUnavailable(s)) return nothing;
    let ic = "entity", label = this.hass?.formatEntityState?.(s) ?? s.state, bad = false;
    let warn = false, title = label;
    if (slot === "level" || slot === "range" || slot === "odometer") {
      const m = measure(this._hass, s, { decimals: 0 });
      const ev = c.fuel_type === "ev" || c.fuel_type === "phev";
      ic = slot === "level" ? (ev ? "battery" : "fuel") : slot === "range" ? "gauge" : ev ? "van" : "car";
      label = `${m.value}${m.unit === "%" ? "%" : m.unit ? ` ${m.unit}` : ""}`;
      title = `${slot === "level" ? (ev ? "Battery" : "Fuel") : CHIP_LABELS[slot]} ${label}`;
    } else if (slot === "lock") {
      const st = lockState(s);
      ic = st === "locked" ? "lock" : "unlock"; label = { locked: "Locked", partial: "Partly locked", unlocked: "Unlocked" }[st];
      bad = st === "unlocked"; warn = st === "partial";
    } else if (slot === "doors") { bad = isOpen(s); ic = "door"; label = bad ? "Door open" : "Doors shut"; }
    else if (slot === "windows") { bad = isOpen(s); ic = "window"; label = bad ? "Window open" : "Windows shut"; }
    else if (slot === "plugged") { const p = isOn(s) || /plugged|connected/i.test(s.state) && !/not|un/i.test(s.state); ic = "plug"; label = p ? "Plugged in" : "Unplugged"; }
    else if (slot === "location") { ic = "pin"; }
    const fig = slot === "level" || slot === "range" || slot === "odometer";
    return html`<button class="chip ${slot === "location" ? "loc" : ""} ${fig ? "fig" : ""}" style=${bad ? "--cc:var(--tm-bad)" : warn ? "--cc:var(--tm-warn)" : ""} title=${title} @click=${() => this.elementAction(ent)}>${icon(ic)}<span>${label}</span></button>`;
  }

  override render() {
    const c = this._config!;
    const hero = this.hero(c);
    const byRange = hero === "range", byOdo = hero === "odometer";
    const heroId = c[hero];
    const lvl = this.stateOf(heroId);
    const ev = c.fuel_type === "ev" || c.fuel_type === "phev";
    const name = this.t(c.name, "Vehicle");
    const kicker = this.t(c.kicker, ev ? "Electric vehicle" : "Vehicle");
    // Entity picture first, then the URL, then the location tracker's own picture (BMW and others set one).
    const pic = (id?: string) => (id ? this.stateOf(id)?.attributes.entity_picture : undefined) as string | undefined;
    const imgSrc = pic(c.image_entity) || c.image?.trim() || pic(c.location);
    const showImg = !!imgSrc && this._failed !== imgSrc;
    const img = html`<div class="img" style="--zoom:${(c.image_zoom ?? 100) / 100};--oy:${c.image_offset_y ?? 0}%">${showImg
      ? html`<img src=${imgSrc} alt=${name} @error=${() => (this._failed = imgSrc)}>`
      : html`<div class="ph">${icon(c.icon, ev ? "van" : "car")}</div>`}</div>`;
    if (!lvl || isUnavailable(lvl)) {
      return this.shell(html`<div class="in">${this.cardLayout !== "compact" ? img : nothing}${this.header(kicker, name, html`<span class="chip"><i></i>Unavailable</span>`)}
        <div class="sub">${lvl ? `Last seen ${relativeTime(lvl.last_changed)}. Check the integration.` : `Entity not found: ${heroId}`}</div></div>`, { na: true, c: "var(--tm-idle)" });
    }
    const heroM = measure(this._hass, lvl, { decimals: 0 });
    const levelIsPercent = !byRange && !byOdo && (!lvl.attributes.unit_of_measurement || lvl.attributes.unit_of_measurement === "%");
    // Percentage for the bar and the low/critical colours. Range-led cards need "range when full" for this.
    const level = byOdo ? NaN : byRange ? levelFromRange(num(lvl.state), c.full_range) : levelIsPercent ? Math.round(num(lvl.state, 0)) : levelFromRange(num(lvl.state), c.level_capacity);
    const hasBar = Number.isFinite(level);
    const low = c.low_level ?? 30, crit = c.critical_level ?? 15;
    const charging = ev && isCharging(this.stateOf(c.charging));
    const lc = !hasBar ? this.colour(c.level_colour, "var(--tm-accent)") : level < crit ? this.colour(c.critical_colour, "var(--tm-bad)") : level < low ? this.colour(c.low_colour, "var(--tm-warn)")
      : charging ? this.colour(c.charging_colour, "var(--tm-ok)") : this.colour(c.level_colour, ev ? "var(--tm-ok)" : "var(--tm-accent)");
    const power = c.charging_power ? measure(this._hass, this.stateOf(c.charging_power)) : undefined;
    const moving = isOn(this.stateOf(c.moving));
    const [statusText, statusCol] = charging
      ? [this.t(c.charging_text, "Charging"), this.colour(c.charging_colour, "var(--tm-ok)")]
      : moving ? [this.t(c.driving_text, "Driving"), "var(--tm-accent)"]
      : hasBar && level < crit ? [`Low ${ev ? "battery" : "fuel"}`, "var(--tm-bad)"]
      : [this.t(c.parked_text, ""), "var(--tm-idle)"];
        const chip = statusText ? html`<span class="chip" style="--cc:${statusCol}">${charging ? icon("bolt") : html`<i></i>`}${statusText}${charging && !c.charging_text && power && power.value !== "–" ? html`<span class="more"> ${power.value} ${power.unit}</span>` : nothing}</span>` : nothing;
    const limit = c.charge_limit ? num(this.stateOf(c.charge_limit)?.state) : NaN;
    const ttf = c.time_to_full ? this.stateOf(c.time_to_full) : undefined;
    const ttfText = ttf && !isUnavailable(ttf) ? (this.hass?.formatEntityState?.(ttf) ?? ttf.state) : "";
    const heroLabel = byOdo ? "Odometer" : byRange ? "Range" : ev ? "Battery" : "Fuel";
    const levelT = html`<div class="lvl">
      <span class="label">${heroLabel}</span>
      <span class="hero">${byRange || byOdo || !levelIsPercent ? html`${heroM.value}${heroM.unit ? html`<span class="u">${heroM.unit}</span>` : nothing}` : html`${level}<span class="u">%</span>`}</span>
      ${hasBar ? html`<div class="lv" role="meter" aria-valuenow=${level} aria-valuemin="0" aria-valuemax="100" aria-label=${heroLabel}>
        <div class="lv-f ${charging ? "chg" : ""}" style="width:${level}%;--lc:${lc}"></div>
        ${Number.isFinite(limit) && !byRange ? html`<i class="lv-t" style="left:${limit}%" title="Charge limit ${limit}%"></i>` : nothing}</div>` : nothing}
      ${charging && (Number.isFinite(limit) || ttfText) ? html`<span class="sub">${[Number.isFinite(limit) ? `To ${Math.round(limit)}%` : "", ttfText].filter(Boolean).join(" · ")}</span>` : nothing}
    </div>`;
    // One hero, then the chosen chips (never repeating the hero).
    const chipList = (c.chips?.length ? c.chips : CHIP_SLOTS).filter((k) => k !== hero).map((k) => this.chip(k)).filter((x) => x !== nothing);
    const pre = c.precondition ? html`<button class="pbtn" @click=${() => (domainOf(c.precondition) === "button" ? this.call("button", "press", { entity_id: c.precondition }) : this.call("homeassistant", "toggle", { entity_id: c.precondition }))}>${isOn(this.stateOf(c.precondition)) ? "Pre-conditioning" : "Pre-condition"}</button>` : nothing;
    // The status (Charging / Driving / Low fuel) leads the chip row, in its colour.
    const chips = chipList.length || pre !== nothing || chip !== nothing ? html`<div class="chips">${chip}${chipList}${pre}</div>` : nothing;
    const head = html`<div class="hd"><div class="titles">${kicker ? html`<span class="kick">${kicker}</span>` : nothing}${name ? html`<span class="ttl">${name}</span>` : nothing}</div>${this.updatedLine()}</div>`;
    const size = { compact: "v-c", standard: "v-s", large: "v-l" }[this.cardLayout];
    return this.shell(html`<div class="in side ${size}">${head}${img}${levelT}${chips}</div>`, { c: lc });
  }

}

import { css, html, nothing } from "lit";
import "../components/tm-slider";
import { runAction } from "../shared/actions";
import { ThemistoCard } from "../shared/base-card";
import { actions, appearance, bool, colour, editorFor, list, numberField, section, textField, titleFields, entity, type EditorSpec } from "../shared/editor";
import { icon } from "../shared/icons";
import { brightnessPct, caps, defaultTemps, describeLight, presetDots, resolveRgb, type ColourPreset, type TempPreset } from "../shared/light";
import { clamp, friendlyName, isUnavailable } from "../shared/util";
import type { BaseConfig, HomeAssistant } from "../types";
import { fixture, fixtureStyles, hasFixture, lightTypeField, type LightType } from "../shared/fixture";

export interface LightConfig extends BaseConfig {
  entity: string;
  show_brightness?: boolean;
  show_temperature?: boolean;
  show_colours?: boolean;
  temperature_presets?: TempPreset[];
  colour_presets?: ColourPreset[];
  on_colour?: string;
  light_type?: LightType;
}

export const dotStyles = css`
  .dots { display: flex; gap: 8px; align-items: center; overflow-x: auto; scrollbar-width: none; padding: 2px; margin: -2px; flex: none; }
  .dots::-webkit-scrollbar { display: none; }
  .dots button { flex: none; }
  .dots button { width: 28px; height: 28px; border-radius: 50%; border: 2px solid transparent; box-shadow: inset 0 0 0 1px rgba(0,0,0,.08); }
  .dots button[aria-pressed="true"] { border-color: var(--tm-text); box-shadow: inset 0 0 0 2px var(--tm-solid); }
  .dots .gap { width: 1px; height: 18px; background: var(--tm-line); margin: 0 2px; }
  .lamp { --c: var(--tm-muted); }
  .lamp.on { background: var(--lamp); color: var(--lamp-ink); box-shadow: 0 4px 16px color-mix(in srgb, var(--lamp) 45%, transparent); }
`;

export class ThemistoLightCard extends ThemistoCard<LightConfig> {
  static override presets = { compact: { columns: 3, rows: 2 }, standard: { columns: 6, rows: 4 } };
  static override properties = { ...ThemistoCard.properties, _drag: { state: true } };
  declare _drag?: number;
  private _hold?: { v: number; until: number };

  static override styles = [
    ...ThemistoCard.styles,
    dotStyles,
    fixtureStyles,
    css`
      ha-card { --lamp: var(--tm-on); --lamp-ink: var(--tm-on-ink); }
      .tile { cursor: pointer; touch-action: pan-y; user-select: none; -webkit-user-select: none; }
      .tile .in { justify-content: space-between; z-index: 1; }
      .fill { position: absolute; inset: 0 auto 0 0; background: color-mix(in srgb, var(--lamp) 22%, transparent); transition: width .15s; z-index: 0; }
      .tile.drag .fill { transition: none; }
      .tile.on { border-color: color-mix(in srgb, var(--lamp) 40%, var(--tm-line)); }
      .tile.on.nodim { background: color-mix(in srgb, var(--lamp) 14%, var(--tm-read)); }
      /* Power: a quiet outlined button; on, it takes a soft tint of the light's colour. */
      .tog { border-color: var(--tm-line-strong); color: var(--tm-text-2); }
      .tog.on { background: color-mix(in srgb, var(--lamp) 16%, transparent); border-color: color-mix(in srgb, var(--lamp) 55%, transparent); color: var(--tm-text); }
      .read { display: grid; gap: 2px; }
      .hd { flex-wrap: nowrap; }
      tm-slider { --slider-color: var(--lamp); }
      @container (max-width: 120px) { .tile .sub { display: none; } }
      /* On phone-width cards a long name wraps to two lines rather than being cut. */
      @container (max-width: 260px) { .hd .ttl { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; } }

      /* Fixture picture: the opening lights up in the light's colour, brighter with brightness. */
      .rd { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; min-width: 0; }
      .rd .read { min-width: 0; }
      .rd .fx { align-self: flex-end; }
      @container (max-width: 240px) { .rd .fx { display: none; } }
    `,
  ];

  protected override validate(c: LightConfig) {
    if (!c.entity) throw new Error("Choose a light entity");
  }
  protected watchedEntities() { return [this._config?.entity]; }

  static getConfigElement() { return editorFor(ThemistoLightCard); }
  static getStubConfig(hass: HomeAssistant) {
    return { entity: Object.keys(hass.states).find((e) => e.startsWith("light.")) || "light.example" };
  }
  static editor(_hass: HomeAssistant, _c: Record<string, any>): EditorSpec {
    return {
      schema: [
        entity("entity", "light"),
        ...titleFields(),
        section("Controls", [bool("show_brightness"), bool("show_temperature"), bool("show_colours")], { icon: "mdi:tune-variant" }),
        section("Presets", [
          list("temperature_presets", { kelvin: { ...numberField("kelvin", 1500, 9000, 100, "K"), label: "Colour temperature", required: true }, name: { ...textField("name"), label: "Name" } }, "name", "kelvin"),
          list("colour_presets", { color: { ...colour("color"), label: "Colour", required: true }, name: { ...textField("name"), label: "Name" } }, "name", "color"),
        ], { icon: "mdi:palette" }),
        appearance(["compact", "standard"], [lightTypeField(), colour("on_colour")]),
        actions(),
      ],
      labels: { show_brightness: "Brightness slider", show_temperature: "Colour temperature presets", show_colours: "Colour presets", temperature_presets: "Colour temperature presets", colour_presets: "Colour presets", on_colour: "Colour when on", light_type: "Light type" },
      helpers: { temperature_presets: "Leave empty to use common white points the light supports.", show_brightness: "Only shown if the light can dim.", light_type: "Shows a picture of the fitting, lit in the light's colour and brightness." },
    };
  }

  private bri(s: Parameters<typeof brightnessPct>[0]) {
    if (this._drag !== undefined) return this._drag;
    if (this._hold && Date.now() < this._hold.until) return this._hold.v;
    return brightnessPct(s);
  }

  private setBrightness(v: number) {
    const entity_id = this._config!.entity;
    if (v <= 0) this.call("light", "turn_off", { entity_id });
    else this.call("light", "turn_on", { entity_id, brightness_pct: v });
  }

  private tap() {
    const c = this._config!;
    runAction(this, { entity: c.entity, tap_action: c.tap_action || { action: "toggle" } }, "tap");
  }

  /** Compact tile: tap toggles, holding opens more-info, horizontal drag dims. */
  private tileDown(e: PointerEvent) {
    const s = this.stateOf(this._config!.entity);
    if (!s || isUnavailable(s) || e.button !== 0) return;
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const x0 = e.clientX, y0 = e.clientY, b0 = brightnessPct(s);
    const dim = caps(s).dimmable && this._config!.show_brightness !== false;
    let dragging = false, last = 0;
    const holdTimer = window.setTimeout(() => {
      dragging = true; // swallow the click
      runAction(this, { entity: this._config!.entity, hold_action: this._config!.hold_action || { action: "more-info" } }, "hold");
    }, 500);
    const move = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8) clearTimeout(holdTimer);
      if (!dim) return;
      if (!dragging && Math.abs(ev.clientX - x0) > 8 && Math.abs(ev.clientX - x0) > Math.abs(ev.clientY - y0)) {
        dragging = true; el.setPointerCapture(ev.pointerId); el.classList.add("drag");
      }
      if (!dragging) return;
      this._drag = clamp(Math.round(b0 + ((ev.clientX - x0) / rect.width) * 100), 0, 100);
      if (Date.now() - last > 250) { last = Date.now(); this.setBrightness(this._drag); }
    };
    const up = () => {
      clearTimeout(holdTimer);
      el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up);
      el.classList.remove("drag");
      if (this._drag !== undefined) {
        const v = this._drag;
        this._hold = { v, until: Date.now() + 1500 };
        this._drag = undefined;
        this.setBrightness(v);
        setTimeout(() => this.requestUpdate(), 1550);
      } else if (!dragging) this.tap();
    };
    el.addEventListener("pointermove", move); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
  }

  override render() {
    const c = this._config!, s = this.stateOf(c.entity);
    const name = this.t(c.name, friendlyName(s, c.entity));
    if (!s) return this.unavailable(name, `Entity not found: ${c.entity}`, icon("bulb"));
    const na = isUnavailable(s);
    const cap = caps(s);
    const bri = this.bri(s);
    const on = cap.dimmable ? bri > 0 : s.state === "on";
    const lamp = c.on_colour ? `--lamp:${this.colour(c.on_colour, "var(--tm-on)")};--lamp-ink:#1b1400` : "";
    const status = na ? "Unavailable" : !on ? "Off" : cap.dimmable ? `${bri}%` : "On";

    if (this.cardLayout === "compact") {
      return html`<ha-card class="tm tile ${on ? "on" : ""} ${cap.dimmable ? "" : "nodim"} ${na ? "na" : ""} ${c.glass === false ? "" : "glass"}" data-l="compact" style=${lamp}
        role="button" tabindex="0" aria-label="${name}, ${status}" @pointerdown=${this.tileDown} @contextmenu=${(e: Event) => e.preventDefault()}
        @keydown=${(e: KeyboardEvent) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), this.tap())}>
        ${cap.dimmable ? html`<div class="fill" style="width:${on ? bri : 0}%"></div>` : nothing}
        <div class="in">${hasFixture(c.light_type) ? fixture(c.light_type, s, { w: 44, h: 34 }, c.on_colour && this.colour(c.on_colour, "")) : html`<span class="itile sm lamp ${on ? "on" : ""}">${icon(c.icon, "bulb")}</span>`}
          <div style="min-width:0"><div class="nm">${name}</div><div class="sub">${status}</div></div></div>
      </ha-card>`;
    }

    const temps = c.show_temperature !== false && cap.temperature ? (c.temperature_presets?.length ? c.temperature_presets : defaultTemps(cap.minK, cap.maxK)) : [];
    const colours = c.show_colours !== false && cap.colour ? c.colour_presets || [] : [];
    const kicker = this.t(c.kicker, "Light");
    return this.shell(html`<div class="in" style="justify-content:space-between">
      ${this.header(kicker, name, html`<button class="rbtn tog ${on ? "on" : ""}" ?disabled=${na} aria-label="Toggle ${name}" @click=${() => this.call("light", "toggle", { entity_id: c.entity })}>${icon("power")}</button>`)}
      <div class="rd"><div class="read"><span class="hero">${na ? "–" : !on ? "Off" : cap.dimmable ? `${bri}%` : "On"}</span><span class="sub">${na ? "Unavailable" : on ? describeLight(s) : "Tap the button to turn on"}</span></div>${fixture(c.light_type, s, { w: 110, h: 84 }, c.on_colour && this.colour(c.on_colour, ""))}</div>
      ${cap.dimmable && c.show_brightness !== false ? html`<tm-slider .value=${bri} min="0" max="100" icon="bulb" label="Brightness" ?disabled=${na}
        @value-changed=${(e: CustomEvent) => this.setBrightness(e.detail.value)}></tm-slider>` : nothing}
      ${na ? nothing : presetDots(s, temps, colours,
        (k) => this.call("light", "turn_on", { entity_id: c.entity, color_temp_kelvin: k }),
        (col) => { const rgb = resolveRgb(this, col); if (rgb) this.call("light", "turn_on", { entity_id: c.entity, rgb_color: rgb }); })}
    </div>`, { cls: on ? "on" : "", na, style: lamp });
  }
}

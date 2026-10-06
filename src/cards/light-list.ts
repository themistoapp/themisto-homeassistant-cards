import { css, html, nothing } from "lit";
import "../components/tm-slider";
import { runAction } from "../shared/actions";
import { ThemistoCard } from "../shared/base-card";
import { actions, appearance, bool, choose, colour, editorFor, iconField, list, entity, textField, grid, type EditorSpec } from "../shared/editor";
import type { GridOptions } from "../shared/grid";
import { icon } from "../shared/icons";
import { brightnessPct, caps, defaultTemps, describeLight, presetDots, resolveRgb, type ColourPreset } from "../shared/light";
import { friendlyName, isUnavailable } from "../shared/util";
import type { BaseConfig, HassEntity, HomeAssistant } from "../types";
import { dotStyles } from "./light";
import { fixture, fixtureStyles, hasFixture, lightTypeField, type LightType } from "../shared/fixture";

interface Row { entity: string; name?: string; icon?: string; light_type?: LightType }
export interface LightListConfig extends BaseConfig {
  lights: (Row | string)[];
  show_all_off?: boolean;
  sort?: "config" | "on_first" | "name";
  hide_unavailable?: boolean;
  columns?: "auto" | "1" | "2";
  colour_presets?: ColourPreset[];
  on_colour?: string;
  light_type?: LightType;
}

export class ThemistoLightListCard extends ThemistoCard<LightListConfig> {
  static override presets = { standard: { columns: 6, rows: "auto" as const } };
  static override properties = { ...ThemistoCard.properties, _open: { state: true } };
  declare _open?: string;
  // Survives re-renders between pointerdown and click (HA can push state in between).
  private _press: { timer?: number; held: boolean } = { held: false };

  static override styles = [
    ...ThemistoCard.styles,
    dotStyles,
    fixtureStyles,
    css`
      ha-card { --lamp: var(--tm-on); --lamp-ink: var(--tm-on-ink); }
      .rows { display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; }
      @container (min-width: 480px) { .rows.c-auto, .rows.c-2 { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; } }
      .r.open { border-color: var(--tm-line-strong); }
      .main { display: flex; align-items: center; gap: 10px; height: 44px; padding: 0 8px; cursor: pointer; user-select: none; -webkit-user-select: none; }
      .r.na { opacity: .55; } .r.na .main { cursor: default; }
      .chev { color: var(--tm-muted); transition: transform .15s; display: grid; } .chev svg { width: 16px; height: 16px; }
      .r.open .chev { transform: rotate(180deg); }
      .exp { display: grid; gap: 10px; padding: 2px 10px 12px; }
      .sw.on { --on: var(--lamp); }
      ha-card[style*="--lamp"] .sw.on { --on-knob: #fff; }
      tm-slider { --slider-color: var(--lamp); }
      .slot { display: grid; place-items: center; width: 34px; height: 34px; flex: none; }
      @container (max-width: 230px) { .main .itile, .main .slot { display: none; } .main { gap: 6px; padding: 0 6px 0 10px; } .chev { display: none; } }
    `,
  ];

  private rows(): Row[] {
    return (this._config?.lights || []).map((r) => (typeof r === "string" ? { entity: r } : r)).filter((r) => r?.entity);
  }

  protected override validate(c: LightListConfig) {
    if (!Array.isArray(c.lights) || !c.lights.length) throw new Error("Add at least one light");
  }
  protected watchedEntities() { return this.rows().map((r) => r.entity); }

  override getGridOptions(): GridOptions { return { columns: 6, rows: "auto", min_columns: 4 }; }
  override getCardSize() { return 1 + Math.ceil((this.rows().length * 50) / 64); }

  static getConfigElement() { return editorFor(ThemistoLightListCard); }
  static getStubConfig(hass: HomeAssistant) {
    return { name: "Lights", lights: Object.keys(hass.states).filter((e) => e.startsWith("light.")).slice(0, 4).map((entity) => ({ entity })) };
  }
  static editor(): EditorSpec {
    return {
      schema: [
        grid(textField("name"), textField("kicker")),
        list("lights", { entity: { ...entity("entity", "light"), label: "Light", required: true }, name: { ...textField("name"), label: "Name" }, icon: { ...iconField(), label: "Icon" }, light_type: { ...lightTypeField(), label: "Light type" } }, "name", "entity"),
        { type: "expandable", name: "", flatten: true, title: "Options", icon: "mdi:tune-variant", schema: [
          bool("show_all_off"),
          grid(choose("sort", [["config", "As listed"], ["on_first", "On first"], ["name", "By name"]]), choose("columns", [["auto", "Auto"], ["1", "One"], ["2", "Two (wide cards)"]])),
          bool("hide_unavailable"),
          list("colour_presets", { color: { ...colour("color"), label: "Colour", required: true }, name: { ...textField("name"), label: "Name" } }, "name", "color"),
        ] },
        appearance([], [lightTypeField(), colour("on_colour")]),
        actions(),
      ],
      labels: { lights: "Lights", show_all_off: "Show All off button", sort: "Order", columns: "Columns", hide_unavailable: "Hide unavailable lights", colour_presets: "Colour presets (for colour lights)", on_colour: "Colour when on", light_type: "Light type (all rows)" },
      helpers: { lights: "Tap a dimmable row to open brightness and colour controls. Rows that can't dim just switch on and off." },
    };
  }

  private rowTemplate(r: Row, s: HassEntity | undefined) {
    const c = this._config!;
    const na = !s || isUnavailable(s);
    const cap = caps(s);
    const on = !na && s!.state === "on";
    const canOpen = !na && (cap.dimmable || cap.temperature || cap.colour);
    const open = canOpen && this._open === r.entity;
    const name = r.name || friendlyName(s, r.entity);
    const type = r.light_type && r.light_type !== "none" ? r.light_type : r.light_type === "none" ? undefined : c.light_type;
    const sub = na ? "Unavailable" : !on ? "Off" : cap.dimmable ? `${brightnessPct(s)}%${s!.attributes.color_mode === "color_temp" ? ` · ${describeLight(s!).split(" · ")[0]}` : ""}` : "On";
    const toggle = (e?: Event) => { e?.stopPropagation(); this.call("light", "toggle", { entity_id: r.entity }); };
    const h = this._press;
    const down = () => { h.held = false; h.timer = window.setTimeout(() => { h.held = true; runAction(this, { entity: r.entity, hold_action: { action: "more-info" } }, "hold"); }, 500); };
    const up = () => clearTimeout(h.timer);
    const tap = () => { if (h.held || na) return; if (canOpen) this._open = open ? undefined : r.entity; else toggle(); };
    return html`<div class="r panel ${open ? "open" : ""} ${na ? "na" : ""}">
      <div class="main" data-own role="button" tabindex="0" aria-expanded=${canOpen ? String(open) : nothing} @pointerdown=${down} @pointerup=${up} @pointerleave=${up} @click=${tap}
        @keydown=${(e: KeyboardEvent) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), tap())} @contextmenu=${(e: Event) => e.preventDefault()}>
        ${hasFixture(type) && !na ? html`<span class="slot">${fixture(type, s, { w: 34, h: 32 }, c.on_colour && this.colour(c.on_colour, ""))}</span>` : html`<span class="itile sm lamp ${on ? "on" : ""}">${icon(r.icon, "bulb")}</span>`}
        <div class="sp"><div class="nm">${name}</div><div class="sub">${sub}</div></div>
        ${canOpen ? html`<span class="chev">${icon("chevron")}</span>` : nothing}
        <button class="sw ${on ? "on" : ""}" role="switch" aria-checked=${on} aria-label="Toggle ${name}" ?disabled=${na} @click=${toggle}><i></i></button>
      </div>
      ${open ? html`<div class="exp">
        ${cap.dimmable ? html`<tm-slider .value=${brightnessPct(s)} min="0" max="100" icon="bulb" label="Brightness"
          @value-changed=${(e: CustomEvent) => (e.detail.value > 0 ? this.call("light", "turn_on", { entity_id: r.entity, brightness_pct: e.detail.value }) : this.call("light", "turn_off", { entity_id: r.entity }))}></tm-slider>` : nothing}
        ${presetDots(s!, cap.temperature ? defaultTemps(cap.minK, cap.maxK) : [], cap.colour ? c.colour_presets || [] : [],
          (k) => this.call("light", "turn_on", { entity_id: r.entity, color_temp_kelvin: k }),
          (col) => { const rgb = resolveRgb(this, col); if (rgb) this.call("light", "turn_on", { entity_id: r.entity, rgb_color: rgb }); })}
      </div>` : nothing}
    </div>`;
  }

  override render() {
    const c = this._config!;
    let rows = this.rows().map((r) => ({ r, s: this.stateOf(r.entity) }));
    if (c.hide_unavailable) rows = rows.filter(({ s }) => s && !isUnavailable(s));
    if (c.sort === "name") rows.sort((a, b) => (a.r.name || friendlyName(a.s, a.r.entity)).localeCompare(b.r.name || friendlyName(b.s, b.r.entity)));
    if (c.sort === "on_first") rows.sort((a, b) => Number(b.s?.state === "on") - Number(a.s?.state === "on"));
    const avail = rows.filter(({ s }) => s && !isUnavailable(s));
    const nOn = avail.filter(({ s }) => s!.state === "on").length;
    const kicker = this.t(c.kicker, "Lights"), title = this.t(c.name, "");
    const allOff = c.show_all_off !== false ? html`<button class="pbtn" ?disabled=${!nOn} @click=${() => this.call("light", "turn_off", { entity_id: avail.filter(({ s }) => s!.state === "on").map(({ r }) => r.entity) })}>All off</button>` : nothing;
    return this.shell(html`<div class="in">
      ${kicker || title || allOff !== nothing ? this.header(kicker, title, allOff) : nothing}
      <div class="rows c-${c.columns || "auto"}">${rows.map(({ r, s }) => this.rowTemplate(r, s))}</div>
    </div>`, { style: c.on_colour ? `--lamp:${this.colour(c.on_colour, "var(--tm-on)")};--lamp-ink:#1b1400` : "" });
  }
}

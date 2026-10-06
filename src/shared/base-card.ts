import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from "lit";
import type { BaseConfig, HassEntity, HomeAssistant } from "../types";
import { gestures, runAction, type ActionSet } from "./actions";
import { gridOptionsFor, layoutForHeight, resolveLayout, type Concrete, type GridOptions, type Presets } from "./grid";
import { base, tokens } from "./styles";
import { cssColour, text } from "./util";

/**
 * Shared engine for every Themisto card.
 *
 * - `hass` updates only re-render when one of `watchedEntities()` changed (HA pushes a new hass
 *   object for every state change in the house), and Lit then patches only what differs. That
 *   is what keeps sliders, open menus, focus and hover alive.
 * - `layout: auto` follows the card's measured height via ResizeObserver.
 * - Light/dark mirrors hass.themes.darkMode onto the `dark` attribute.
 */
export abstract class ThemistoCard<C extends BaseConfig = BaseConfig> extends LitElement {
  static override styles = [tokens, base];
  static override properties = { _config: { state: true }, _tick: { state: true }, _auto: { state: true } };

  declare _config?: C;
  declare _tick: number;
  declare _auto: Concrete;
  protected _hass?: HomeAssistant;
  private _ro?: ResizeObserver;
  protected cardGestures = gestures(() => this.cardActions(), () => this);

  /** Grid presets for this card type (columns × rows per layout). */
  static presets: Presets = { standard: { columns: 6, rows: 4 } };

  constructor() {
    super();
    this._tick = 0;
    this._auto = "standard";
  }

  setConfig(config: C) {
    if (!config) throw new Error("Invalid configuration");
    this.validate(config);
    const presets = (this.constructor as typeof ThemistoCard).presets;
    this._config = { ...config, layout: resolveLayout(presets, config.layout) };
  }

  /** Throw a readable Error for a config the card can't use. */
  protected validate(_config: C) {}

  /** Entities whose changes should re-render this card. */
  protected abstract watchedEntities(): (string | undefined)[];

  set hass(hass: HomeAssistant) {
    const old = this._hass;
    this._hass = hass;
    const dark = !!hass.themes?.darkMode;
    if (this.hasAttribute("dark") !== dark) this.toggleAttribute("dark", dark);
    if (!old || this.changed(old, hass)) this._tick++;
  }
  get hass(): HomeAssistant | undefined { return this._hass; }

  protected changed(old: HomeAssistant, hass: HomeAssistant) {
    if (old.themes?.darkMode !== hass.themes?.darkMode || old.locale !== hass.locale) return true;
    return this.watchedEntities().some((e) => e && old.states[e] !== hass.states[e]);
  }

  stateOf(id?: string): HassEntity | undefined {
    return id ? this._hass?.states[id] : undefined;
  }

  /**
   * HA assigns `layout` ("grid", "panel"…) to cards it places in a view. It must stay a plain
   * writable property: a read-only getter here throws in strict mode and HA drops the card.
   */
  layout?: string;

  /** The layout actually rendered: the configured one, or the measured one for `auto`. */
  get cardLayout(): Concrete {
    const l = this._config?.layout;
    return !l || l === "auto" || l === "wide" || l === "tall" ? this._auto : l;
  }

  getCardSize() {
    const p = (this.constructor as typeof ThemistoCard).presets[this.cardLayout];
    return typeof p?.rows === "number" ? p.rows : 4;
  }

  getGridOptions(): GridOptions {
    return gridOptionsFor((this.constructor as typeof ThemistoCard).presets, this._config?.layout);
  }

  override connectedCallback() {
    super.connectedCallback();
    this._ro = new ResizeObserver(([entry]) => {
      if (this._config?.layout && this._config.layout !== "auto") return;
      const next = layoutForHeight((this.constructor as typeof ThemistoCard).presets, entry.contentRect.height, entry.contentRect.width);
      if (next !== this._auto) this._auto = next;
    });
    this._ro.observe(this);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._ro?.disconnect();
  }

  protected override shouldUpdate(_changed: PropertyValues) {
    return !!this._config && !!this._hass;
  }

  // ---- helpers for card templates ----

  /** Override rule: blank → default, whitespace → hidden. */
  t(override: string | undefined, fallback: string) { return text(override, fallback); }

  colour(value: string | undefined, fallback: string) { return cssColour(value, fallback); }

  cardActions(): ActionSet {
    const c = this._config as BaseConfig & { entity?: string };
    return { entity: c?.entity, tap_action: c?.tap_action, hold_action: c?.hold_action, double_tap_action: c?.double_tap_action };
  }

  get hasCardAction() {
    const a = this.cardActions();
    return [a.tap_action, a.hold_action, a.double_tap_action].some((x) => x && x.action !== "none");
  }

  /** Runs an element-level action (chips, stats) with more-info as the default. */
  elementAction(entity: string | undefined, action?: ActionSet["tap_action"]) {
    if (!entity && !action) return;
    runAction(this, { entity, tap_action: action || { action: "more-info" } }, "tap");
  }

  call(domain: string, service: string, data: Record<string, unknown>) {
    return this._hass?.callService(domain, service, data);
  }

  /** Header used by most cards: kicker over title, with an optional chip on the right. */
  header(kicker: string, title: string, right?: unknown): TemplateResult {
    return html`<div class="hd">
      <div class="titles">${kicker ? html`<span class="kick">${kicker}</span>` : nothing}${title ? html`<span class="ttl">${title}</span>` : nothing}</div>
      ${right ?? nothing}
    </div>`;
  }

  /**
   * Card shell. Card-level tap/hold/double-tap actions apply to the background only, so inner
   * controls (sliders, buttons) keep their own behaviour.
   */
  shell(body: unknown, opts: { cls?: string; c?: string; na?: boolean; style?: string } = {}): TemplateResult {
    const g = this.cardGestures;
    const act = this.hasCardAction;
    // Ignore gestures that start on a control (buttons, sliders, rows with their own handling).
    const own = (e: Event) => !e.composedPath().some((n) => n instanceof HTMLElement && n !== e.currentTarget && n.matches?.("button, a, input, select, [role=slider], [data-own]"));
    return html`<ha-card class="tm ${this._config?.glass === false ? "" : "glass"} ${opts.cls || ""} ${opts.na ? "na" : ""} ${act ? "actionable" : ""}"
      data-l=${this.cardLayout} style=${`${opts.c ? `--c:${opts.c};` : ""}${opts.style || ""}`}
      @pointerdown=${(e: PointerEvent) => act && own(e) && g.down(e)} @pointermove=${g.move} @pointerup=${g.up} @pointercancel=${g.cancel}
      @click=${(e: Event) => act && own(e) && g.click(e)} @contextmenu=${g.context}>${body}</ha-card>`;
  }

  /** Standard "entity missing / unavailable" body. */
  unavailable(title: string, message: string, iconT: TemplateResult): TemplateResult {
    return this.shell(html`<div class="in" style="justify-content:center">
      <div class="row"><span class="itile" style="--c:var(--tm-idle)">${iconT}</span><div class="sp"><div class="nm">${title}</div><div class="sub">${message}</div></div></div></div>`, { na: true });
  }
}

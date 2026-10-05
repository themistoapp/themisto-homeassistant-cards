import { LitElement, html, nothing } from "lit";
import type { HomeAssistant } from "../types";
import { ICON_NAMES } from "./icons";
import { cap, fireEvent } from "./util";

export type Schema = Record<string, any>;
export interface EditorSpec { schema: Schema[]; labels?: Record<string, string>; helpers?: Record<string, string> }
export interface EditableCard { editor(hass: HomeAssistant, config: Record<string, any>): EditorSpec }

// ---- schema builders (HA ha-form / selector shapes) ----
export const section = (title: string, schema: Schema[], opts: { icon?: string; expanded?: boolean } = {}): Schema =>
  ({ type: "expandable", name: "", flatten: true, title, icon: opts.icon, expanded: opts.expanded, schema });
export const grid = (...schema: Schema[]): Schema => ({ type: "grid", name: "", schema });
export const entity = (name: string, domain?: string | string[], extra: Record<string, unknown> = {}): Schema =>
  ({ name, selector: { entity: { ...(domain ? { filter: { domain } } : {}), ...extra } } });
export const entities = (name: string, domain?: string | string[]): Schema =>
  ({ name, selector: { entity: { multiple: true, ...(domain ? { filter: { domain } } : {}) } } });
export const textField = (name: string): Schema => ({ name, selector: { text: {} } });
export const numberField = (name: string, min: number, max: number, step = 1, unit?: string, mode: "box" | "slider" = "box"): Schema =>
  ({ name, selector: { number: { min, max, step, mode, ...(unit ? { unit_of_measurement: unit } : {}) } } });
export const bool = (name: string): Schema => ({ name, selector: { boolean: {} } });
export const colour = (name: string): Schema => ({ name, selector: { ui_color: { include_none: true } } });
export const action = (name: string): Schema => ({ name, selector: { ui_action: {} } });
export const choose = (name: string, options: (string | [string, string])[], extra: Record<string, unknown> = {}): Schema =>
  ({ name, selector: { select: { mode: "dropdown", options: options.map((o) => (Array.isArray(o) ? { value: o[0], label: o[1] } : { value: o, label: cap(o.replace(/_/g, " ")) })), ...extra } } });
export const iconField = (name = "icon"): Schema => choose(name, ICON_NAMES, { custom_value: true });
export const list = (name: string, fields: Record<string, Schema & { label?: string; required?: boolean }>, labelField?: string, descField?: string): Schema =>
  ({ name, selector: { object: { multiple: true, label_field: labelField, description_field: descField, fields } } });

/** Name + label-above-title + icon, used by every card. */
export const titleFields = (withIcon = true): Schema[] => [grid(textField("name"), textField("kicker")), ...(withIcon ? [iconField()] : [])];

export const appearance = (layouts: (string | [string, string])[], extra: Schema[] = []): Schema =>
  section("Appearance", [grid(choose("layout", ["auto", ...layouts]), bool("glass")), ...extra], { icon: "mdi:palette-outline" });

export const actions = (): Schema =>
  section("Actions", [action("tap_action"), action("hold_action"), action("double_tap_action")], { icon: "mdi:gesture-tap" });

export const COMMON_LABELS: Record<string, string> = {
  name: "Title", kicker: "Label above title", icon: "Icon", entity: "Entity", layout: "Size", glass: "Frosted glass background",
  accent: "Accent colour", tap_action: "Tap", hold_action: "Hold", double_tap_action: "Double tap",
};
export const COMMON_HELPERS: Record<string, string> = {
  name: "Leave blank for the default. A single space hides it.",
  kicker: "Leave blank for the default. A single space hides it.",
  layout: "Auto picks a layout from the card's height in the grid.",
};

/**
 * Generic editor: HA's ha-form with a schema the card builds from the live hass state.
 * Lit patches the form in place, so typing never loses focus.
 */
export class ThemistoEditor extends LitElement {
  static override properties = { hass: { attribute: false }, _config: { state: true } };
  declare hass?: HomeAssistant;
  declare _config?: Record<string, any>;
  card!: EditableCard;

  setConfig(config: Record<string, any>) { this._config = config; }

  override async connectedCallback() {
    super.connectedCallback();
    // ha-form and the selectors are lazy-loaded by HA; loading a core card's editor pulls them in.
    if (!customElements.get("ha-form") || !customElements.get("hui-action-editor")) {
      const helpers = await (window as any).loadCardHelpers?.();
      const card = await helpers?.createCardElement({ type: "tile", entity: "sun.sun" });
      await card?.constructor?.getConfigElement?.();
      this.requestUpdate();
    }
  }

  private changed(e: CustomEvent) {
    e.stopPropagation();
    const config = { ...e.detail.value };
    for (const k of Object.keys(config)) if (config[k] === undefined || config[k] === null) delete config[k];
    this._config = config;
    fireEvent(this, "config-changed", { config });
  }

  override render() {
    if (!this.hass || !this._config || !this.card) return nothing;
    const spec = this.card.editor(this.hass, this._config);
    const labels = { ...COMMON_LABELS, ...spec.labels };
    const helpers = { ...COMMON_HELPERS, ...spec.helpers };
    return html`<ha-form .hass=${this.hass} .data=${this._config} .schema=${spec.schema}
      .computeLabel=${(s: Schema) => labels[s.name] ?? s.label ?? cap(String(s.name || "").replace(/_/g, " "))}
      .computeHelper=${(s: Schema) => helpers[s.name]}
      @value-changed=${this.changed}></ha-form>`;
  }
}
if (!customElements.get("themisto-card-editor")) customElements.define("themisto-card-editor", ThemistoEditor);

export function editorFor(card: EditableCard) {
  const el = document.createElement("themisto-card-editor") as ThemistoEditor;
  el.card = card;
  return el;
}

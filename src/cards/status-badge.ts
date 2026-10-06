import { LitElement, css, html, nothing } from "lit";
import { gestures } from "../shared/actions";
import { actions, bool, colour, editorFor, entity, iconField, list, textField, grid, type EditorSpec } from "../shared/editor";
import { stateText } from "../shared/format";
import { icon, iconForEntity } from "../shared/icons";
import { tokens } from "../shared/styles";
import { cssColour, domainOf, friendlyName, isUnavailable, text } from "../shared/util";
import type { ActionConfig, HassEntity, HomeAssistant } from "../types";

export interface BadgeConfig {
  type: string; entity: string; name?: string; state?: string; icon?: string; show_state?: boolean;
  color?: string; state_colours?: { state: string; color: string }[];
  tap_action?: ActionConfig; hold_action?: ActionConfig; double_tap_action?: ActionConfig;
}

/** Automatic colour by domain and state, matching v1. Exported for tests. */
export function autoColour(s?: HassEntity): string {
  if (!s || isUnavailable(s)) return "var(--tm-idle)";
  const v = s.state, d = domainOf(s.entity_id);
  const ok = "var(--tm-ok)", bad = "var(--tm-bad)";
  if (d === "binary_sensor") {
    const good = ["connectivity", "running", "plug", "power", "presence", "battery_charging", "light", "update"].includes(s.attributes.device_class);
    return (v === "on") === good ? ok : bad;
  }
  if (d === "lock") return v === "locked" ? ok : bad;
  if (["alarm_control_panel", "device_tracker", "person"].includes(d)) return ["triggered", "not_home", "away"].includes(v) ? bad : ok;
  if (d === "light") return v === "on" ? "var(--tm-on)" : "var(--tm-idle)";
  if (d === "media_player") return v === "playing" ? ok : "var(--tm-accent)";
  if (d === "climate") return s.attributes.hvac_action === "heating" ? "var(--tm-heat)" : "var(--tm-cool)";
  return ["on", "open", "active", "playing", "home"].includes(v) ? ok : "var(--tm-accent)";
}

export class ThemistoStatusBadge extends LitElement {
  static override properties = { _config: { state: true }, _tick: { state: true } };
  declare _config?: BadgeConfig;
  declare _tick: number;
  private _hass?: HomeAssistant;
  private g = gestures(() => ({ entity: this._config?.entity, tap_action: this._config?.tap_action || { action: "more-info" }, hold_action: this._config?.hold_action, double_tap_action: this._config?.double_tap_action }), () => this);

  constructor() { super(); this._tick = 0; }

  static override styles = [tokens, css`
    :host { display: inline-flex; height: auto; max-width: 100%; }
    /* The brand's hero pill: tinted fill and outline in the badge's colour. */
    button { font: inherit; color: var(--tm-text); display: inline-flex; align-items: center; gap: 8px; max-width: 100%; min-height: 40px; padding: 5px 14px 5px 6px;
      border: 1px solid color-mix(in srgb, var(--bc) 40%, transparent); border-radius: 999px; background: color-mix(in srgb, var(--bc) 14%, var(--tm-read));
      backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); text-align: left; cursor: pointer; -webkit-tap-highlight-color: transparent; }
    button:focus-visible { outline: 2px solid var(--tm-accent); outline-offset: 2px; }
    .i { display: grid; place-items: center; flex: 0 0 28px; width: 28px; height: 28px; border-radius: 50%; color: var(--bc); background: color-mix(in srgb, var(--bc) 15%, transparent); }
    .i svg, .i ha-icon { width: 15px; height: 15px; --mdc-icon-size: 15px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .t { min-width: 0; } strong, small { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    strong { font: 600 var(--tm-fs-body)/1.15 var(--tm-body); } small { margin-top: 3px; font: 400 var(--tm-fs-label)/1 var(--tm-mono); letter-spacing: .06em; text-transform: uppercase; color: var(--tm-muted); }
  `];

  setConfig(c: BadgeConfig) {
    if (!c.entity) throw new Error("Choose an entity for the badge");
    this._config = c;
  }
  set hass(h: HomeAssistant) {
    const old = this._hass; this._hass = h;
    this.toggleAttribute("dark", !!h.themes?.darkMode);
    if (!old || old.states[this._config?.entity || ""] !== h.states[this._config?.entity || ""] || old.themes?.darkMode !== h.themes?.darkMode) this._tick++;
  }

  static getConfigElement() { return editorFor(ThemistoStatusBadge); }
  static getStubConfig(hass: HomeAssistant) { return { entity: Object.keys(hass.states).find((e) => e.startsWith("binary_sensor.")) || "sun.sun" }; }
  static editor(): EditorSpec {
    return {
      schema: [entity("entity"), grid(textField("name"), textField("state")), grid(iconField(), bool("show_state")), colour("color"),
        list("state_colours", { state: { ...textField("state"), label: "When the state is", required: true }, color: { ...colour("color"), label: "Colour", required: true } }, "state", "color"),
        actions()],
      labels: { state: "State text", show_state: "Show state", color: "Colour", state_colours: "Colour per state" },
      helpers: { color: "Leave blank for an automatic colour based on the entity and its state.", state: "Leave blank for the live state.", state_colours: "Uses the raw state, e.g. on, off, locked, home." },
    };
  }

  override render() {
    const c = this._config, h = this._hass;
    if (!c || !h) return nothing;
    const s = h.states[c.entity];
    const per = c.state_colours?.find((x) => x.state === s?.state);
    const bc = per ? cssColour(per.color, "") : c.color && c.color !== "auto" ? cssColour(c.color, autoColour(s)) : autoColour(s);
    const name = text(c.name, friendlyName(s, c.entity));
    const st = text(c.state, s ? stateText(h, s) : "Unavailable");
    return html`<button style="--bc:${bc}" aria-label="${name}: ${st}" @pointerdown=${this.g.down} @pointermove=${this.g.move} @pointerup=${this.g.up} @pointercancel=${this.g.cancel} @click=${this.g.click} @contextmenu=${this.g.context}>
      <span class="i">${icon(c.icon, iconForEntity(c.entity, s?.attributes.device_class))}</span>
      <span class="t">${name ? html`<strong>${name}</strong>` : nothing}${c.show_state !== false && st ? html`<small>${st}</small>` : nothing}</span>
    </button>`;
  }
}

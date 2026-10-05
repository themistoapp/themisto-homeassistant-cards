import { css, html, nothing, type PropertyValues } from "lit";
import "../components/tm-graph";
import { ThemistoCard } from "../shared/base-card";
import { action, actions, appearance, bool, choose, colour, editorFor, entity, list, numberField, section, textField, titleFields, grid, type EditorSpec } from "../shared/editor";
import { measure, type MeasureOptions } from "../shared/format";
import { bucket, subscribeHistory } from "../shared/history";
import { icon, iconForEntity } from "../shared/icons";
import { friendlyName } from "../shared/util";
import type { ActionConfig, BaseConfig, HomeAssistant } from "../types";

interface Stat { entity?: string; attribute?: string; computed?: "min" | "max" | "avg" | "delta"; label?: string; unit?: string; decimals?: number; tap_action?: ActionConfig }
export interface SensorConfig extends BaseConfig, MeasureOptions {
  entity: string;
  show_graph?: boolean;
  hours?: number;
  graph_type?: "area" | "line" | "bar";
  graph_colour?: string;
  stats?: Stat[];
  show_chip?: boolean;
  status?: string; status_colour?: string;
  above?: number; above_status?: string; above_colour?: string;
  below?: number; below_status?: string; below_colour?: string;
}

/** Computed stat over the bucketed graph data. Exported for tests. */
export function computeStat(values: (number | null)[], kind: Stat["computed"]): number {
  const v = values.filter((x): x is number => x !== null);
  if (!v.length) return NaN;
  if (kind === "min") return Math.min(...v);
  if (kind === "max") return Math.max(...v);
  if (kind === "avg") return v.reduce((a, b) => a + b, 0) / v.length;
  return v[v.length - 1] - v[0];
}

export class ThemistoSensorCard extends ThemistoCard<SensorConfig> {
  static override presets = { compact: { columns: 6, rows: 2 }, standard: { columns: 6, rows: 4 }, large: { columns: 12, rows: 4 } };
  static override properties = { ...ThemistoCard.properties, _values: { state: true }, _hover: { state: true } };
  declare _values: (number | null)[];
  declare _hover: number | null;
  private _unsub?: () => void;
  private _subKey = "";
  private _samples: Parameters<typeof bucket>[0] = [];
  private _clock?: number;

  constructor() { super(); this._values = []; this._hover = null; }

  static override styles = [
    ...ThemistoCard.styles,
    css`
      .se { display: grid; grid-template-rows: minmax(0, 1fr) auto; gap: 12px; }
      .main { display: flex; flex-direction: column; gap: 6px; min-height: 0; min-width: 0; }
      .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .stats .stat:nth-child(n+3) { display: none; }
      button.stat { cursor: pointer; border-radius: 8px; }
      @container (min-width: 480px) {
        .se.has-stats { grid-template-columns: minmax(0, 1fr) minmax(150px, 34%); grid-template-rows: minmax(0, 1fr); }
        .stats { grid-template-columns: 1fr; align-content: center; gap: 0; border-left: 1px solid var(--tm-line); padding-left: 16px; }
        .stats .stat:nth-child(n+3) { display: grid; }
        .stats .stat { grid-template-columns: 1fr auto; align-items: baseline; padding: 9px 0; border-bottom: 1px solid var(--tm-line); }
        .stats .stat:last-child { border-bottom: 0; }
      }
      .compact .hero { --hero: 30px; }
      .compact .spark { flex: 1; min-width: 0; height: 40px; display: flex; }
      @container (max-width: 250px) { .compact .chip { display: none; } .stats { grid-template-columns: 1fr; } .stats .stat:nth-child(n+2) { display: none; } }
      tm-graph { --graph-color: var(--c); }
    `,
  ];

  protected override validate(c: SensorConfig) { if (!c.entity) throw new Error("Choose a sensor"); }
  protected watchedEntities() { return [this._config?.entity, ...(this._config?.stats || []).map((s) => s.entity)]; }

  static getConfigElement() { return editorFor(ThemistoSensorCard); }
  static getStubConfig(hass: HomeAssistant) {
    const e = Object.keys(hass.states).find((id) => id.startsWith("sensor.") && hass.states[id].attributes.state_class === "measurement");
    return { entity: e || "sensor.example", hours: 24 };
  }
  static editor(): EditorSpec {
    return {
      schema: [
        entity("entity", ["sensor", "input_number", "number"]),
        ...titleFields(),
        section("Value", [textField("attribute"), grid(textField("unit"), numberField("decimals", 0, 4)), bool("scale_power")], { icon: "mdi:numeric" }),
        section("Graph", [grid(bool("show_graph"), choose("graph_type", ["area", "line", "bar"])), grid(numberField("hours", 1, 168, 1, "h"), colour("graph_colour"))], { icon: "mdi:chart-areaspline" }),
        section("Stats", [list("stats", {
          entity: { ...entity("entity"), label: "Entity (leave blank for a computed stat)" },
          attribute: { ...textField("attribute"), label: "Attribute (optional)" },
          computed: { ...choose("computed", [["min", "Lowest in graph"], ["max", "Highest in graph"], ["avg", "Average in graph"], ["delta", "Change over graph"]]), label: "Computed from graph" },
          label: { ...textField("label"), label: "Label" },
          unit: { ...textField("unit"), label: "Unit override" },
          decimals: { ...numberField("decimals", 0, 4), label: "Decimals" },
          tap_action: { ...action("tap_action"), label: "Tap action" },
        }, "label", "entity")], { icon: "mdi:format-list-bulleted" }),
        section("Status chip", [
          grid(bool("show_chip"), textField("status")), colour("status_colour"),
          grid(numberField("above", -1e9, 1e9, 0.01), textField("above_status")), colour("above_colour"),
          grid(numberField("below", -1e9, 1e9, 0.01), textField("below_status")), colour("below_colour"),
        ], { icon: "mdi:label-outline" }),
        appearance(["compact", "standard", "large"], [colour("accent")]),
        actions(),
      ],
      labels: { attribute: "Use an attribute instead of the state", unit: "Unit override", decimals: "Decimal places", scale_power: "Scale W to kW automatically", show_graph: "Show graph", graph_type: "Graph style", hours: "Graph history", graph_colour: "Graph colour", stats: "Stats", show_chip: "Show chip", status: "Chip text", status_colour: "Chip colour", above: "Above", above_status: "Text when above", above_colour: "Colour when above", below: "Below", below_status: "Text when below", below_colour: "Colour when below", accent: "Icon colour" },
      helpers: { stats: "Up to 4. Narrow cards show the first two underneath the graph; wide cards list them all on the right.", status: "Leave blank to hide the chip unless a threshold matches." },
    };
  }

  private get hours() { return Math.min(168, Math.max(1, this._config?.hours || 24)); }
  private get buckets() { return this._config?.graph_type === "bar" ? Math.min(48, this.hours) : this.hours <= 24 ? 96 : Math.min(168, this.hours * 2); }

  private rebucket() {
    const end = Date.now(), start = end - this.hours * 3600_000;
    this._values = bucket(this._samples, start, end, this.buckets);
  }

  private resubscribe() {
    const c = this._config;
    const needsHistory = !!c && !!this._hass && (c.show_graph !== false || (c.stats || []).some((s) => s.computed && !s.entity));
    const key = needsHistory ? `${c!.entity}|${this.hours}|${c!.attribute || ""}` : "";
    if (key === this._subKey) return;
    this._unsub?.(); this._unsub = undefined; this._subKey = key; this._samples = []; this._values = [];
    if (!key || c!.attribute) return; // attribute history isn't available from the minimal stream
    this._unsub = subscribeHistory(this._hass!, [c!.entity], this.hours, (data) => { this._samples = data[c!.entity] || []; this.rebucket(); });
  }

  override connectedCallback() {
    super.connectedCallback();
    // Slide the time axis along once a minute even when the value is steady.
    this._clock = window.setInterval(() => this._samples.length && this.rebucket(), 60_000);
  }
  override disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this._clock);
    this._unsub?.(); this._unsub = undefined; this._subKey = "";
  }
  protected override willUpdate(changed: PropertyValues) {
    super.willUpdate(changed);
    this.resubscribe();
  }

  private chip() {
    const c = this._config!;
    if (c.show_chip === false) return nothing;
    const m = measure(this._hass, this.stateOf(c.entity), c);
    if (this._hover !== null && this._values[this._hover] != null) {
      const minsAgo = (this._values.length - 1 - this._hover) * ((this.hours * 60) / this._values.length);
      const t = new Date(Date.now() - minsAgo * 60_000).toLocaleTimeString(this._hass?.locale?.language || "en-GB", { hour: "2-digit", minute: "2-digit" });
      const v = measure(this._hass, { ...this.stateOf(c.entity)!, state: String(this._values[this._hover]) }, c);
      return html`<span class="chip" style="--cc:var(--tm-text-2)">${t} · ${v.value}${v.unit ? ` ${v.unit}` : ""}</span>`;
    }
    let text = this.t(c.status, ""), col = this.colour(c.status_colour, "var(--c)");
    if (c.above !== undefined && m.raw > c.above) { text = this.t(c.above_status, text); col = this.colour(c.above_colour, "var(--tm-bad)"); }
    else if (c.below !== undefined && m.raw < c.below) { text = this.t(c.below_status, text); col = this.colour(c.below_colour, "var(--tm-cool)"); }
    return text ? html`<span class="chip" style="--cc:${col}"><i></i>${text}</span>` : nothing;
  }

  private statTemplate(st: Stat) {
    const c = this._config!;
    let value = "–", unit = st.unit ?? "";
    if (st.entity) {
      const m = measure(this._hass, this.stateOf(st.entity), { attribute: st.attribute, unit: st.unit, decimals: st.decimals });
      value = m.value; unit = st.unit ?? m.unit;
    } else if (st.computed) {
      const raw = computeStat(this._values, st.computed);
      if (Number.isFinite(raw)) {
        const m = measure(this._hass, { ...this.stateOf(c.entity)!, state: String(raw) }, { ...c, decimals: st.decimals ?? c.decimals, unit: st.unit ?? c.unit });
        value = m.value; unit = st.unit ?? m.unit;
      }
    } else return nothing;
    const label = this.t(st.label, st.computed ? { min: "Lowest", max: "Peak", avg: "Average", delta: "Change" }[st.computed] : friendlyName(this.stateOf(st.entity)));
    const inner = html`<span class="kick">${label}</span><span class="sv">${value}${unit ? html`<span class="u">${unit}</span>` : nothing}</span>`;
    return st.entity || st.tap_action
      ? html`<button class="stat" @click=${() => this.elementAction(st.entity, st.tap_action)}>${inner}</button>`
      : html`<div class="stat">${inner}</div>`;
  }

  override render() {
    const c = this._config!, s = this.stateOf(c.entity);
    const name = this.t(c.name, friendlyName(s, c.entity));
    if (!s) return this.unavailable(name, `Entity not found: ${c.entity}`, icon("gauge"));
    const m = measure(this._hass, s, c);
    const accent = this.colour(c.accent, "var(--tm-accent)");
    const graphCol = this.colour(c.graph_colour, accent);
    const ic = icon(c.icon, iconForEntity(c.entity, s.attributes.device_class));
    const showGraph = c.show_graph !== false && !c.attribute;
    const graph = showGraph ? html`<tm-graph style="--graph-color:${graphCol}" .values=${this._values} .type=${c.graph_type || "area"}
      @graph-hover=${(e: CustomEvent) => (this._hover = e.detail.index)}></tm-graph>` : nothing;
    const hero = html`<span class="hero">${m.value}${m.unit ? html`<span class="u">${m.unit}</span>` : nothing}</span>`;
    const na = !Number.isFinite(m.raw) && m.value === "–";

    if (this.cardLayout === "compact") {
      return this.shell(html`<div class="in compact" style="justify-content:space-between">
        <div class="row"><span class="itile sm">${ic}</span><span class="nm sp">${name}</span>${this.chip()}</div>
        <div class="row" style="align-items:flex-end">${hero}${showGraph ? html`<div class="spark">${graph}</div>` : nothing}</div>
      </div>`, { c: accent, na });
    }
    const stats = (c.stats || []).slice(0, 4).map((st) => this.statTemplate(st)).filter((x) => x !== nothing);
    const kicker = this.t(c.kicker, "");
    return this.shell(html`<div class="in se ${stats.length ? "has-stats" : ""}">
      <div class="main">
        <div class="hd"><div class="row titlerow"><span class="itile">${ic}</span><div class="titles" style="min-width:0;display:grid;gap:4px">
          ${kicker ? html`<span class="kick">${kicker}</span>` : nothing}${name ? html`<span class="ttl">${name}</span>` : nothing}</div></div>${this.chip()}</div>
        ${hero}${graph}
      </div>
      ${stats.length ? html`<div class="stats">${stats}</div>` : nothing}
    </div>`, { c: accent, na });
  }
}


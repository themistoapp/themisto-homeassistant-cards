import { css, html, nothing, type PropertyValues } from "lit";
import "../components/tm-graph";
import { ThemistoCard } from "../shared/base-card";
import { actions, appearance, bool, colour, editorFor, entities, entity, numberField, section, textField, titleFields, grid, type EditorSpec } from "../shared/editor";
import { formatRate, toMbps } from "../shared/format";
import { bucket, subscribeHistory } from "../shared/history";
import { icon } from "../shared/icons";
import { asList, fmtNumber, isUnavailable, num } from "../shared/util";
import type { BaseConfig, HassEntity, HomeAssistant } from "../types";

type Many = string | string[];
export interface UnifiConfig extends BaseConfig {
  wan_status?: string; wan_ip?: string; isp?: string; isp_text?: string;
  download?: string; upload?: string; latency?: string;
  clients_total?: Many; clients_wireless?: Many; clients_wired?: Many; clients_guest?: Many;
  total_label?: string; wireless_label?: string; wired_label?: string; guest_label?: string;
  show_sparklines?: boolean; sparkline_hours?: number; latency_threshold?: number;
  online_colour?: string; degraded_colour?: string; offline_colour?: string; download_colour?: string; upload_colour?: string;
}

/** WAN up/down from a connectivity binary_sensor or a text sensor. Exported for tests. */
export function wanOnline(s?: HassEntity): boolean | undefined {
  if (!s) return undefined;
  if (isUnavailable(s)) return false;
  return ["on", "online", "connected", "up", "true", "ok"].includes(s.state.toLowerCase());
}

export class ThemistoUnifiCard extends ThemistoCard<UnifiConfig> {
  static override presets = { compact: { columns: 6, rows: 2 }, standard: { columns: 6, rows: 4 }, large: { columns: 12, rows: 3 } };
  static override properties = { ...ThemistoCard.properties, _spark: { state: true } };
  declare _spark: Record<string, (number | null)[]>;
  private _unsub?: () => void;
  private _subKey = "";

  constructor() { super(); this._spark = {}; }

  static override styles = [
    ...ThemistoCard.styles,
    css`
      .tp2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; flex: 1; min-height: 0; }
      .tpb { display: flex; flex-direction: column; gap: 2px; min-width: 0; min-height: 0; }
      .tpb .hero { --hero: var(--tm-fs-card); }
      .tpb tm-graph { min-height: 22px; }
      .cl { display: grid; grid-template-columns: repeat(var(--n, 4), minmax(0, 1fr)); gap: 8px; }
      .cl .sv { display: flex; align-items: center; gap: 5px; }
      .cl .sv svg { width: 14px; height: 14px; color: var(--tm-muted); flex: none; }
      button.stat { cursor: pointer; }
      .uw { display: grid; grid-template-columns: 1.15fr 1fr 1fr 1.1fr; gap: 16px; }
      .uw > div { min-width: 0; display: flex; flex-direction: column; gap: 6px; }
      .uw .cl { grid-template-columns: 1fr 1fr; row-gap: 10px; }
      .uw .hd { flex-direction: column; gap: 6px; }
      @container (max-width: 280px) { .cl .kick { display: none; } .tpb .u { display: block; margin: 2px 0 0; } .tp2 { gap: 10px; } }
      @container (max-width: 240px) { .cl .sv svg { display: none; } .cl .sv { font-size: var(--tm-fs-body); } .cmp .chip, .cmp .clients { display: none; } .cmp .sv { font-size: var(--tm-fs-small) !important; } }
      @container (max-width: 200px) { .cmp .sv .u { display: none; } }
      @container (max-width: 560px) { .uw { grid-template-columns: 1fr 1fr; } .uw > .uw-cl, .uw > .uw-st { display: none; } }
    `,
  ];

  private ids(): string[] {
    const c = this._config;
    if (!c) return [];
    return [c.wan_status, c.wan_ip, c.isp, c.download, c.upload, c.latency, ...asList(c.clients_total), ...asList(c.clients_wireless), ...asList(c.clients_wired), ...asList(c.clients_guest)].filter((x): x is string => !!x);
  }
  protected override validate(c: UnifiConfig) {
    if (!c.wan_status && !c.download && !c.clients_total) throw new Error("Set at least the WAN status, download or client count entity");
  }
  protected watchedEntities() { return this.ids(); }

  static getConfigElement() { return editorFor(ThemistoUnifiCard); }
  static getStubConfig(hass: HomeAssistant) {
    const find = (re: RegExp) => Object.keys(hass.states).find((e) => re.test(e));
    return { wan_status: find(/^binary_sensor\..*(wan|internet)/), download: find(/^sensor\..*(wan|internet).*(download|rx)/), upload: find(/^sensor\..*(wan|internet).*(upload|tx)/), clients_total: find(/^sensor\..*clients/) || "sensor.unifi_clients" };
  }
  static editor(): EditorSpec {
    return {
      schema: [
        ...titleFields(false),
        section("Internet", [entity("wan_status", ["binary_sensor", "sensor"]), grid(entity("download", "sensor"), entity("upload", "sensor")), entity("latency", "sensor"), grid(entity("wan_ip", "sensor"), entity("isp", "sensor")), textField("isp_text")], { icon: "mdi:web", expanded: true }),
        section("Clients", [entities("clients_total", "sensor"), entities("clients_wireless", "sensor"), entities("clients_wired", "sensor"), entities("clients_guest", "sensor"),
          grid(textField("total_label"), textField("wireless_label")), grid(textField("wired_label"), textField("guest_label"))], { icon: "mdi:devices" }),
        section("Graphs", [grid(bool("show_sparklines"), numberField("sparkline_hours", 1, 48, 1, "h")), numberField("latency_threshold", 1, 1000, 1, "ms")], { icon: "mdi:chart-line" }),
        appearance(["compact", "standard", ["large", "Wide"]]),
        section("Colours", [grid(colour("online_colour"), colour("degraded_colour")), colour("offline_colour"), grid(colour("download_colour"), colour("upload_colour"))], { icon: "mdi:palette" }),
        actions(),
      ],
      labels: { wan_status: "Internet status", download: "Download speed", upload: "Upload speed", latency: "Latency", wan_ip: "WAN IP", isp: "ISP sensor", isp_text: "ISP name (text)", clients_total: "Total clients", clients_wireless: "Wi-Fi clients", clients_wired: "Wired clients", clients_guest: "Guest clients", total_label: "Total label", wireless_label: "Wi-Fi label", wired_label: "Wired label", guest_label: "Guests label", show_sparklines: "Speed graphs", sparkline_hours: "Graph history", latency_threshold: "Degraded above", online_colour: "Online", degraded_colour: "Degraded", offline_colour: "Offline", download_colour: "Download", upload_colour: "Upload" },
      helpers: { clients_total: "Pick several sensors to add them up, e.g. one per access point.", latency_threshold: "The chip turns to Degraded when latency is higher than this." },
    };
  }

  private resubscribe() {
    const c = this._config;
    const ids = c && this._hass && c.show_sparklines !== false ? [c.download, c.upload].filter((x): x is string => !!x) : [];
    const hours = c?.sparkline_hours || 1;
    const key = ids.length ? `${ids.join()}|${hours}` : "";
    if (key === this._subKey) return;
    this._unsub?.(); this._unsub = undefined; this._subKey = key; this._spark = {};
    if (!key) return;
    this._unsub = subscribeHistory(this._hass!, ids, hours, (data) => {
      const end = Date.now(), start = end - hours * 3600_000;
      const next: Record<string, (number | null)[]> = {};
      for (const id of ids) {
        const unit = this.stateOf(id)?.attributes.unit_of_measurement;
        next[id] = bucket((data[id] || []).map((x) => ({ t: x.t, v: x.v === null ? null : toMbps(x.v, unit) })), start, end, 60);
      }
      this._spark = next;
    });
  }
  override disconnectedCallback() { super.disconnectedCallback(); this._unsub?.(); this._unsub = undefined; this._subKey = ""; }
  protected override willUpdate(changed: PropertyValues) { super.willUpdate(changed); this.resubscribe(); }

  private rate(id?: string) {
    const s = this.stateOf(id);
    if (!id || !s) return undefined;
    if (isUnavailable(s)) return { value: "–", unit: "" };
    return formatRate(this._hass, toMbps(num(s.state, 0), s.attributes.unit_of_measurement));
  }

  private sum(list?: Many) {
    const ids = asList(list);
    if (!ids.length) return undefined;
    const vals = ids.map((e) => num(this.stateOf(e)?.state)).filter(Number.isFinite);
    return vals.length ? vals.reduce((a, b) => a + b, 0) : NaN;
  }

  override render() {
    const c = this._config!;
    const online = wanOnline(this.stateOf(c.wan_status));
    const lat = this.stateOf(c.latency);
    const latency = lat && !isUnavailable(lat) ? num(lat.state) : NaN;
    const threshold = c.latency_threshold ?? 50;
    let chip: unknown = nothing, col = "var(--tm-accent)";
    if (online !== undefined || Number.isFinite(latency)) {
      const ms = Number.isFinite(latency) && online !== false ? html`<span class="more"> · ${Math.round(latency)} ms</span>` : nothing;
      const [txt, cc] = online === false ? ["Offline", this.colour(c.offline_colour, "var(--tm-bad)")]
        : latency > threshold ? ["Degraded", this.colour(c.degraded_colour, "var(--tm-warn)")]
        : ["Online", this.colour(c.online_colour, "var(--tm-ok)")];
      col = cc;
      chip = html`<button class="chip" style="--cc:${cc}" @click=${() => this.elementAction(c.wan_status || c.latency)}><i></i>${txt}${ms}</button>`;
    }
    const ispS = this.stateOf(c.isp), ipS = this.stateOf(c.wan_ip);
    const isp = this.t(c.isp_text, ispS && !isUnavailable(ispS) ? ispS.state : "");
    const ip = ipS && !isUnavailable(ipS) ? ipS.state : "";
    const subline = [isp, ip].filter(Boolean).join(" · ");
    const down = this.rate(c.download), up = this.rate(c.upload);
    const name = this.t(c.name, "Network"), kicker = this.t(c.kicker, "UniFi");
    const showSpark = c.show_sparklines !== false;
    const tpb = (label: string, id: string | undefined, r: { value: string; unit: string } | undefined, colr: string) =>
      r ? html`<div class="tpb" style="--c:${colr}"><span class="label">${label}</span><span class="hero">${r.value}<span class="u">${r.unit}</span></span>
        ${showSpark && this._spark[id!] ? html`<tm-graph style="--graph-color:${colr}" .values=${this._spark[id!]} type="area"></tm-graph>` : nothing}</div>` : nothing;
    const dCol = this.colour(c.download_colour, "var(--tm-accent)"), uCol = this.colour(c.upload_colour, "var(--tm-ok)");
    const clients = ([
      ["clients_total", c.total_label, "Total", "users"], ["clients_wireless", c.wireless_label, "Wi-Fi", "wifi"],
      ["clients_wired", c.wired_label, "Wired", "cable"], ["clients_guest", c.guest_label, "Guests", "guest"],
    ] as const).map(([key, lbl, def, ic]) => ({ key, label: this.t(lbl, def), ic, v: this.sum(c[key]) })).filter((x) => x.v !== undefined);
    const cl = clients.length ? html`<div class="cl" style="--n:${clients.length}">${clients.map((x) => html`<button class="stat" @click=${() => this.elementAction(asList(c[x.key])[0])}>
      ${x.label ? html`<span class="kick">${x.label}</span>` : nothing}<span class="sv">${icon(x.ic)}${Number.isFinite(x.v) ? fmtNumber(this._hass, x.v!, 0) : "–"}</span></button>`)}</div>` : nothing;
    const na = online === false;

    if (this.cardLayout === "compact") {
      const total = clients[0];
      return this.shell(html`<div class="in cmp" style="justify-content:space-between">
        <div class="row"><span class="itile sm">${icon(c.icon, "router")}</span><div class="sp"><div class="nm">${name}</div>${subline ? html`<div class="sub">${subline}</div>` : nothing}</div>${chip}</div>
        <div class="row" style="justify-content:space-between">
          ${down || up ? html`<span class="sv">${down ? html`↓ ${down.value}<span class="u" style="margin:0 8px 0 3px">${down.unit}</span>` : nothing}${up ? html`↑ ${up.value}<span class="u" style="margin-left:3px">${up.unit}</span>` : nothing}</span>` : html`<span></span>`}
          ${total && Number.isFinite(total.v) ? html`<span class="sub clients" style="flex:none">${fmtNumber(this._hass, total.v!, 0)} clients</span>` : nothing}
        </div></div>`, { c: col, na });
    }
    const head = this.header(kicker, name, chip);
    if (this.cardLayout === "large") {
      return this.shell(html`<div class="in uw">
        <div class="uw-st">${head}${subline ? html`<span class="sub">${subline}</span>` : nothing}</div>
        ${tpb("↓ Download", c.download, down, dCol)}${tpb("↑ Upload", c.upload, up, uCol)}
        ${clients.length ? html`<div class="uw-cl" style="justify-content:center">${cl}</div>` : nothing}
      </div>`, { c: col, na });
    }
    return this.shell(html`<div class="in" style="gap:10px">${head}${subline ? html`<span class="sub" style="margin-top:-6px">${subline}</span>` : nothing}
      ${down || up ? html`<div class="tp2">${tpb("↓ Download", c.download, down, dCol)}${tpb("↑ Upload", c.upload, up, uCol)}</div>` : html`<div class="sp"></div>`}${cl}</div>`, { c: col, na });
  }
}

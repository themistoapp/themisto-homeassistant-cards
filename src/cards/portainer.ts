import { css, html, nothing } from "lit";
import { ThemistoCard } from "../shared/base-card";
import { actions, appearance, bool, choose, colour, editorFor, entity, list, numberField, section, textField, titleFields, grid, type EditorSpec } from "../shared/editor";
import type { GridOptions } from "../shared/grid";
import { icon } from "../shared/icons";
import { fmtNumber, isUnavailable, num, relativeTime } from "../shared/util";
import type { BaseConfig, HassEntityRegistryEntry, HomeAssistant } from "../types";

export interface Container { name: string; status?: string; power?: string; restart?: string; cpu?: string; memory?: string; state?: string; started?: string }
export interface PortainerConfig extends BaseConfig {
  device?: string;
  containers?: Container[];
  include?: string[]; exclude?: string[]; pinned?: string[];
  sort?: "status" | "name" | "cpu";
  only_stopped?: boolean; compact_rows?: boolean;
  show_cpu?: boolean; show_memory?: boolean; show_uptime?: boolean; show_restart?: boolean;
  confirm?: boolean; max_rows?: number; columns?: "auto" | "1" | "2";
  running_colour?: string; stopped_colour?: string; restarting_colour?: string;
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
/** Matches on the translation key, or the entity id with the container's own name removed (so "uptime-kuma" isn't an uptime sensor). */
const match = (e: HassEntityRegistryEntry, re: RegExp, deviceName: string) => {
  const objectId = e.entity_id.split(".")[1].replace(new RegExp(`^${slugify(deviceName)}_?`), "");
  return re.test(e.translation_key || objectId);
};

/**
 * Finds containers under a Portainer endpoint device. HA's Portainer integration makes one device
 * per container (via the endpoint); each container device carries a switch (start/stop), a restart
 * button, a status binary sensor and CPU/memory sensors. Exported for tests.
 */
export function discover(hass: Pick<HomeAssistant, "devices" | "entities">, deviceId?: string): Container[] {
  if (!deviceId || !hass.devices || !hass.entities) return [];
  const devices = Object.values(hass.devices);
  const children = devices.filter((d) => d.via_device_id === deviceId);
  const groups = children.length ? children : devices.filter((d) => d.id === deviceId);
  const ents = Object.values(hass.entities).filter((e) => !e.hidden);
  return groups.map((d) => {
    const mine = ents.filter((e) => e.device_id === d.id);
    const dn = d.name_by_user || d.name || "";
    const pick = (domain: string, re?: RegExp) => mine.find((e) => e.entity_id.startsWith(`${domain}.`) && (!re || match(e, re, dn)))?.entity_id;
    return {
      name: d.name_by_user || d.name || d.id,
      power: pick("switch"),
      restart: pick("button", /restart/),
      status: pick("binary_sensor"),
      cpu: pick("sensor", /cpu/),
      memory: pick("sensor", /mem/),
      state: pick("sensor", /(^|_)(state|status)/),
      started: pick("sensor", /(uptime|started|created)/),
    };
  }).filter((c) => c.power || c.status || c.state);
}

export class ThemistoPortainerCard extends ThemistoCard<PortainerConfig> {
  static override presets = { standard: { columns: 6, rows: "auto" as const } };
  static override properties = { ...ThemistoCard.properties, _confirm: { state: true }, _all: { state: true }, _busy: { state: true } };
  declare _confirm?: { name: string; action: "restart" | "stop" | "start" };
  declare _all: boolean;
  declare _busy: Record<string, number>;
  private _press: { timer?: number; held: boolean } = { held: false };

  constructor() { super(); this._all = false; this._busy = {}; }

  static override styles = [
    ...ThemistoCard.styles,
    css`
      .rows { display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; }
      @container (min-width: 560px) { .rows.c-auto, .rows.c-2 { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
      .r { display: flex; align-items: center; gap: 10px; height: 44px; padding: 0 4px 0 12px; cursor: pointer; user-select: none; -webkit-user-select: none; touch-action: manipulation; min-width: 0; }
      .r.compact { height: 36px; }
      /* The brand dot: steady colour, no pulse. Restarting shows the warning colour. */
      .dot { width: 7px; height: 7px; border-radius: 50%; flex: none; background: var(--run); }
      .r.stopped .dot { background: var(--stop); }
      .r.busy .dot { background: var(--busy); }
      .m { display: flex; gap: 10px; font: 400 var(--tm-fs-label) var(--tm-mono); color: var(--tm-text-2); font-variant-numeric: tabular-nums; flex: none; }
      .m span { min-width: 6ch; text-align: right; }
      .r .rbtn { border: 0; color: var(--tm-muted); }
      .cf { display: flex; align-items: center; gap: 6px; flex: none; font: 600 var(--tm-fs-small) var(--tm-body); }
      .cf .rbtn { background: var(--tm-solid); }
      .cf .yes { color: var(--tm-bad); }
      @container (max-width: 340px) { .m { display: none; } }
    `,
  ];

  private list(): Container[] {
    const c = this._config;
    if (!c || !this._hass) return [];
    const found = discover(this._hass, c.device);
    const manual = c.containers || [];
    const byName = new Map(found.map((x) => [x.name, x]));
    for (const m of manual) byName.set(m.name, { ...byName.get(m.name), ...m });
    return [...byName.values()];
  }

  protected override validate(c: PortainerConfig) {
    if (!c.device && !c.containers?.length) throw new Error("Choose your Portainer endpoint device, or add containers by hand");
  }
  protected watchedEntities() {
    return this.list().flatMap((x) => [x.power, x.status, x.cpu, x.memory, x.state, x.started, x.restart]);
  }
  protected override changed(old: HomeAssistant, hass: HomeAssistant) {
    return old.entities !== hass.entities || old.devices !== hass.devices || super.changed(old, hass);
  }

  override getGridOptions(): GridOptions { return { columns: 6, rows: "auto", min_columns: 4 }; }
  override getCardSize() { return 1 + Math.ceil((Math.min(this.list().length, this._config?.max_rows || 99) * 50) / 64); }

  static getConfigElement() { return editorFor(ThemistoPortainerCard); }
  static getStubConfig(hass: HomeAssistant) {
    const ent = Object.values(hass.entities || {}).find((e) => e.platform === "portainer" && e.device_id);
    const dev = ent?.device_id ? hass.devices?.[ent.device_id] : undefined;
    return { device: dev?.via_device_id || dev?.id || "" };
  }
  static editor(hass: HomeAssistant, c: Record<string, any>): EditorSpec {
    const names = discover(hass, c.device).map((x) => x.name).sort();
    const pickNames = (n: string) => (names.length ? choose(n, names, { multiple: true, custom_value: true }) : { name: n, selector: { text: { multiple: true } } });
    return {
      schema: [
        { name: "device", selector: { device: { filter: { integration: "portainer" } } } },
        ...titleFields(false),
        section("Containers", [pickNames("pinned"), pickNames("include"), pickNames("exclude"),
          list("containers", { name: { ...textField("name"), label: "Name", required: true }, status: { ...entity("status", ["binary_sensor", "sensor"]), label: "Status" }, power: { ...entity("power", "switch"), label: "Start/stop switch" }, restart: { ...entity("restart", "button"), label: "Restart button" }, cpu: { ...entity("cpu", "sensor"), label: "CPU" }, memory: { ...entity("memory", "sensor"), label: "Memory" } }, "name", "status"),
        ], { icon: "mdi:docker" }),
        section("Rows", [grid(bool("show_cpu"), bool("show_memory")), grid(bool("show_uptime"), bool("show_restart")), grid(bool("confirm"), bool("compact_rows")), grid(bool("only_stopped"), numberField("max_rows", 1, 50)),
          grid(choose("sort", [["status", "Stopped first"], ["name", "By name"], ["cpu", "Busiest first"]]), choose("columns", [["auto", "Auto"], ["1", "One"], ["2", "Two (wide cards)"]]))], { icon: "mdi:view-list" }),
        appearance([]),
        section("Colours", [grid(colour("running_colour"), colour("stopped_colour")), colour("restarting_colour")], { icon: "mdi:palette" }),
        actions(),
      ],
      labels: { device: "Portainer endpoint", pinned: "Pinned to the top", include: "Only show these", exclude: "Hide these", containers: "Add containers by hand", show_cpu: "CPU", show_memory: "Memory", show_uptime: "Uptime", show_restart: "Restart button", confirm: "Ask before restart/stop", compact_rows: "Compact rows", only_stopped: "Only show stopped", max_rows: "Rows before \"Show more\"", sort: "Order", columns: "Columns", running_colour: "Running", stopped_colour: "Stopped", restarting_colour: "Restarting" },
      helpers: { device: names.length ? `Found ${names.length} containers.` : "Containers under this device are found automatically.", containers: "Only needed if a container isn't found automatically.", confirm: "Press and hold a row to stop or start that container." },
    };
  }

  private running(x: Container) {
    const st = (id?: string) => this.stateOf(id);
    if (x.power && st(x.power)) return st(x.power)!.state === "on";
    if (x.status && st(x.status)) return st(x.status)!.state === "on" || st(x.status)!.state === "running";
    return /running|up/i.test(st(x.state)?.state || "");
  }

  private act(x: Container, action: "restart" | "stop" | "start") {
    this._confirm = undefined;
    this._busy = { ...this._busy, [x.name]: Date.now() };
    setTimeout(() => { const b = { ...this._busy }; delete b[x.name]; this._busy = b; }, 8000);
    if (action === "restart" && x.restart) this.call("button", "press", { entity_id: x.restart });
    else if (x.power) this.call("switch", action === "stop" ? "turn_off" : "turn_on", { entity_id: x.power });
  }

  private ask(x: Container, action: "restart" | "stop" | "start") {
    if (this._config!.confirm === false) this.act(x, action);
    else this._confirm = { name: x.name, action };
  }

  private row(x: Container) {
    const c = this._config!;
    const run = this.running(x);
    // Busy until HA reports a new state for the container.
    const busySince = this._busy[x.name];
    const key = x.power || x.status;
    const busy = !!busySince && (!key || Date.parse(this.stateOf(key)?.last_changed || "0") < busySince);
    const cf = this._confirm?.name === x.name ? this._confirm : undefined;
    const st = this.stateOf(x.state);
    const started = this.stateOf(x.started);
    const sub = busy ? "Working…" : !run ? (st && !isUnavailable(st) ? this.hass?.formatEntityState?.(st) ?? st.state : "Stopped")
      : c.show_uptime !== false && started && !isUnavailable(started) ? `Up ${relativeTime(started.state).replace(" ago", "")}`
      : st && !isUnavailable(st) ? this.hass?.formatEntityState?.(st) ?? st.state : "Running";
    const cpu = num(this.stateOf(x.cpu)?.state), mem = this.stateOf(x.memory);
    const memV = num(mem?.state), memU = String(mem?.attributes.unit_of_measurement || "MB");
    const memText = !Number.isFinite(memV) ? "" : /^(MB|MiB)$/i.test(memU) && memV >= 1000 ? `${fmtNumber(this._hass, memV / 1024, 1)} GB` : `${fmtNumber(this._hass, memV, memU === "%" ? 1 : 0)} ${memU}`;
    const metrics = run && !c.compact_rows && ((c.show_cpu !== false && Number.isFinite(cpu)) || (c.show_memory !== false && memText))
      ? html`<div class="m">${c.show_cpu !== false && Number.isFinite(cpu) ? html`<span>${fmtNumber(this._hass, cpu, 1)}%</span>` : nothing}${c.show_memory !== false && memText ? html`<span>${memText}</span>` : nothing}</div>` : nothing;
    const h = this._press;
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest("button") || !x.power) return;
      h.held = false;
      h.timer = window.setTimeout(() => { h.held = true; this.ask(x, run ? "stop" : "start"); }, 550);
    };
    const up = () => clearTimeout(h.timer);
    const tap = (e: Event) => { if ((e.target as HTMLElement).closest("button") || h.held) return; this.elementAction(x.status || x.power || x.state); };
    const canRestart = c.show_restart !== false && (run ? !!x.restart : !!x.power);
    return html`<div class="r panel ${run ? "" : "stopped"} ${busy ? "busy" : ""} ${c.compact_rows ? "compact" : ""}" data-own role="button" tabindex="0" aria-label="${x.name}, ${sub}"
      @pointerdown=${down} @pointerup=${up} @pointerleave=${up} @click=${tap} @contextmenu=${(e: Event) => e.preventDefault()}>
      <span class="dot"></span>
      <div class="sp"><div class="nm">${x.name}</div>${c.compact_rows ? nothing : html`<div class="sub">${sub}</div>`}</div>
      ${cf ? html`<div class="cf"><span>${cf.action === "restart" ? "Restart" : cf.action === "stop" ? "Stop" : "Start"}?</span>
          <button class="rbtn yes" aria-label="Confirm" @click=${() => this.act(x, cf.action)}>${icon("check")}</button>
          <button class="rbtn" aria-label="Cancel" @click=${() => (this._confirm = undefined)}>${icon("x")}</button></div>`
        : html`${metrics}${canRestart ? html`<button class="rbtn" ?disabled=${busy} aria-label="${run ? "Restart" : "Start"} ${x.name}" title=${run ? "Restart" : "Start"}
            @click=${() => this.ask(x, run ? "restart" : "start")}>${icon(run ? "restart" : "play")}</button>` : nothing}`}
    </div>`;
  }

  override render() {
    const c = this._config!;
    let all = this.list();
    if (c.include?.length) all = all.filter((x) => c.include!.includes(x.name));
    if (c.exclude?.length) all = all.filter((x) => !c.exclude!.includes(x.name));
    const up = all.filter((x) => this.running(x)).length, down = all.length - up;
    let shown = c.only_stopped ? all.filter((x) => !this.running(x)) : [...all];
    const pinned = c.pinned || [];
    shown.sort((a, b) => {
      const pa = pinned.indexOf(a.name), pb = pinned.indexOf(b.name);
      if (pa !== pb) return (pa < 0 ? 1e9 : pa) - (pb < 0 ? 1e9 : pb);
      if (c.sort === "name") return a.name.localeCompare(b.name);
      if (c.sort === "cpu") return (num(this.stateOf(b.cpu)?.state, -1) - num(this.stateOf(a.cpu)?.state, -1)) || a.name.localeCompare(b.name);
      return Number(this.running(a)) - Number(this.running(b)) || a.name.localeCompare(b.name);
    });
    const max = c.max_rows && !this._all ? c.max_rows : Infinity;
    const extra = Math.max(0, shown.length - max);
    shown = shown.slice(0, max);
    const dev = c.device ? this._hass?.devices?.[c.device] : undefined;
    const name = this.t(c.name, dev?.name_by_user || dev?.name || "Containers");
    const runC = this.colour(c.running_colour, "var(--tm-ok)"), stopC = this.colour(c.stopped_colour, "var(--tm-bad)");
    const chip = all.length ? html`<span class="chip" style="--cc:${down ? stopC : runC}"><i></i>${up} up${down ? ` · ${down} down` : ""}</span>` : nothing;
    return this.shell(html`<div class="in">
      ${this.header(this.t(c.kicker, "Docker · Portainer"), name, chip)}
      ${shown.length ? html`<div class="rows c-${c.columns || "auto"}">${shown.map((x) => this.row(x))}</div>`
        : html`<div class="msg">${all.length ? "Every container is running." : "No containers found. Check the endpoint device in the card settings."}</div>`}
      ${extra ? html`<button class="qbtn" @click=${() => (this._all = true)}>Show ${extra} more</button>` : c.max_rows && this._all ? html`<button class="qbtn" @click=${() => (this._all = false)}>Show fewer</button>` : nothing}
    </div>`, { style: `--run:${runC};--stop:${stopC};--busy:${this.colour(c.restarting_colour, "var(--tm-warn)")}` });
  }
}

import "../src/index";
import { pxToRows } from "../src/shared/grid";
import { MockHass, type Mode } from "./mock-hass";

const mock = new MockHass();
(window as any).mock = mock;

type Cell = { type: string; cols: number; rows?: number; config: Record<string, any> };
type Section = { id: string; title: string; cells: Cell[] };

const C = (type: string, cols: number, rows: number | undefined, config: Record<string, any>): Cell => ({ type, cols, rows, config });
const containers = ["portainer", "nginx-proxy-manager"];

const SECTIONS: Section[] = [
  { id: "thermostat", title: "Thermostat", cells: [
    C("thermostat", 6, 2, { entity: "climate.bedroom", layout: "compact" }),
    C("thermostat", 6, 2, { entity: "climate.office", layout: "compact" }),
    C("thermostat", 6, 4, { entity: "climate.living_room", layout: "standard" }),
    C("thermostat", 6, 5, { entity: "climate.living_room", layout: "large", presets: [{ name: "Night", icon: "moon", temperature: 16 }, { name: "Eco", icon: "leaf", temperature: 18 }, { name: "Comfort", icon: "heart", temperature: 21.5 }, { name: "Boost", icon: "bolt", temperature: 23 }] }),
  ] },
  { id: "sensor", title: "Sensor", cells: [
    C("sensor", 12, 4, { entity: "sensor.solar_power", kicker: "Generation", accent: "amber", status: "Generating", status_colour: "green",
      stats: [{ entity: "sensor.solar_energy_today", label: "Today" }, { computed: "max", label: "Peak" }, { entity: "sensor.solar_exported_today", label: "Exported" }, { entity: "sensor.solar_self_use", label: "Self-use" }] }),
    C("sensor", 6, 4, { entity: "sensor.house_power", kicker: "Using now", graph_type: "bar", status: "Using", above: 3000, above_status: "High", stats: [{ entity: "sensor.house_energy_today", label: "Today" }, { entity: "sensor.electricity_cost_today", label: "Cost", decimals: 2 }] }),
    C("sensor", 6, 2, { entity: "sensor.outside_temperature", layout: "compact", accent: "blue", graph_type: "line" }),
    C("sensor", 6, 2, { entity: "sensor.home_battery", layout: "compact", accent: "green", status: "Charging" }),
  ] },
  { id: "energy", title: "Energy", cells: (["large", "standard", "compact"] as const).map((layout) => C("energy", layout === "large" ? 12 : 6, { large: 4, standard: 6, compact: 4 }[layout], {
    layout, image: "/dev/ecoflow-stream.webp", glow_colour: layout === "standard" ? "blue" : "green",
    grid_power: "sensor.stream_grid_power", grid_energy: "sensor.stream_grid_energy_today", grid_cost: "sensor.stream_grid_cost_today",
    solar_power: "sensor.stream_solar_power", solar_energy: "sensor.stream_solar_energy_today",
    battery_power: "sensor.stream_battery_power", battery_soc: "sensor.stream_battery_soc", home_power: "sensor.stream_home_power",
  })) },
  { id: "charger", title: "EV charger", cells: [
    C("charger", 12, 4, { cost: "sensor.indra_session_cost", entity: "sensor.indra_status", name: "Driveway", layout: "large", image: "/dev/indra.webp", power: "sensor.indra_power", energy: "sensor.indra_session_energy" }),
    C("charger", 6, 4, { entity: "sensor.indra_status", name: "Driveway", layout: "standard", image: "/dev/indra.webp", power: "sensor.indra_power", energy: "sensor.indra_session_energy" }),
    C("charger", 6, 4, { power: "sensor.indra_power", energy: "sensor.indra_session_energy", energy_label: "this session", cost: "sensor.indra_session_cost", cost_label: "so far", name: "Power only", layout: "standard", image: "/dev/indra.webp" }),
    C("charger", 6, 2, { entity: "sensor.indra_status", name: "Driveway", layout: "compact", image: "/dev/indra.webp", power: "sensor.indra_power" }),
    C("charger", 6, 2, { entity: "sensor.indra_garage_status", name: "Garage", layout: "compact", image: "/dev/indra.webp" }),
  ] },
  { id: "media", title: "Media", cells: [
    C("media", 12, 4, { entity: "media_player.kitchen", layout: "standard", show_shuffle_repeat: true }),
    C("media", 6, 6, { entity: "media_player.kitchen", layout: "large" }),
    C("media", 6, 2, { entity: "media_player.lounge", layout: "compact" }),
    C("media", 6, 2, { entity: "media_player.office", layout: "compact" }),
  ] },
  { id: "lights", title: "Lights", cells: [
    C("light", 3, 2, { entity: "light.ceiling", layout: "compact", light_type: "downlight" }),
    C("light", 3, 2, { entity: "light.floor_lamp", layout: "compact" }),
    C("light", 3, 2, { entity: "light.reading_lamp", layout: "compact", light_type: "pendant" }),
    C("light", 3, 2, { entity: "light.porch", layout: "compact" }),
    C("light", 6, 4, { entity: "light.kitchen_pendants", layout: "standard", light_type: "pendant", colour_presets: [{ color: "red" }, { color: "teal" }, { color: "deep-purple" }] }),
    C("light", 6, 4, { entity: "light.ceiling", layout: "standard", light_type: "downlight" }),
    C("light", 6, 4, { entity: "light.reading_lamp", layout: "standard", light_type: "strip" }),
    C("light", 6, 4, { entity: "light.floor_lamp", layout: "standard", light_type: "pole" }),
    C("light-list", 6, undefined, { name: "Living room", lights: [["light.ceiling", "downlight"], ["light.floor_lamp", "pole"], ["light.reading_lamp", "pendant"], ["light.led_strip", "strip"], ["light.wall_washers", ""], ["light.cabinet", "strip"]].map(([entity, light_type]) => ({ entity, light_type })), colour_presets: [{ color: "red" }, { color: "teal" }] }),
  ] },
  { id: "vehicle", title: "Vehicle", cells: [
    ...(["large", "standard", "compact"] as const).flatMap((layout) => {
      const m140i = { name: "M140i", fuel_type: "ice", layout, image: "/dev/m140i.webp", range: "sensor.m140i_remaining_range_total", full_range: 400, odometer: "sensor.m140i_mileage", lock: "sensor.wba1s92020vd56534_doors_lock", doors: "binary_sensor.m140i_lids", windows: "binary_sensor.m140i_windows", location: "device_tracker.m140i" };
      const vivaro = { name: "eVivaro", fuel_type: "ev", layout, level: "sensor.evivaro_battery", charging: "binary_sensor.evivaro_charging", charging_power: "sensor.evivaro_charging_power", charge_limit: "number.evivaro_charge_limit", time_to_full: "sensor.evivaro_time_to_full", plugged: "binary_sensor.evivaro_plug", range: "sensor.evivaro_range", odometer: "sensor.evivaro_odometer", lock: "lock.evivaro_lock", location: "device_tracker.evivaro" };
      if (layout === "large") return [C("vehicle", 12, 4, m140i), C("vehicle", 6, 4, { ...m140i, layout: "auto" }), C("vehicle", 6, 5, { ...m140i, layout: "auto" })];
      const rows = layout === "standard" ? 5 : 3;
      return [C("vehicle", 6, rows, m140i), C("vehicle", 6, rows, vivaro)];
    }),
  ] },
  { id: "unifi", title: "Network", cells: (["large", "standard", "compact"] as const).map((layout) => C("unifi", layout === "compact" || layout === "standard" ? 6 : 12, { large: 3, standard: 4, compact: 2 }[layout], {
    layout, wan_status: "binary_sensor.udm_internet", download: "sensor.udm_wan_download", upload: "sensor.udm_wan_upload", latency: "sensor.udm_latency", wan_ip: "sensor.udm_wan_ip", isp: "sensor.udm_isp",
    clients_total: "sensor.udm_clients", clients_wireless: ["sensor.ap_lounge_clients", "sensor.ap_office_clients"], clients_wired: "sensor.udm_wired_clients", clients_guest: "sensor.udm_guest_clients",
  })) },
  { id: "docker", title: "Containers", cells: [
    C("portainer", 12, undefined, { device: "nas" }),
    C("portainer", 6, undefined, { device: "nas", max_rows: 5, pinned: containers }),
    C("portainer", 6, undefined, { device: "nas", only_stopped: true, compact_rows: true, kicker: "Needs attention" }),
  ] },
];

const app = document.getElementById("app")!;
const cards: HTMLElement[] = [];
const ro = new ResizeObserver((entries) => {
  for (const e of entries) {
    const cell = e.target as HTMLElement;
    if (cell.dataset.auto) cell.style.gridRow = `span ${pxToRows(cell.offsetHeight)}`;
  }
  drawCells();
});

function build() {
  app.innerHTML = "";
  cards.length = 0;
  for (const sec of SECTIONS) {
    const s = document.createElement("section");
    s.className = "sec"; s.id = sec.id;
    s.innerHTML = `<h2>${sec.title}</h2><div class="gridwrap"><div class="cells"></div><div class="ha-grid"></div></div>`;
    const grid = s.querySelector(".ha-grid")!;
    for (const c of sec.cells) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.style.gridColumn = `span ${c.cols}`;
      if (c.rows) cell.style.gridRow = `span ${c.rows}`; else { cell.dataset.auto = "1"; cell.style.alignSelf = "start"; }
      const el = document.createElement(`themisto-${c.type}-card`) as any;
      try { el.setConfig({ type: `custom:themisto-${c.type}-card`, ...c.config }); } catch (err) { cell.textContent = String(err); }
      el.hass = mock.hass;
      cell.appendChild(el);
      grid.appendChild(cell);
      cards.push(el);
      ro.observe(cell);
    }
    app.appendChild(s);
  }
  const b = document.createElement("section");
  b.className = "sec"; b.id = "badges";
  b.innerHTML = `<h2>Status badge</h2><div class="badges"></div>`;
  for (const [entity, extra] of [["binary_sensor.m140i_lids", { name: "Car doors" }], ["sensor.outside_temperature", {}], ["light.ceiling", {}], ["media_player.kitchen", {}], ["lock.m140i_lock", { name: "M140i" }], ["binary_sensor.udm_internet", {}], ["switch.radarr_container", { name: "Radarr" }]] as const) {
    const el = document.createElement("themisto-status-badge") as any;
    el.setConfig({ type: "custom:themisto-status-badge", entity, ...extra });
    el.hass = mock.hass;
    b.querySelector(".badges")!.appendChild(el);
    cards.push(el);
  }
  app.appendChild(b);
}

function drawCells() {
  document.querySelectorAll<HTMLElement>(".gridwrap").forEach((w) => {
    const grid = w.querySelector<HTMLElement>(".ha-grid")!, cells = w.querySelector<HTMLElement>(".cells")!;
    const rows = pxToRows(grid.offsetHeight);
    if (cells.childElementCount !== rows * 12) cells.innerHTML = "<i></i>".repeat(rows * 12);
  });
}

mock.subscribe((h) => cards.forEach((c: any) => (c.hass = h)));

// ---- toolbar ----
const log = document.getElementById("log")!;
let calls = 0;
mock.onCall = (d) => { log.textContent = d; log.classList.toggle("flash", ++calls % 2 === 1); };
document.addEventListener("hass-action", (e: any) => {
  const { config, action } = e.detail;
  const a = config[`${action}_action`] || { action: action === "tap" ? "more-info" : "none" };
  if (a.action === "toggle") mock.handle("homeassistant", "toggle", { entity_id: config.entity });
  else if (a.action === "perform-action" || a.action === "call-service") { const [d, s] = String(a.perform_action || a.service).split("."); mock.handle(d, s, { ...a.data, ...a.target }); }
  else log.textContent = `${a.action}  ${JSON.stringify({ entity_id: config.entity })}`;
});

const seg = (id: string, fn: (v: string) => void) => document.getElementById(id)!.addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest("button");
  if (!b) return;
  b.parentElement!.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  fn(b.dataset.v!);
});
seg("theme", (v) => { document.documentElement.dataset.theme = v; mock.setDark(v === "dark"); });
seg("data", (v) => { mock.reset(v as Mode); build(); });
seg("grid", (v) => document.body.classList.toggle("nogrid", v === "hide"));
let timer: number | undefined, tick = 0;
seg("live", (v) => { clearInterval(timer); if (v === "on") timer = window.setInterval(() => mock.stress(++tick), 1000); });
const width = document.getElementById("sw") as HTMLInputElement;
const setW = () => { document.documentElement.style.setProperty("--sw", `${width.value}px`); document.getElementById("swv")!.textContent = `${width.value}px`; };
width.addEventListener("input", setW);
const params = new URLSearchParams(location.search);
if (params.get("w")) width.value = params.get("w")!;
if (params.get("theme") === "dark") (document.querySelector('#theme [data-v="dark"]') as HTMLElement).click();
if (params.get("data")) (document.querySelector(`#data [data-v="${params.get("data")}"]`) as HTMLElement)?.click();
setW();
build();

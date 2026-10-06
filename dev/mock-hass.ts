// Mock Home Assistant for the dev harness: realistic entities, a history/stream subscription,
// and service calls that change state after a short delay, the way HA does.
import type { HassDevice, HassEntity, HassEntityRegistryEntry, HomeAssistant } from "../src/types";

export type Mode = "normal" | "worst" | "unavail";
type Listener = (h: HomeAssistant) => void;

const iso = (msAgo = 0) => new Date(Date.now() - msAgo).toISOString();
const ent = (entity_id: string, state: string | number, attributes: Record<string, any> = {}, changedAgo = 60_000): HassEntity =>
  ({ entity_id, state: String(state), attributes, last_changed: iso(changedAgo), last_updated: iso(changedAgo) });

const CONTAINERS = ["portainer", "nginx-proxy-manager", "mosquitto", "zigbee2mqtt", "frigate", "plex", "sonarr", "radarr", "prowlarr", "qbittorrent", "vaultwarden", "uptime-kuma", "pihole", "grafana", "influxdb"];
const slug = (s: string) => s.replace(/-/g, "_");

export function makeStates(mode: Mode): Record<string, HassEntity> {
  const W = mode === "worst", U = mode === "unavail";
  const list: HassEntity[] = [
    // climate
    ent("climate.living_room", "heat", { friendly_name: W ? "Downstairs living room & kitchen" : "Living room", hvac_modes: ["off", "heat"], hvac_action: "heating", current_temperature: 20.1, temperature: 21.5, current_humidity: 45, min_temp: 7, max_temp: 30, target_temp_step: 0.5 }),
    ent("climate.bedroom", U ? "unavailable" : "off", { friendly_name: "Bedroom", hvac_modes: ["off", "heat"], hvac_action: "off", current_temperature: 18.4, temperature: 18, current_humidity: 52, min_temp: 7, max_temp: 30, target_temp_step: 0.5 }),
    ent("climate.office", "heat", { friendly_name: W ? "Garden office annexe" : "Office", hvac_modes: ["off", "heat"], hvac_action: "idle", preset_mode: "eco", current_temperature: 20.4, temperature: 20, min_temp: 7, max_temp: 30, target_temp_step: 0.5 }),
    // sensors
    ent("sensor.solar_power", W ? 12300 : 3420, { friendly_name: "Solar", unit_of_measurement: "W", device_class: "power", state_class: "measurement" }),
    ent("sensor.solar_energy_today", W ? 128.4 : 12.1, { friendly_name: "Solar today", unit_of_measurement: "kWh", device_class: "energy" }),
    ent("sensor.solar_exported_today", W ? 64 : 2.3, { friendly_name: "Exported", unit_of_measurement: "kWh", device_class: "energy" }),
    ent("sensor.solar_self_use", 78, { friendly_name: "Self-use", unit_of_measurement: "%" }),
    ent("sensor.house_power", W ? 12300 : 1240, { friendly_name: "House", unit_of_measurement: "W", device_class: "power", state_class: "measurement" }),
    ent("sensor.house_energy_today", W ? 1046.9 : 14.6, { friendly_name: "Used today", unit_of_measurement: "kWh" }),
    ent("sensor.electricity_cost_today", W ? 1234.56 : 3.84, { friendly_name: "Cost today", unit_of_measurement: "£", suggested_display_precision: 2 }),
    ent("sensor.outside_temperature", 14.2, { friendly_name: W ? "Outside temperature north wall" : "Outside", unit_of_measurement: "°C", device_class: "temperature", state_class: "measurement" }),
    ent("sensor.home_battery", U ? "unavailable" : 82, { friendly_name: "Battery", unit_of_measurement: "%", device_class: "battery", state_class: "measurement" }),
    // media
    ent("media_player.kitchen", U ? "idle" : "playing", { friendly_name: "Kitchen", supported_features: 1 | 4 | 8 | 16 | 32 | 512 | 16384 | 32768 | 262144 | 524288, volume_level: 0.34, is_volume_muted: false,
      media_title: W ? "Teardrop (Mad Professor Mazaruni Vocal Mix) [2023 Remaster]" : "Teardrop", media_artist: W ? "Massive Attack, Elizabeth Fraser, Mad Professor" : "Massive Attack",
      media_duration: 330, media_position: 92, media_position_updated_at: iso(0), group_members: ["media_player.kitchen", "media_player.lounge"], shuffle: false, repeat: "off" }),
    ent("media_player.lounge", "paused", { friendly_name: "Lounge", supported_features: 1 | 4 | 16 | 32 | 512 | 16384, volume_level: 0.2, media_title: "Discover Weekly", media_artist: "Spotify", group_members: ["media_player.kitchen", "media_player.lounge"] }),
    ent("media_player.office", "idle", { friendly_name: "Office", supported_features: 1 | 4 | 512 | 16384, volume_level: 0.15 }),
    ent("sensor.sonos_favorites", 6, { friendly_name: "Sonos favorites", items: { "FV:2/31": "BBC Radio 6 Music", "FV:2/12": "Discover Weekly", "FV:2/7": "Jazz FM", "FV:2/40": "Daily Mix 1", "FV:2/22": "Lo-fi Beats", "FV:2/3": "Classic FM" } }),
    // lights
    ent("light.ceiling", "on", { friendly_name: "Ceiling", supported_color_modes: ["color_temp"], color_mode: "color_temp", brightness: 184, color_temp_kelvin: 2700, min_color_temp_kelvin: 2200, max_color_temp_kelvin: 6500 }),
    ent("light.floor_lamp", "on", { friendly_name: W ? "Floor lamp by the bay window" : "Floor lamp", supported_color_modes: ["onoff"], color_mode: "onoff" }),
    ent("light.reading_lamp", "on", { friendly_name: "Reading lamp", supported_color_modes: ["brightness"], color_mode: "brightness", brightness: 89 }),
    ent("light.led_strip", "off", { friendly_name: "LED strip", supported_color_modes: ["color_temp", "hs"], min_color_temp_kelvin: 2000, max_color_temp_kelvin: 6500 }),
    ent("light.wall_washers", "off", { friendly_name: "Wall washers", supported_color_modes: ["brightness"] }),
    ent("light.cabinet", U ? "unavailable" : "off", { friendly_name: "Cabinet", supported_color_modes: ["onoff"] }),
    ent("light.porch", "off", { friendly_name: "Porch", supported_color_modes: ["onoff"] }),
    ent("light.kitchen_pendants", "on", { friendly_name: W ? "Kitchen island pendants" : "Kitchen pendants", supported_color_modes: ["color_temp", "hs"], color_mode: "color_temp", brightness: 163, color_temp_kelvin: 3000, min_color_temp_kelvin: 2200, max_color_temp_kelvin: 6500 }),
    // vehicles
    ent("sensor.m140i_remaining_fuel_percent", W ? 4 : 62, { friendly_name: "M140i Fuel", unit_of_measurement: "%" }, 240_000),
    ent("sensor.m140i_remaining_range_total", W ? 9 : 248, { friendly_name: "M140i Range", unit_of_measurement: "mi" }),
    ent("sensor.m140i_mileage", W ? 188402 : 48213, { friendly_name: "M140i Mileage", unit_of_measurement: "mi" }),
    ent("lock.m140i_lock", W ? "unlocked" : "locked", { friendly_name: "M140i Lock" }),
    ent("sensor.wba1s92020vd56534_doors_lock", W ? "SELECTIVE_LOCKED" : "LOCKED", { friendly_name: "M140i Door lock" }),
    ent("binary_sensor.m140i_lids", W ? "on" : "off", { friendly_name: "M140i Doors", device_class: "door" }),
    ent("binary_sensor.m140i_windows", "off", { friendly_name: "M140i Windows", device_class: "window" }),
    ent("device_tracker.m140i", W ? "Tesco Extra car park, Leatherhead" : "home", { friendly_name: "M140i" }),
    ent("sensor.evivaro_battery", U ? "unavailable" : W ? 100 : 72, { friendly_name: "eVivaro Battery", unit_of_measurement: "%", device_class: "battery" }, 3 * 86400_000),
    ent("binary_sensor.evivaro_charging", W ? "off" : "on", { friendly_name: "eVivaro Charging", device_class: "battery_charging" }),
    ent("sensor.evivaro_charging_power", 7.2, { friendly_name: "eVivaro Charging power", unit_of_measurement: "kW", device_class: "power" }),
    ent("number.evivaro_charge_limit", 90, { friendly_name: "eVivaro Charge limit", unit_of_measurement: "%" }),
    ent("sensor.evivaro_time_to_full", "1h 50m", { friendly_name: "eVivaro Time to full" }),
    ent("binary_sensor.evivaro_plug", "on", { friendly_name: "eVivaro Plug", device_class: "plug" }),
    ent("sensor.evivaro_range", W ? 1012 : 142, { friendly_name: "eVivaro Range", unit_of_measurement: "mi" }),
    ent("sensor.evivaro_odometer", 18402, { friendly_name: "eVivaro Odometer", unit_of_measurement: "mi" }),
    ent("lock.evivaro_lock", "locked", { friendly_name: "eVivaro Lock" }),
    ent("device_tracker.evivaro", "home", { friendly_name: "eVivaro" }),
    // EcoFlow STREAM
    ent("sensor.stream_grid_power", W ? -4200 : 640, { friendly_name: "Grid power", unit_of_measurement: "W", device_class: "power" }),
    ent("sensor.stream_grid_energy_today", W ? 104.2 : 6.8, { friendly_name: "Grid today", unit_of_measurement: "kWh", device_class: "energy" }),
    ent("sensor.stream_grid_cost_today", W ? 1234.56 : 1.87, { friendly_name: "Grid cost today", unit_of_measurement: "£" }),
    ent("sensor.stream_solar_power", W ? 12300 : 1820, { friendly_name: "Solar power", unit_of_measurement: "W", device_class: "power" }),
    ent("sensor.stream_solar_energy_today", W ? 88.4 : 7.4, { friendly_name: "Solar today", unit_of_measurement: "kWh", device_class: "energy" }),
    ent("sensor.stream_battery_power", W ? -3800 : -420, { friendly_name: "Battery power", unit_of_measurement: "W", device_class: "power" }),
    ent("sensor.stream_battery_soc", U ? "unavailable" : W ? 9 : 64, { friendly_name: "Battery", unit_of_measurement: "%", device_class: "battery" }),
    ent("sensor.stream_home_power", W ? 12300 : 2040, { friendly_name: "Home power", unit_of_measurement: "W", device_class: "power" }),
    // EV charger
    ent("sensor.indra_status", U ? "unavailable" : W ? "plugged_in" : "charging", { friendly_name: "Indra charger" }),
    ent("sensor.indra_garage_status", "idle", { friendly_name: "Garage charger" }),
    ent("sensor.indra_power", W ? 22 : 7.2, { friendly_name: "Charging power", unit_of_measurement: "kW", device_class: "power" }),
    ent("sensor.indra_session_cost", W ? 31.38 : 3.72, { friendly_name: "Session cost", unit_of_measurement: "GBP", device_class: "monetary" }),
    ent("sensor.indra_session_energy", W ? 104.6 : 12.4, { friendly_name: "Session energy", unit_of_measurement: "kWh", device_class: "energy" }),
    // network
    ent("binary_sensor.udm_internet", U ? "off" : "on", { friendly_name: "Internet", device_class: "connectivity" }),
    ent("sensor.udm_wan_download", W ? 2480 : 412, { friendly_name: "WAN download", unit_of_measurement: "Mbit/s", state_class: "measurement" }),
    ent("sensor.udm_wan_upload", W ? 980 : 38, { friendly_name: "WAN upload", unit_of_measurement: "Mbit/s", state_class: "measurement" }),
    ent("sensor.udm_latency", W ? 84 : 9, { friendly_name: "Latency", unit_of_measurement: "ms" }),
    ent("sensor.udm_wan_ip", "81.2.69.142", { friendly_name: "WAN IP" }),
    ent("sensor.udm_isp", W ? "Community Fibre Business 3000" : "Community Fibre", { friendly_name: "ISP" }),
    ent("sensor.udm_clients", W ? 248 : 47, { friendly_name: "Clients" }),
    ent("sensor.ap_lounge_clients", W ? 120 : 20, { friendly_name: "Lounge AP clients" }),
    ent("sensor.ap_office_clients", W ? 81 : 18, { friendly_name: "Office AP clients" }),
    ent("sensor.udm_wired_clients", W ? 47 : 9, { friendly_name: "Wired clients" }),
    ent("sensor.udm_guest_clients", W ? 32 : 3, { friendly_name: "Guest clients" }),
  ];
  CONTAINERS.forEach((c, i) => {
    const name = W && c === "grafana" ? "home-assistant-matter-server-beta" : c;
    const down = c === "radarr" || (U && (c === "pihole" || c === "influxdb"));
    const s = slug(name);
    list.push(
      ent(`switch.${s}_container`, down ? "off" : "on", { friendly_name: `${name} Container` }),
      ent(`button.${s}_restart_container`, "unknown", { friendly_name: `${name} Restart` }),
      ent(`binary_sensor.${s}_status`, down ? "off" : "on", { friendly_name: `${name} Status`, device_class: "running" }),
      ent(`sensor.${s}_cpu_usage`, down ? 0 : W && c === "frigate" ? 186.4 : [0.4, 0.8, 0.2, 1.9, 24.6, 3.1, 0.6, 0, 0.3, 5.2, 0.1, 0.9, 0.5, 0.7, 2.2][i], { unit_of_measurement: "%" }),
      ent(`sensor.${s}_memory_usage`, down ? 0 : W && c === "frigate" ? 14820 : [38, 142, 9, 188, 1630, 912, 301, 0, 168, 640, 54, 120, 96, 210, 480][i], { unit_of_measurement: "MB" }),
      ent(`sensor.${s}_started`, iso([12, 12, 12, 3, 3, 0.25, 12, 0, 12, 2, 12, 12, 12, 12, 12][i] * 86400_000), { device_class: "timestamp" }),
    );
  });
  return Object.fromEntries(list.map((e) => [e.entity_id, e]));
}

function registry(states: Record<string, HassEntity>) {
  const devices: Record<string, HassDevice> = { nas: { id: "nas", name: "Themisto NAS" } };
  const entities: Record<string, HassEntityRegistryEntry> = {};
  for (const id of Object.keys(states)) {
    const m = id.match(/^(switch|button|binary_sensor|sensor)\.(.+?)_(container|restart_container|status|cpu_usage|memory_usage|started)$/);
    if (m) {
      const dev = `c_${m[2]}`;
      devices[dev] ||= { id: dev, name: m[2].replace(/_/g, "-"), via_device_id: "nas" };
      entities[id] = { entity_id: id, device_id: dev, platform: "portainer", translation_key: m[3] };
    } else entities[id] = { entity_id: id, platform: id.startsWith("media_player.") ? "sonos" : "demo" };
  }
  return { devices, entities };
}

// Synthetic 7-day history so every graph has something to draw.
function historyFor(id: string, s: HassEntity, hours: number): { s: string; lu: number }[] {
  const now = Date.now() / 1000, out: { s: string; lu: number }[] = [];
  const cur = parseFloat(s.state);
  if (!Number.isFinite(cur)) return [{ s: s.state, lu: now - hours * 3600 }];
  const step = hours <= 2 ? 60 : 300;
  for (let t = now - hours * 3600; t < now; t += step) {
    const d = new Date(t * 1000), h = d.getHours() + d.getMinutes() / 60;
    let v: number;
    if (id.includes("solar_power")) { const b = Math.max(0, Math.sin(((h - 6.5) / 13) * Math.PI)); v = b * b * (cur > 5000 ? 12800 : 4800) * (0.75 + 0.25 * Math.random()); }
    else if (id.includes("house_power")) v = 350 + 250 * Math.random() + ((h > 7 && h < 9) ? 1500 : (h > 18 && h < 20) ? 2300 : 0);
    else if (id.includes("temperature")) v = 9 + 5 * Math.sin(((h - 8) / 24) * 2 * Math.PI) + Math.random() * 0.3;
    else if (id.includes("battery")) v = h < 5 ? 40 - h * 3 : h < 7 ? 26 : h < 13 ? 26 + (h - 7) * 9.6 : 82;
    else v = cur * (0.6 + 0.8 * Math.random());
    out.push({ s: v.toFixed(2), lu: t });
  }
  out.push({ s: s.state, lu: now });
  return out;
}

export class MockHass {
  hass!: HomeAssistant;
  private listeners: Listener[] = [];
  private subs = new Map<number, { ids: string[]; cb: (m: any) => void }>();
  private subId = 0;
  onCall: (desc: string) => void = () => {};
  dark = false;
  mode: Mode = "normal";

  constructor() { this.reset("normal"); }

  reset(mode: Mode) {
    this.mode = mode;
    const states = makeStates(mode);
    this.publish(states);
  }

  subscribe(l: Listener) { this.listeners.push(l); l(this.hass); }

  setDark(d: boolean) { this.dark = d; this.publish(this.hass.states); }

  /** Replaces one entity (new object → cards watching it re-render) and streams it to history subscribers. */
  set(id: string, state: string | number, attrs: Record<string, any> = {}) {
    const old = this.hass.states[id];
    if (!old) return;
    const now = new Date().toISOString();
    const next: HassEntity = { ...old, state: String(state), attributes: { ...old.attributes, ...attrs }, last_updated: now, last_changed: String(state) !== old.state ? now : old.last_changed };
    this.publish({ ...this.hass.states, [id]: next });
    for (const sub of this.subs.values()) if (sub.ids.includes(id)) sub.cb({ states: { [id]: [{ s: next.state, lu: Date.now() / 1000 }] } });
  }

  private publish(states: Record<string, HassEntity>) {
    const { devices, entities } = registry(states);
    const self = this;
    const prev = this.hass;
    this.hass = {
      states,
      devices: prev && Object.keys(prev.devices || {}).length === Object.keys(devices).length ? prev.devices : devices,
      entities: prev && Object.keys(prev.entities || {}).length === Object.keys(entities).length ? prev.entities : entities,
      themes: { darkMode: this.dark },
      locale: prev?.themes?.darkMode === this.dark && prev?.locale ? prev.locale : { language: "en-GB" },
      language: "en-GB",
      connection: {
        subscribeMessage(cb: (m: any) => void, msg: Record<string, any>) {
          const id = ++self.subId;
          const ids: string[] = msg.entity_ids || [];
          const hours = (Date.now() - Date.parse(msg.start_time)) / 3600_000;
          self.subs.set(id, { ids, cb });
          setTimeout(() => cb({ states: Object.fromEntries(ids.map((e) => [e, self.hass.states[e] ? historyFor(e, self.hass.states[e], hours) : []])) }), 50);
          return Promise.resolve(() => self.subs.delete(id));
        },
      },
      callWS: (msg: Record<string, any>) => {
        // Sonos browse: "favorites" lists folders, "favorites_folder" lists items with thumbnails.
        const items: Record<string, string> = self.hass.states["sensor.sonos_favorites"]?.attributes.items || {};
        const art = (id: string, i: number) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="hsl(${i * 57} 60% 45%)"/><circle cx="3" cy="3" r="3" fill="hsl(${i * 57 + 40} 80% 70%)"/></svg>`)}`;
        if (msg.media_content_type === "favorites") return Promise.resolve({ children: [{ media_content_type: "favorites_folder", media_content_id: "object.item.audioItem.audioBroadcast" }] });
        if (msg.media_content_type === "favorites_folder") return Promise.resolve({ children: Object.keys(items).filter((_, i) => i !== 2).map((id, i) => ({ media_content_id: id, media_content_type: "favorite_item_id", thumbnail: art(id, i) })) });
        return Promise.reject(new Error("unknown"));
      },
      callService: (domain: string, service: string, data: Record<string, any> = {}) => { this.handle(domain, service, data); return Promise.resolve(); },
      formatEntityState: (s: HassEntity, state?: string) => {
        const v = state ?? s.state;
        const u = s.attributes.unit_of_measurement;
        if (s.entity_id.startsWith("device_tracker.")) return v === "home" ? "Home" : v === "not_home" ? "Away" : v;
        const map: Record<string, string> = { heat: "Heat", off: "Off", playing: "Playing", paused: "Paused", idle: "Idle", locked: "Locked", unlocked: "Unlocked", unavailable: "Unavailable", on: "On", heat_cool: "Heat/Cool" };
        return map[v] ?? `${v}${u ? ` ${u}` : ""}`;
      },
      formatEntityAttributeValue: (_s: HassEntity, attr: string, value?: unknown) => (attr === "hvac_action" ? ({ heating: "Heating", idle: "Idle", off: "Off", cooling: "Cooling" } as Record<string, string>)[String(value)] ?? String(value) : String(value)),
    } as HomeAssistant;
    this.listeners.forEach((l) => l(this.hass));
  }

  private later(fn: () => void, ms = 250) { setTimeout(fn, ms); }

  handle(domain: string, service: string, data: Record<string, any>) {
    this.onCall(`${domain}.${service}  ${JSON.stringify(data)}`);
    const ids: string[] = [].concat(data.entity_id || []);
    for (const id of ids) {
      const s = this.hass.states[id];
      if (!s) continue;
      const d = id.split(".")[0];
      this.later(() => {
        if (d === "light" || (domain === "homeassistant" && d === "light")) {
          const on = service === "turn_on" || (service === "toggle" && s.state !== "on");
          const a: Record<string, any> = {};
          if (data.brightness_pct !== undefined) a.brightness = Math.round((data.brightness_pct / 100) * 255);
          if (data.color_temp_kelvin) Object.assign(a, { color_temp_kelvin: data.color_temp_kelvin, color_mode: "color_temp" });
          if (data.rgb_color) Object.assign(a, { rgb_color: data.rgb_color, color_mode: "hs" });
          if (on && !s.attributes.brightness && s.attributes.supported_color_modes?.some((m: string) => m !== "onoff")) a.brightness ??= 180;
          this.set(id, on ? "on" : "off", a);
        } else if (domain === "climate") {
          if (service === "set_temperature") {
            const a: Record<string, any> = {};
            if (data.temperature !== undefined) a.temperature = data.temperature;
            if (data.target_temp_low !== undefined) Object.assign(a, { target_temp_low: data.target_temp_low, target_temp_high: data.target_temp_high });
            const mode = data.hvac_mode || s.state;
            a.hvac_action = mode === "off" ? "off" : (a.temperature ?? s.attributes.temperature) > s.attributes.current_temperature ? "heating" : "idle";
            this.set(id, mode, a);
          }
          if (service === "set_hvac_mode") this.set(id, data.hvac_mode, { hvac_action: data.hvac_mode === "off" ? "off" : s.attributes.temperature > s.attributes.current_temperature ? "heating" : "idle" });
        } else if (domain === "media_player") {
          const a = s.attributes;
          if (service === "media_play") this.set(id, "playing", { media_position_updated_at: new Date().toISOString() });
          if (service === "media_pause") this.set(id, "paused", { media_position: a.media_position + (Date.now() - Date.parse(a.media_position_updated_at || new Date().toISOString())) / 1000 });
          if (service === "volume_set") this.set(id, s.state, { volume_level: data.volume_level });
          if (service === "volume_mute") this.set(id, s.state, { is_volume_muted: data.is_volume_muted });
          if (service === "shuffle_set") this.set(id, s.state, { shuffle: data.shuffle });
          if (service === "repeat_set") this.set(id, s.state, { repeat: data.repeat });
          if (service === "play_media") {
            const name = this.hass.states["sensor.sonos_favorites"].attributes.items[data.media_content_id] || "Favourite";
            this.set(id, "playing", { media_title: name, media_artist: "Sonos favourite", media_duration: /Radio|FM/.test(name) ? 0 : 240, media_position: 0, media_position_updated_at: new Date().toISOString() });
          }
          if (service === "media_next_track" || service === "media_previous_track") this.set(id, "playing", { media_title: service.includes("next") ? "Angel" : "Protection", media_position: 0, media_position_updated_at: new Date().toISOString() });
        } else if (domain === "switch" || (domain === "homeassistant" && d === "switch")) {
          const on = service === "turn_on" || (service === "toggle" && s.state !== "on");
          this.set(id, on ? "on" : "off");
          const base = id.slice(7, -"_container".length);
          this.set(`binary_sensor.${base}_status`, on ? "on" : "off");
          if (on) this.set(`sensor.${base}_started`, new Date().toISOString());
        } else if (domain === "button" && id.endsWith("_restart_container")) {
          const base = id.slice(7, -"_restart_container".length);
          this.set(`sensor.${base}_started`, new Date().toISOString());
          this.set(`switch.${base}_container`, "on");
        } else if (domain === "lock") this.set(id, service === "lock" ? "locked" : "unlocked");
      });
    }
  }

  /** Stress mode: change many entities the visible cards don't care about, plus a few they do. */
  stress(tick: number) {
    const r = Math.random;
    const st = this.hass.states;
    const drift = (id: string, f = 0.1, min = 0) => { const v = parseFloat(st[id]?.state); if (Number.isFinite(v)) this.set(id, Math.max(min, v * (1 - f + 2 * f * r())).toFixed(2)); };
    drift("sensor.solar_power", 0.06); drift("sensor.house_power", 0.1, 150); drift("sensor.udm_wan_download", 0.2, 1); drift("sensor.udm_wan_upload", 0.2, 1);
    CONTAINERS.forEach((c) => drift(`sensor.${slug(c)}_cpu_usage`, 0.2));
    if (tick % 3 === 0) {
      this.set("light.ceiling", "on", { brightness: Math.round(40 + r() * 200) });
      this.set("media_player.kitchen", st["media_player.kitchen"].state, { volume_level: Math.round(10 + r() * 60) / 100 });
    }
  }
}

import "../src/index";
import { MockHass } from "./mock-hass";

const mock = new MockHass();
const bri75 = Math.round(255 * 0.75);

mock.set("sensor.m140i_remaining_fuel_percent", 55, { friendly_name: "M140i Fuel", unit_of_measurement: "L" });
mock.set("sensor.wba1s92020vd56534_doors_lock", "LOCKED");
mock.set("device_tracker.m140i", "home");
mock.set("sensor.evivaro_battery", 45);
mock.set("binary_sensor.evivaro_charging", "on");
mock.set("sensor.evivaro_charging_power", 7.2);
mock.set("sensor.evivaro_time_to_full", "2h 35m");

mock.set("light.ceiling", "on", { friendly_name: "Spotlights", supported_color_modes: ["brightness"], color_mode: "brightness", brightness: bri75, rgb_color: undefined, color_temp_kelvin: undefined });
mock.set("light.reading_lamp", "on", { friendly_name: "Bedside left", supported_color_modes: ["hs", "brightness"], color_mode: "hs", brightness: bri75, rgb_color: [151, 71, 255] });
mock.set("light.kitchen_pendants", "on", { friendly_name: "Bedside right", supported_color_modes: ["hs", "brightness"], color_mode: "hs", brightness: bri75, rgb_color: [151, 71, 255] });
mock.set("light.led_strip", "on", { friendly_name: "Lightstrip", supported_color_modes: ["hs", "brightness"], color_mode: "hs", brightness: bri75, rgb_color: [255, 133, 38] });

mock.set("sensor.stream_grid_power", 420);
mock.set("sensor.stream_grid_energy_today", 4.8);
mock.set("sensor.stream_grid_cost_today", 1.42);
mock.set("sensor.stream_solar_power", 1860);
mock.set("sensor.stream_solar_energy_today", 7.6);
mock.set("sensor.stream_battery_power", -640);
mock.set("sensor.stream_battery_soc", 63);
mock.set("sensor.stream_home_power", 1220);

mock.set("media_player.kitchen", "playing", {
  friendly_name: "Living room",
  media_title: "Where Is the Love?",
  media_artist: "The Black Eyed Peas",
  media_duration: 272,
  media_position: 98,
  media_position_updated_at: new Date().toISOString(),
  volume_level: 0.38,
  group_members: ["media_player.kitchen"],
  entity_picture: "https://i5.walmartimages.com/seo/The-Black-Eyed-Peas-Elephunk-A-M-Records-Audio-CD-2003-0602498606377_0da0a93f-ca32-4e5d-ae69-ddc1e558ba77.ef241aa18913906626ca51c859fe6d3e.jpeg?odnBg=FFFFFF&odnHeight=768&odnWidth=768",
});
mock.set("sensor.sonos_favorites", 5, { items: {
  "FV:radio1": "BBC Radio 1",
  "FV:radio6": "BBC Radio 6 Music",
  "FV:jazz": "Jazz FM",
  "FV:classic": "Classic FM",
  "FV:discover": "Discover Weekly",
} });
mock.setDark(true);

type Card = { id: string; type: string; className: string; config: Record<string, unknown> };
const cards: Card[] = [
  { id: "m140i", type: "vehicle", className: "vehicle", config: {
    name: "M140i", fuel_type: "ice", layout: "compact", image: "/dev/m140i.webp",
    level: "sensor.m140i_remaining_fuel_percent", level_capacity: 55, level_colour: "blue", lock: "sensor.wba1s92020vd56534_doors_lock",
    location: "device_tracker.m140i", chips: ["lock", "location"], show_updated: false,
  } },
  { id: "evivaro", type: "vehicle", className: "vehicle", config: {
    name: "E-VIVARO", fuel_type: "ev", layout: "compact", image: "/assets/evivaro.webp",
    level: "sensor.evivaro_battery", charging: "binary_sensor.evivaro_charging",
    charging_power: "sensor.evivaro_charging_power", time_to_full: "sensor.evivaro_time_to_full",
    plugged: "binary_sensor.evivaro_plug", chips: ["plugged"], show_updated: false,
  } },
  { id: "lights", type: "light-list", className: "lights", config: {
    name: "BEDROOM", kicker: "Lights", columns: "1", show_all_off: true,
    lights: [
      { entity: "light.ceiling", name: "Spotlights", light_type: "downlight" },
      { entity: "light.reading_lamp", name: "Bedside left", light_type: "pendant" },
      { entity: "light.kitchen_pendants", name: "Bedside right", light_type: "pendant" },
      { entity: "light.led_strip", name: "Lightstrip", light_type: "strip" },
    ],
  } },
  { id: "energy", type: "energy", className: "energy", config: {
    name: "ECOFLOW", kicker: "Home energy", layout: "standard", image: "/dev/ecoflow-stream.webp", glow_colour: "green",
    grid_name: " ", solar_name: " ", battery_name: " ", home_name: " ",
    grid_power: "sensor.stream_grid_power", grid_energy: "sensor.stream_grid_energy_today", grid_cost: "sensor.stream_grid_cost_today",
    solar_power: "sensor.stream_solar_power", solar_energy: "sensor.stream_solar_energy_today",
    battery_power: "sensor.stream_battery_power", battery_soc: "sensor.stream_battery_soc", home_power: "sensor.stream_home_power",
  } },
  { id: "sonos", type: "media", className: "sonos", config: {
    name: "Living room", kicker: "Sonos", entity: "media_player.kitchen", layout: "standard",
    favourites_entity: "sensor.sonos_favorites", favourites_include: ["FV:radio1", "FV:radio6", "FV:jazz", "FV:classic", "FV:discover"],
    show_favourites: true, show_shuffle_repeat: true,
  } },
];

const root = document.getElementById("cards")!;
const only = new URLSearchParams(location.search).get("card");
if (only) document.body.classList.add("single");
for (const card of cards.filter((c) => !only || c.id === only)) {
  const cell = document.createElement("div");
  cell.className = `cell ${card.className}`;
  cell.dataset.card = card.id;
  const el = document.createElement(`themisto-${card.type}-card`) as any;
  el.setConfig({ type: `custom:themisto-${card.type}-card`, ...card.config });
  el.hass = mock.hass;
  cell.appendChild(el);
  root.appendChild(cell);
}

import { registerFonts } from "./shared/fonts";
import { ThemistoChargerCard } from "./cards/charger";
import { ThemistoEnergyCard } from "./cards/energy";
import { ThemistoHeadingCard } from "./cards/heading";
import { ThemistoLightCard } from "./cards/light";
import { ThemistoLightListCard } from "./cards/light-list";
import { ThemistoMediaCard } from "./cards/media";
import { ThemistoPortainerCard } from "./cards/portainer";
import { ThemistoSensorCard } from "./cards/sensor";
import { ThemistoStatusBadge } from "./cards/status-badge";
import { ThemistoThermostatCard } from "./cards/thermostat";
import { ThemistoUnifiCard } from "./cards/unifi";
import { ThemistoVehicleCard } from "./cards/vehicle";

export const VERSION = "2.14.0";
const DOCS = "https://github.com/sjbradley98/themisto-cards";

registerFonts();

const CARDS: [string, CustomElementConstructor, string, string][] = [
  ["themisto-heading-card", ThemistoHeadingCard, "Themisto Heading", "A page or section title with live status pills"],
  ["themisto-thermostat-card", ThemistoThermostatCard, "Themisto Thermostat", "Target temperature, modes and your own presets"],
  ["themisto-sensor-card", ThemistoSensorCard, "Themisto Sensor", "A big reading with a history graph and side stats"],
  ["themisto-energy-card", ThemistoEnergyCard, "Themisto Energy", "Grid, solar, battery and home power with your battery unit's picture"],
  ["themisto-charger-card", ThemistoChargerCard, "Themisto EV Charger", "Your charger's picture with its lights animated while charging"],
  ["themisto-media-card", ThemistoMediaCard, "Themisto Media", "Sonos and other players with your favourites"],
  ["themisto-light-card", ThemistoLightCard, "Themisto Light", "One light: a tile you drag to dim, or full controls"],
  ["themisto-light-list-card", ThemistoLightListCard, "Themisto Light List", "Several lights as rows that open for brightness and colour"],
  ["themisto-vehicle-card", ThemistoVehicleCard, "Themisto Vehicle", "Fuel or battery, range, charging, lock and location"],
  ["themisto-unifi-card", ThemistoUnifiCard, "Themisto Network", "Internet status, speed and client counts"],
  ["themisto-portainer-card", ThemistoPortainerCard, "Themisto Containers", "Docker containers from Portainer, with restart"],
];

const w = window as any;
w.customCards = w.customCards || [];
for (const [tag, cls, name, description] of CARDS) {
  if (!customElements.get(tag)) customElements.define(tag, cls);
  if (!w.customCards.some((c: { type: string }) => c.type === tag)) w.customCards.push({ type: tag, name, description, preview: true, documentationURL: DOCS });
}

if (!customElements.get("themisto-status-badge")) customElements.define("themisto-status-badge", ThemistoStatusBadge);
w.customBadges = w.customBadges || [];
if (!w.customBadges.some((b: { type: string }) => b.type === "themisto-status-badge")) {
  w.customBadges.push({ type: "themisto-status-badge", name: "Themisto Status", description: "A frosted status chip for any entity", preview: true });
}

console.info(`%c THEMISTO CARDS %c ${VERSION} `, "color:#fff;background:#2451d6;font-weight:bold", "color:#2451d6;background:#e6edfa");

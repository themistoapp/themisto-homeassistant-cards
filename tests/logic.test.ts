import { describe, expect, it } from "vitest";
import { gridOptionsFor, layoutForHeight, pxToRows, rowsToPx } from "../src/shared/grid";
import { bucket } from "../src/shared/history";
import { formatPower, formatRate, measure, toMbps } from "../src/shared/format";
import { text, cssColour, relativeTime } from "../src/shared/util";
import { stepTarget } from "../src/cards/thermostat";
import { computeStat } from "../src/cards/sensor";
import { isCharging, isOpen, levelFromRange, lockState } from "../src/cards/vehicle";
import { wanOnline } from "../src/cards/unifi";
import { discover } from "../src/cards/portainer";
import { autoColour } from "../src/cards/status-badge";
import { flow } from "../src/cards/energy";
import { chargerState, deriveChargerState } from "../src/cards/charger";
import { caps, defaultTemps, kelvinToCss } from "../src/shared/light";

const st = (entity_id: string, state: string, attributes: Record<string, unknown> = {}) =>
  ({ entity_id, state, attributes, last_changed: "", last_updated: "" });

describe("grid", () => {
  it("matches HA's sections grid heights", () => {
    expect([2, 3, 4, 5, 6].map(rowsToPx)).toEqual([120, 184, 248, 312, 376]);
    expect(pxToRows(248)).toBe(4);
    expect(pxToRows(249)).toBe(5);
  });
  it("picks the largest preset that fits the measured height", () => {
    const p = { compact: { rows: 2 }, standard: { rows: 4 }, large: { rows: 5 } };
    expect(layoutForHeight(p, 120)).toBe("compact");
    expect(layoutForHeight(p, 184)).toBe("compact");
    const wide = { compact: { columns: 6, rows: 3 }, standard: { columns: 6, rows: 6 }, large: { columns: 12, rows: 4 } };
    expect(layoutForHeight(wide, 248, 900)).toBe("large");
    expect(layoutForHeight(wide, 248, 320)).toBe("compact");
    expect(layoutForHeight(wide, 376, 320)).toBe("standard");
    expect(layoutForHeight(p, 248)).toBe("standard");
    expect(layoutForHeight(p, 400)).toBe("large");
  });
  it("uses the compact preset as the minimum", () => {
    expect(gridOptionsFor({ compact: { columns: 6, rows: 2 }, standard: { columns: 6, rows: 4 } }, "standard")).toMatchObject({ rows: 4, min_rows: 2 });
  });
});

describe("history bucketing", () => {
  it("averages inside a bucket, carries forward, and keeps unavailable gaps", () => {
    const s = [{ t: 0, v: 10 }, { t: 5, v: 20 }, { t: 25, v: null }, { t: 35, v: 30 }];
    expect(bucket(s, 0, 40, 4)).toEqual([15, 20, null, 30]);
  });
  it("starts from the last value before the window", () => {
    expect(bucket([{ t: -100, v: 7 }], 0, 20, 2)).toEqual([7, 7]);
  });
  it("is null before any data", () => {
    expect(bucket([{ t: 15, v: 1 }], 0, 20, 2)).toEqual([null, 1]);
  });
});

describe("formatting", () => {
  it("scales power", () => {
    expect(formatPower(undefined, 950)).toEqual({ value: "950", unit: "W" });
    expect(formatPower(undefined, 3420)).toEqual({ value: "3.42", unit: "kW" });
    expect(formatPower(undefined, 12300)).toEqual({ value: "12.3", unit: "kW" });
  });
  it("scales throughput and converts units", () => {
    expect(formatRate(undefined, 0.5)).toEqual({ value: "500", unit: "kb/s" });
    expect(formatRate(undefined, 412)).toEqual({ value: "412", unit: "Mb/s" });
    expect(formatRate(undefined, 2480)).toEqual({ value: "2.48", unit: "Gb/s" });
    expect(toMbps(50, "MB/s")).toBe(400);
    expect(toMbps(1000, "kbit/s")).toBe(1);
  });
  it("honours unit and decimals overrides", () => {
    expect(measure(undefined, st("sensor.p", "1500", { unit_of_measurement: "W" }))).toMatchObject({ value: "1.5", unit: "kW" });
    expect(measure(undefined, st("sensor.c", "3.84", { unit_of_measurement: "£" }))).toMatchObject({ value: "£3.84", unit: "" });
    expect(formatPower(undefined, 7200)).toEqual({ value: "7.2", unit: "kW" });
    expect(measure(undefined, st("sensor.p", "1500", { unit_of_measurement: "W" }), { scale_power: false, decimals: 0 })).toMatchObject({ value: "1,500", unit: "W" });
    expect(measure(undefined, st("sensor.t", "14.23", { unit_of_measurement: "°C" }), { decimals: 1 })).toMatchObject({ value: "14.2", unit: "°C" });
    expect(measure(undefined, st("sensor.t", "unavailable"))).toMatchObject({ value: "–" });
  });
});

describe("text and colour overrides", () => {
  it("blank → default, space → hidden", () => {
    expect(text(undefined, "Thermostat")).toBe("Thermostat");
    expect(text("", "Thermostat")).toBe("Thermostat");
    expect(text(" ", "Thermostat")).toBe("");
    expect(text("Heating", "Thermostat")).toBe("Heating");
  });
  it("maps ui_color names to theme variables", () => {
    expect(cssColour("red", "x")).toBe("var(--red-color)");
    expect(cssColour("#123456", "x")).toBe("#123456");
    expect(cssColour(undefined, "x")).toBe("x");
  });
  it("formats relative time", () => {
    const now = Date.parse("2026-10-05T12:00:00Z");
    expect(relativeTime("2026-10-05T11:56:00Z", now)).toBe("4 min ago");
    expect(relativeTime("2026-10-02T12:00:00Z", now)).toBe("3 d ago");
  });
});

describe("thermostat stepping", () => {
  it("rounds to the step and clamps to the range", () => {
    expect(stepTarget(21.5, 1, 0.5, 7, 30)).toBe(22);
    expect(stepTarget(21.3, 1, 0.5, 7, 30)).toBe(22);
    expect(stepTarget(29.8, 1, 0.5, 7, 30)).toBe(30);
    expect(stepTarget(7, -1, 0.5, 7, 30)).toBe(7);
    expect(stepTarget(20, 1, 0.1, 7, 30)).toBe(20.1);
  });
  it("adds up repeated taps from the pending value", () => {
    let v = 20;
    for (let i = 0; i < 3; i++) v = stepTarget(v, 1, 0.5, 7, 30);
    expect(v).toBe(21.5);
  });
});

describe("card logic", () => {
  it("computes graph stats ignoring gaps", () => {
    const v = [1, null, 5, 3];
    expect(computeStat(v, "min")).toBe(1);
    expect(computeStat(v, "max")).toBe(5);
    expect(computeStat(v, "avg")).toBe(3);
    expect(computeStat(v, "delta")).toBe(2);
    expect(computeStat([null], "max")).toBeNaN();
  });
  it("recognises charging states", () => {
    expect(isCharging(st("binary_sensor.c", "on"))).toBe(true);
    expect(isCharging(st("sensor.c", "Charging"))).toBe(true);
    expect(isCharging(st("sensor.c", "not_charging"))).toBe(false);
    expect(isCharging(st("sensor.c", "unavailable"))).toBe(false);
  });
  it("turns range into a percentage of a full tank", () => {
    expect(levelFromRange(248, 400)).toBe(62);
    expect(levelFromRange(450, 400)).toBe(100);
    expect(levelFromRange(248, undefined)).toBeNaN();
  });
  it("reads lock state from locks, binary sensors and BMW text sensors", () => {
    expect(lockState(st("sensor.wba1s92020vd56534_doors_lock", "LOCKED"))).toBe("locked");
    expect(lockState(st("sensor.x_doors_lock", "secured"))).toBe("locked");
    expect(lockState(st("sensor.x_doors_lock", "SELECTIVE_LOCKED"))).toBe("partial");
    expect(lockState(st("sensor.x_doors_lock", "UNLOCKED"))).toBe("unlocked");
    expect(lockState(st("lock.car", "locked"))).toBe("locked");
    expect(lockState(st("binary_sensor.car_lock", "on"))).toBe("unlocked");
  });
  it("reads doors and windows from binary or text sensors", () => {
    expect(isOpen(st("binary_sensor.lids", "on"))).toBe(true);
    expect(isOpen(st("sensor.windows", "CLOSED"))).toBe(false);
    expect(isOpen(st("sensor.windows", "OPEN"))).toBe(true);
  });
  it("reads WAN status", () => {
    expect(wanOnline(st("binary_sensor.wan", "on"))).toBe(true);
    expect(wanOnline(st("sensor.wan", "Connected"))).toBe(true);
    expect(wanOnline(st("binary_sensor.wan", "off"))).toBe(false);
    expect(wanOnline(undefined)).toBeUndefined();
  });
  it("discovers Portainer containers under an endpoint", () => {
    const hass = {
      devices: { ep: { id: "ep", name: "NAS" }, c1: { id: "c1", name: "plex", via_device_id: "ep" }, c2: { id: "c2", name: "radarr", via_device_id: "ep" }, other: { id: "other", name: "Lamp" } },
      entities: {
        "switch.plex": { entity_id: "switch.plex", device_id: "c1" },
        "button.plex_restart_container": { entity_id: "button.plex_restart_container", device_id: "c1", translation_key: "restart_container" },
        "sensor.plex_cpu_usage": { entity_id: "sensor.plex_cpu_usage", device_id: "c1" },
        "sensor.plex_memory_usage": { entity_id: "sensor.plex_memory_usage", device_id: "c1" },
        "binary_sensor.radarr_status": { entity_id: "binary_sensor.radarr_status", device_id: "c2" },
        "light.lamp": { entity_id: "light.lamp", device_id: "other" },
      },
    };
    const found = discover(hass, "ep");
    expect(found.map((c) => c.name)).toEqual(["plex", "radarr"]);
    expect(found[0]).toMatchObject({ power: "switch.plex", restart: "button.plex_restart_container", cpu: "sensor.plex_cpu_usage", memory: "sensor.plex_memory_usage" });
    expect(found[1]).toMatchObject({ status: "binary_sensor.radarr_status" });
  });
  it("doesn't mistake a container's own name for a sensor type", () => {
    const hass = {
      devices: { ep: { id: "ep", name: "NAS" }, k: { id: "k", name: "uptime-kuma", via_device_id: "ep" } },
      entities: {
        "switch.uptime_kuma_container": { entity_id: "switch.uptime_kuma_container", device_id: "k" },
        "sensor.uptime_kuma_cpu_usage": { entity_id: "sensor.uptime_kuma_cpu_usage", device_id: "k" },
        "sensor.uptime_kuma_started": { entity_id: "sensor.uptime_kuma_started", device_id: "k" },
      },
    };
    expect(discover(hass, "ep")[0]).toMatchObject({ cpu: "sensor.uptime_kuma_cpu_usage", started: "sensor.uptime_kuma_started" });
  });
  it("colours badges automatically", () => {
    expect(autoColour(st("lock.front", "unlocked"))).toBe("var(--tm-bad)");
    expect(autoColour(st("binary_sensor.door", "off"))).toBe("var(--tm-ok)");
    expect(autoColour(undefined)).toBe("var(--tm-idle)");
    expect(autoColour(st("binary_sensor.wan", "on", { device_class: "connectivity" }))).toBe("var(--tm-ok)");
    expect(autoColour(st("binary_sensor.wan", "off", { device_class: "connectivity" }))).toBe("var(--tm-bad)");
  });
});

describe("energy flows", () => {
  it("follows HA's energy convention with an invert switch", () => {
    expect(flow(1200)).toBe("in");      // grid importing / battery discharging
    expect(flow(-800)).toBe("out");     // grid exporting / battery charging
    expect(flow(-800, true)).toBe("in");
    expect(flow(4)).toBe("idle");
    expect(flow(NaN)).toBe("idle");
  });
});

describe("charger state", () => {
  it("recognises charging, plugged in and idle", () => {
    expect(chargerState(st("sensor.indra", "charging"))).toBe("charging");
    expect(chargerState(st("switch.indra", "on"))).toBe("charging");
    expect(chargerState(st("sensor.indra", "plugged_in"))).toBe("plugged");
    expect(chargerState(st("sensor.indra", "unplugged"))).toBe("idle");
    expect(chargerState(st("sensor.indra", "idle"))).toBe("idle");
    expect(chargerState(st("sensor.indra", "delivering"), "active, delivering")).toBe("charging");
    expect(chargerState(st("sensor.indra", "unavailable"))).toBe("unavailable");
    const pw = (v: string, u = "W") => ({ ...st("sensor.indra_power", v), attributes: { unit_of_measurement: u } });
    expect(deriveChargerState(undefined, pw("7.2", "kW"))).toBe("charging");
    expect(deriveChargerState(undefined, pw("9"))).toBe("idle");
    expect(deriveChargerState(undefined, pw("10"))).toBe("charging");
    expect(deriveChargerState(undefined, pw("40"), "", 50)).toBe("idle");
    expect(deriveChargerState(st("sensor.indra", "charging"), pw("3"))).toBe("plugged");
    expect(deriveChargerState(st("sensor.indra", "plugged_in"), pw("0"))).toBe("plugged");
    expect(deriveChargerState(st("sensor.indra", "idle"), pw("unavailable"))).toBe("idle");
    expect(deriveChargerState(undefined, pw("unavailable"))).toBe("unavailable");
  });
});

describe("light capabilities", () => {
  it("knows on/off-only lights can't dim", () => {
    expect(caps(st("light.a", "on", { supported_color_modes: ["onoff"] }))).toMatchObject({ dimmable: false, temperature: false, colour: false });
    expect(caps(st("light.b", "on", { supported_color_modes: ["color_temp", "hs"] }))).toMatchObject({ dimmable: true, temperature: true, colour: true });
  });
  it("offers at most four white presets inside the range", () => {
    expect(defaultTemps(2700, 6500).map((p) => p.kelvin)).toEqual([2700, 3000, 5000, 6500]);
    expect(defaultTemps(2200, 4000).map((p) => p.kelvin)).toEqual([2200, 2700, 3000, 4000]);
  });
  it("turns kelvin into warm and cool colours", () => {
    const blue = (k: number) => Number(kelvinToCss(k).match(/(\d+)\)$/)![1]);
    expect(kelvinToCss(2200)).toMatch(/^rgb\(255, /);
    expect(blue(6500)).toBeGreaterThan(240);
    expect(blue(2200)).toBeLessThan(blue(4000));
  });
});

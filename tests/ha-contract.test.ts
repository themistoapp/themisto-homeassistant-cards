import { describe, expect, it } from "vitest";
import "../src/index";

const TAGS = ["thermostat", "sensor", "energy", "charger", "media", "light", "light-list", "vehicle", "unifi", "portainer"].map((t) => `themisto-${t}-card`);

// Properties Home Assistant assigns to every card element it places in a view or preview.
describe("Home Assistant card contract", () => {
  it.each(TAGS)("%s accepts HA's layout/preview/editMode assignments", (tag) => {
    const el = document.createElement(tag) as any;
    expect(() => { el.layout = "grid"; el.preview = true; el.editMode = true; }).not.toThrow();
    expect(typeof el.setConfig).toBe("function");
    expect(typeof el.getGridOptions).toBe("function");
  });
});

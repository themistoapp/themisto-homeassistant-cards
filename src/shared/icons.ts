import { html, svg, type SVGTemplateResult, type TemplateResult } from "lit";

const P: Record<string, SVGTemplateResult> = {
  bulb: svg`<path d="M9 18h6M10 22h4M8.5 14.5A6 6 0 1 1 15.5 14.5c-.9.7-1.5 1.6-1.5 2.5h-4c0-.9-.6-1.8-1.5-2.5Z"/>`,
  flame: svg`<path d="M12 22c4 0 7-2.7 7-6.6 0-3.3-2.2-5.6-4-7.4-.4 2-1.4 3.2-2.6 3.8.3-3.4-1.2-6.6-4.4-8.8.2 3.5-1.5 5.7-3 7.6C3.9 12.1 5 14 5 15.4 5 19.3 8 22 12 22Z"/>`,
  snow: svg`<path d="M12 2v20M4.9 7l14.2 10M19.1 7 4.9 17M9 4l3 2 3-2M9 20l3-2 3 2"/>`,
  power: svg`<path d="M12 2v10M18.4 6.6a9 9 0 1 1-12.8 0"/>`,
  minus: svg`<path d="M5 12h14"/>`,
  plus: svg`<path d="M12 5v14M5 12h14"/>`,
  solar: svg`<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>`,
  home: svg`<path d="m3 11 9-8 9 8M5 10v10h14V10M9 20v-6h6v6"/>`,
  therm: svg`<path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0ZM12 8v8"/>`,
  battery: svg`<rect x="3" y="6" width="17" height="12" rx="2"/><path d="M20 10h2v4h-2M7 10v4M10 10v4M13 10v4"/>`,
  grid: svg`<path d="M8 22 12 2l4 20M6 8h12M5 13h14M3 22h18"/>`,
  gauge: svg`<path d="M12 14l4-4M3.5 18a9 9 0 1 1 17 0"/>`,
  play: svg`<path d="m7 4 13 8-13 8V4Z" fill="currentColor"/>`,
  pause: svg`<path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor"/>`,
  prev: svg`<path d="M19 20 9 12l10-8v16ZM5 19V5"/>`,
  next: svg`<path d="m5 4 10 8-10 8V4ZM19 5v14"/>`,
  shuffle: svg`<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>`,
  repeat: svg`<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/>`,
  mute: svg`<path d="M11 5 6 9H3v6h3l5 4V5ZM22 9l-6 6M16 9l6 6"/>`,
  star: svg`<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>`,
  speaker: svg`<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>`,
  car: svg`<path d="M5 17H3v-4l2-5a2 2 0 0 1 1.9-1.3h10.2A2 2 0 0 1 19 8l2 5v4h-2M9 17h6"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>`,
  van: svg`<path d="M5 17H2V7a2 2 0 0 1 2-2h11l4 4 3 2v6h-3M9 17h6M15 5v5h7"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>`,
  fuel: svg`<path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M3 21h13M7 8h5M15 10h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V9l-3-3"/>`,
  plug: svg`<path d="M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0V7ZM12 17v5"/>`,
  lock: svg`<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>`,
  unlock: svg`<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>`,
  door: svg`<path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M3 21h18M14 12h.01"/>`,
  window: svg`<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M4 12h16M12 3v18"/>`,
  pin: svg`<path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12Z"/><circle cx="12" cy="10" r="2.5"/>`,
  clock: svg`<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`,
  fan: svg`<path d="M12 12c-1-4 0-8 3-8s3 4-3 8ZM12 12c4-1 8 0 8 3s-4 3-8-3ZM12 12c1 4 0 8-3 8s-3-4 3-8ZM12 12c-4 1-8 0-8-3s4-3 8 3Z"/>`,
  wifi: svg`<path d="M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20h.01"/>`,
  router: svg`<rect x="2" y="13" width="20" height="7" rx="2"/><path d="M6 16.5h.01M10 16.5h.01M8 13l-2-6M16 13l2-6"/>`,
  cable: svg`<path d="M4 9h5v6H4zM15 9h5v6h-5zM9 12h6"/>`,
  users: svg`<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>`,
  guest: svg`<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>`,
  box: svg`<path d="m12 2 9 5v10l-9 5-9-5V7l9-5Z"/><path d="m3 7 9 5 9-5M12 12v10"/>`,
  restart: svg`<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>`,
  stop: svg`<rect x="6" y="6" width="12" height="12" rx="2"/>`,
  chevron: svg`<path d="m6 9 6 6 6-6"/>`,
  check: svg`<path d="m5 12 5 5L20 7"/>`,
  x: svg`<path d="M6 6l12 12M18 6 6 18"/>`,
  shield: svg`<path d="M12 22s8-3 8-10V5l-8-3-8 3v7c0 7 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>`,
  leaf: svg`<path d="M5 21c0-9 5-15 15-16-1 10-7 15-15 16ZM5 21l8-8"/>`,
  bolt: svg`<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>`,
  heart: svg`<path d="M12 21s-7-4.4-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.6-9.5 9-9.5 9Z"/>`,
  moon: svg`<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>`,
  sun: svg`<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>`,
  entity: svg`<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>`,
  alert: svg`<path d="M12 3 2 21h20L12 3ZM12 10v5M12 18h.01"/>`,
};

export const ICON_NAMES = Object.keys(P);

/** Built-in Themisto line icon, or any `mdi:` icon through HA's own <ha-icon>. */
export function icon(name: string | undefined, fallback = "entity"): TemplateResult {
  const n = name || fallback;
  if (n.includes(":")) return html`<ha-icon .icon=${n}></ha-icon>`;
  return html`<svg viewBox="0 0 24 24" aria-hidden="true">${P[n] || P[fallback] || P.entity}</svg>`;
}

/** Sensible default icon per entity domain / device class. */
export function iconForEntity(entityId?: string, deviceClass?: string): string {
  const d = (entityId || "").split(".")[0];
  if (deviceClass === "power" || deviceClass === "energy") return "bolt";
  if (deviceClass === "temperature") return "therm";
  if (deviceClass === "battery") return "battery";
  if (deviceClass === "door" || deviceClass === "opening") return "door";
  if (deviceClass === "window") return "window";
  return ({ light: "bulb", climate: "therm", media_player: "speaker", lock: "lock", device_tracker: "pin", person: "guest", switch: "power", fan: "fan" } as Record<string, string>)[d] || "entity";
}

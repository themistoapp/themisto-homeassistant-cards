// Minimal slices of Home Assistant's frontend types that the cards rely on.

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed: string;
  last_updated: string;
}

export interface HassEntityRegistryEntry {
  entity_id: string;
  device_id?: string | null;
  platform?: string;
  translation_key?: string | null;
  name?: string | null;
  hidden?: boolean;
}

export interface HassDevice {
  id: string;
  name?: string | null;
  name_by_user?: string | null;
  via_device_id?: string | null;
  model?: string | null;
}

export interface HassConnection {
  subscribeMessage<T>(callback: (msg: T) => void, msg: Record<string, unknown>): Promise<() => void>;
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  entities?: Record<string, HassEntityRegistryEntry>;
  devices?: Record<string, HassDevice>;
  themes?: { darkMode?: boolean };
  locale?: { language?: string };
  language?: string;
  connection: HassConnection;
  callWS?<T>(msg: Record<string, unknown>): Promise<T>;
  callService(domain: string, service: string, data?: Record<string, unknown>, target?: Record<string, unknown>): Promise<unknown>;
  formatEntityState?(stateObj: HassEntity, state?: string): string;
  formatEntityAttributeValue?(stateObj: HassEntity, attribute: string, value?: unknown): string;
}

export type ActionConfig = { action: string; [key: string]: unknown };

export type Layout = "auto" | "compact" | "standard" | "large";

export interface BaseConfig {
  type: string;
  name?: string;
  kicker?: string;
  icon?: string;
  accent?: string;
  layout?: Layout;
  glass?: boolean;
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
}

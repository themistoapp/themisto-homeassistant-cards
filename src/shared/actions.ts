import type { ActionConfig } from "../types";
import { fireEvent } from "./util";

export type Gesture = "tap" | "hold" | "double_tap";

export interface ActionSet { entity?: string; tap_action?: ActionConfig; hold_action?: ActionConfig; double_tap_action?: ActionConfig }

const hasAction = (a?: ActionConfig) => !!a && a.action !== "none";

/**
 * Hands the action to Home Assistant's own "hass-action" handler, so more-info, toggle,
 * navigate, url, perform-action and confirmation all behave exactly as in core cards.
 */
export function runAction(node: HTMLElement, config: ActionSet, gesture: Gesture) {
  fireEvent(node, "hass-action", { config, action: gesture });
}

/**
 * Pointer gestures for one element: tap, hold (500 ms) and double tap (250 ms window, only
 * waited for when a double-tap action is configured so plain taps stay instant).
 * Returns handlers to spread onto a Lit template.
 */
export function gestures(getConfig: () => ActionSet, node: () => HTMLElement) {
  let holdTimer: number | undefined;
  let held = false;
  let tapTimer: number | undefined;
  let startX = 0, startY = 0;
  const cancelHold = () => { clearTimeout(holdTimer); holdTimer = undefined; };
  return {
    down: (e: PointerEvent) => {
      if (e.button !== 0) return;
      held = false; startX = e.clientX; startY = e.clientY;
      if (!hasAction(getConfig().hold_action)) return;
      holdTimer = window.setTimeout(() => { held = true; runAction(node(), getConfig(), "hold"); }, 500);
    },
    move: (e: PointerEvent) => { if (Math.hypot(e.clientX - startX, e.clientY - startY) > 10) cancelHold(); },
    up: () => cancelHold(),
    cancel: () => cancelHold(),
    click: (e: Event) => {
      if (held) { held = false; e.preventDefault(); return; }
      const cfg = getConfig();
      if (hasAction(cfg.double_tap_action)) {
        if (tapTimer) { clearTimeout(tapTimer); tapTimer = undefined; runAction(node(), cfg, "double_tap"); return; }
        tapTimer = window.setTimeout(() => { tapTimer = undefined; runAction(node(), cfg, "tap"); }, 250);
        return;
      }
      runAction(node(), cfg, "tap");
    },
    key: (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); runAction(node(), getConfig(), "tap"); } },
    context: (e: Event) => { if (hasAction(getConfig().hold_action)) e.preventDefault(); },
  };
}

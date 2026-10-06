import { LitElement, css, html, nothing } from "lit";
import { icon } from "../shared/icons";
import { clamp } from "../shared/util";

/**
 * Optimistic slider.
 * - While dragging, it shows its own value and ignores incoming `value` updates.
 * - It fires `value-changed` throttled (250 ms) during the drag and once on release.
 * - For 1.5 s after release it keeps showing the released value, so a stale state echo from HA
 *   can't snap it back before the real update arrives.
 */
export class TmSlider extends LitElement {
  static override properties = {
    value: { type: Number }, min: { type: Number }, max: { type: Number }, step: { type: Number },
    label: {}, icon: {}, disabled: { type: Boolean, reflect: true },
    _local: { state: true },
  };
  declare value: number; declare min: number; declare max: number; declare step: number;
  declare label: string; declare icon: string; declare disabled: boolean;
  declare _local: number | undefined;
  private _dragging = false;
  private _holdUntil = 0;
  private _lastSent = 0;
  private _holdTimer?: number;

  constructor() {
    super();
    this.value = 0; this.min = 0; this.max = 100; this.step = 1; this.label = ""; this.icon = ""; this.disabled = false;
  }

  /* A plain 6px bar, like the Now Playing progress bar: no grab handle. The whole 36px row is the
     touch target, and the icon sits outside the bar. --slider-color sets the fill. */
  static override styles = css`
    :host { display: block; height: 36px; flex: none; touch-action: none; user-select: none; -webkit-user-select: none; }
    .sl { position: relative; height: 100%; display: flex; align-items: center; gap: 10px; cursor: pointer; outline: none; border-radius: var(--tm-radius-icon-sm); }
    .sl:focus-visible { outline: 2px solid var(--tm-accent); outline-offset: 2px; }
    :host([disabled]) .sl { cursor: default; opacity: .45; }
    .tr { position: relative; flex: 1; min-width: 0; height: 6px; border-radius: 99px; background: var(--tm-line); overflow: hidden; }
    .f { position: absolute; inset: 0 auto 0 0; width: calc(var(--p) * 1%); background: var(--slider-color, var(--tm-text-2)); border-radius: inherit; transition: width .15s ease; }
    .drag .f { transition: none; }
    .l { flex: none; display: grid; place-items: center; color: var(--tm-muted); pointer-events: none; }
    svg, ha-icon { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; --mdc-icon-size: 16px; }
    @media (prefers-reduced-motion: reduce) { .f { transition: none; } }
  `;


  get shown() {
    return this._local !== undefined && (this._dragging || Date.now() < this._holdUntil) ? this._local : this.value;
  }

  /** Maps a pointer x onto the bar (not the icon beside it). */
  private fromX(x: number, rect: DOMRect) {
    const frac = clamp((x - rect.left) / Math.max(rect.width, 1), 0, 1);
    const raw = this.min + frac * (this.max - this.min);
    return clamp(Math.round(raw / this.step) * this.step, this.min, this.max);
  }

  private emit(value: number, final: boolean) {
    this.dispatchEvent(new CustomEvent("value-changed", { detail: { value, final }, bubbles: true, composed: true }));
  }

  private release(v: number) {
    this._dragging = false;
    this._local = v;
    this._holdUntil = Date.now() + 1500;
    clearTimeout(this._holdTimer);
    this._holdTimer = window.setTimeout(() => this.requestUpdate(), 1550);
    this.emit(v, true);
  }

  private down(e: PointerEvent) {
    if (this.disabled || e.button !== 0) return;
    const el = e.currentTarget as HTMLElement;
    const rect = (el.querySelector(".tr") as HTMLElement).getBoundingClientRect();
    el.setPointerCapture(e.pointerId);
    this._dragging = true;
    el.classList.add("drag");
    const move = (ev: PointerEvent) => {
      this._local = this.fromX(ev.clientX, rect);
      if (Date.now() - this._lastSent > 250) { this._lastSent = Date.now(); this.emit(this._local, false); }
    };
    const up = (ev: PointerEvent) => {
      el.classList.remove("drag");
      el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up);
      this.release(this.fromX(ev.clientX, rect));
    };
    el.addEventListener("pointermove", move); el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    move(e);
  }

  private key(e: KeyboardEvent) {
    if (this.disabled) return;
    const big = (this.max - this.min) / 20;
    const d = { ArrowRight: big, ArrowUp: big, ArrowLeft: -big, ArrowDown: -big, Home: -Infinity, End: Infinity }[e.key];
    if (d === undefined) return;
    e.preventDefault();
    this.release(clamp(Math.round((this.shown + d) / this.step) * this.step, this.min, this.max));
  }

  override render() {
    const v = this.shown;
    const pct = ((v - this.min) / (this.max - this.min || 1)) * 100;
    return html`<div class="sl" role="slider" tabindex=${this.disabled ? -1 : 0} aria-label=${this.label} aria-valuemin=${this.min} aria-valuemax=${this.max} aria-valuenow=${v}
      aria-disabled=${this.disabled} style="--p:${pct}" @pointerdown=${this.down} @keydown=${this.key}>
      ${this.icon ? html`<div class="l">${icon(this.icon)}</div>` : nothing}
      <div class="tr"><div class="f"></div></div>
    </div>`;
  }
}

if (!customElements.get("tm-slider")) customElements.define("tm-slider", TmSlider);

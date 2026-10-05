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

  static override styles = css`
    :host { --h: 30px; display: block; height: var(--h); flex: none; touch-action: none; user-select: none; -webkit-user-select: none; }
    .sl { position: relative; height: 100%; border-radius: 99px; background: var(--tm-read-2); border: 1px solid var(--tm-line); cursor: pointer; overflow: hidden; outline: none; }
    .sl:focus-visible { outline: 2px solid var(--tm-accent); outline-offset: 2px; }
    :host([disabled]) .sl { cursor: default; opacity: .45; }
    /* The fill is never narrower than a circle the height of the track, so at the minimum the icon
       sits centred in it; the rest of the track maps to the value. */
    .f { position: absolute; inset: 0 auto 0 0; width: calc(var(--h) + (100% - var(--h)) * var(--p) / 100); background: color-mix(in srgb, var(--slider-color, var(--tm-accent)) 82%, transparent); border-radius: 99px; transition: width .15s ease; }
    .drag .f { transition: none; }
    /* Handle line fades in once the fill has moved clear of the icon. */
    .f::after { content: ""; position: absolute; right: 8px; top: 50%; width: 3px; height: 12px; margin-top: -6px; border-radius: 2px; background: var(--slider-ink, rgba(255,255,255,.9)); opacity: clamp(0, (var(--p) - 6) / 6, 1); }
    .l { position: absolute; inset: 0 auto 0 0; width: var(--h); display: grid; place-items: center; color: var(--slider-ink, var(--tm-text)); pointer-events: none; }
    svg, ha-icon { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; --mdc-icon-size: 15px; }
    @media (prefers-reduced-motion: reduce) { .f { transition: none; } }
  `;

  get shown() {
    return this._local !== undefined && (this._dragging || Date.now() < this._holdUntil) ? this._local : this.value;
  }

  private fromX(x: number, rect: DOMRect) {
    // Inverse of the fill width: the first track-height of the bar is the minimum.
    const h = rect.height, frac = clamp((x - rect.left - h / 2) / Math.max(rect.width - h, 1), 0, 1);
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
    const rect = el.getBoundingClientRect();
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
      <div class="f"></div>
      ${this.icon ? html`<div class="l">${icon(this.icon)}</div>` : nothing}
    </div>`;
  }
}

if (!customElements.get("tm-slider")) customElements.define("tm-slider", TmSlider);

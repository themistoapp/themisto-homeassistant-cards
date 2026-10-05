import { LitElement, css, html } from "lit";

/**
 * Fits a box of a given aspect ratio inside the space it's given, in pixels.
 * Images with overlays (charger lights, battery glow) go inside, positioned in % of the box, so the
 * overlays stay pinned to the picture. Measuring in JS avoids percentage-height + aspect-ratio
 * sizing, which Safari resolves differently from Chrome (the image spilled over the card's text).
 */
export class TmFit extends LitElement {
  static override properties = { ratio: { type: Number }, _w: { state: true }, _h: { state: true } };
  declare ratio: number;
  declare _w: number;
  declare _h: number;
  private _ro?: ResizeObserver;

  constructor() { super(); this.ratio = 1; this._w = 0; this._h = 0; }

  static override styles = css`
    :host { display: grid; place-items: center; width: 100%; height: 100%; min-width: 0; min-height: 0; overflow: hidden; }
    .box { position: relative; }
  `;

  override connectedCallback() {
    super.connectedCallback();
    this._ro = new ResizeObserver(() => this.fit());
    this._ro.observe(this);
  }
  override disconnectedCallback() { super.disconnectedCallback(); this._ro?.disconnect(); }
  override updated(changed: Map<string, unknown>) { if (changed.has("ratio")) this.fit(); }

  private fit() {
    const W = this.clientWidth, H = this.clientHeight, r = this.ratio > 0 ? this.ratio : 1;
    if (!W || !H) return;
    const w = Math.min(W, H * r), h = w / r;
    if (Math.abs(w - this._w) > 0.5 || Math.abs(h - this._h) > 0.5) { this._w = w; this._h = h; }
  }

  override render() {
    return html`<div class="box" style="width:${this._w}px;height:${this._h}px"><slot></slot></div>`;
  }
}

if (!customElements.get("tm-fit")) customElements.define("tm-fit", TmFit);

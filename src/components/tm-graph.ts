import { LitElement, css, html, nothing, svg } from "lit";
import { clamp } from "../shared/util";

/**
 * Time-scaled graph (line / area / bar). Values are pre-bucketed; null = gap.
 * Hover (mouse) or tap (touch, sticks until tapped again) fires `graph-hover` with the bucket
 * index, or null, so the card can show the readout in its header without changing height.
 */
export class TmGraph extends LitElement {
  static override properties = {
    values: { attribute: false }, type: {}, zero: { type: Boolean }, _hover: { state: true },
  };
  declare values: (number | null)[];
  declare type: "line" | "area" | "bar";
  declare zero: boolean;
  declare _hover: number | null;

  constructor() { super(); this.values = []; this.type = "area"; this.zero = false; this._hover = null; }

  static override styles = css`
    :host { display: block; position: relative; flex: 1; min-height: 28px; touch-action: pan-y; --c: var(--graph-color, var(--tm-accent)); }
    svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
    .ln { fill: none; stroke: var(--c); stroke-width: 2; vector-effect: non-scaling-stroke; stroke-linejoin: round; stroke-linecap: round; }
    .ar { fill: color-mix(in srgb, var(--c) 16%, transparent); stroke: none; }
    .gl { stroke: var(--tm-line); stroke-width: 1; vector-effect: non-scaling-stroke; stroke-dasharray: 3 4; }
    .bar { fill: color-mix(in srgb, var(--c) 45%, transparent); } .bar.hi { fill: var(--c); }
    .dot { position: absolute; width: 8px; height: 8px; margin: -4px 0 0 -4px; border-radius: 50%; background: var(--c); box-shadow: 0 0 0 3px color-mix(in srgb, var(--c) 22%, transparent); pointer-events: none; }
    .hl { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--tm-line-strong); pointer-events: none; }
    .empty { position: absolute; inset: 0; display: grid; place-items: center; font: var(--tm-fs-label) var(--tm-mono, monospace); color: var(--tm-muted); letter-spacing: .08em; text-transform: uppercase; }
  `;

  private setHover(i: number | null) {
    if (i === this._hover) return;
    this._hover = i;
    this.dispatchEvent(new CustomEvent("graph-hover", { detail: { index: i }, bubbles: true, composed: true }));
  }

  private idx(e: PointerEvent) {
    const r = this.getBoundingClientRect();
    return clamp(Math.floor(((e.clientX - r.left) / r.width) * this.values.length), 0, this.values.length - 1);
  }

  private onMove = (e: PointerEvent) => { if (e.pointerType === "mouse") this.setHover(this.idx(e)); };
  private onLeave = (e: PointerEvent) => { if (e.pointerType === "mouse") this.setHover(null); };
  private onDown = (e: PointerEvent) => { if (e.pointerType !== "mouse") { const i = this.idx(e); this.setHover(this._hover === i ? null : i); } };

  override render() {
    const vals = this.values || [];
    const n = vals.length;
    const real = vals.filter((v): v is number => v !== null);
    if (n < 2 || !real.length) return html`<div class="empty">No history yet</div>`;
    const min = this.type === "bar" || this.zero ? Math.min(0, ...real) : Math.min(...real);
    const max = Math.max(...real);
    const span = Math.max(max - min, Math.abs(max) * 0.05, 1e-6);
    const y = (v: number) => 100 - 6 - ((v - min) / span) * 88;
    const x = (i: number) => (this.type === "bar" ? ((i + 0.5) / n) * 100 : (i / (n - 1)) * 100);

    let marks;
    if (this.type === "bar") {
      const w = 100 / n;
      const hi = this._hover ?? n - 1;
      marks = vals.map((v, i) => (v === null ? nothing : svg`<rect class="bar ${i === hi ? "hi" : ""}" x=${i * w + w * 0.15} width=${w * 0.7} y=${y(v)} height=${Math.max(0, y(min) - y(v))}></rect>`));
    } else {
      // Split into runs so unavailable stretches show as gaps.
      const runs: [number, number][][] = [];
      let cur: [number, number][] = [];
      vals.forEach((v, i) => { if (v === null) { if (cur.length) runs.push(cur); cur = []; } else cur.push([x(i), y(v)]); });
      if (cur.length) runs.push(cur);
      marks = runs.map((r) => {
        const pts = r.map(([a, b]) => `${a.toFixed(2)},${b.toFixed(2)}`).join(" ");
        return svg`${this.type === "area" ? svg`<polygon class="ar" points="${r[0][0]},100 ${pts} ${r[r.length - 1][0]},100"></polygon>` : nothing}<polyline class="ln" points=${pts}></polyline>`;
      });
    }
    let di = this._hover ?? n - 1;
    if (this._hover === null) while (di > 0 && vals[di] === null) di--;
    const dv = vals[di];
    return html`<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" @pointermove=${this.onMove} @pointerleave=${this.onLeave} @pointerdown=${this.onDown}>
        <line class="gl" x1="0" x2="100" y1="36" y2="36"></line><line class="gl" x1="0" x2="100" y1="70" y2="70"></line>${marks}
        <rect x="0" y="0" width="100" height="100" fill="transparent"></rect>
      </svg>
      ${this._hover !== null ? html`<i class="hl" style="left:${x(this._hover)}%"></i>` : nothing}
      ${this.type !== "bar" && dv !== null && dv !== undefined ? html`<i class="dot" style="left:${x(di)}%;top:${y(dv)}%"></i>` : nothing}`;
  }
}

if (!customElements.get("tm-graph")) customElements.define("tm-graph", TmGraph);

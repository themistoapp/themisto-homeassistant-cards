import { css, html, nothing } from "lit";
import { ThemistoCard } from "../shared/base-card";
import { choose, editorFor, entity, iconField, list, textField, grid, type EditorSpec } from "../shared/editor";
import { stateText } from "../shared/format";
import { icon } from "../shared/icons";
import type { GridOptions } from "../shared/grid";
import { cssColour, friendlyName } from "../shared/util";
import type { BaseConfig } from "../types";
import { autoColour } from "./status-badge";

interface HeadingPill { entity: string; name?: string; icon?: string; color?: string }
export interface HeadingConfig extends BaseConfig {
  /** "page" for the top of a dashboard, "section" above a group of cards. */
  size?: "page" | "section";
  pills?: HeadingPill[];
}

/**
 * A dashboard heading in the brand's page and section title sizes, with an eyebrow and up to four
 * live pills. It sits straight on the dashboard: no card surface.
 */
export class ThemistoHeadingCard extends ThemistoCard<HeadingConfig> {
  static override styles = [
    ...ThemistoCard.styles,
    css`
      :host { height: auto; }
      .hg { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 10px 16px; padding: 4px 4px 2px; color: var(--tm-text); font: var(--tm-fs-body)/1.45 var(--tm-body); }
      .hg > .titles { display: grid; gap: 4px; min-width: 0; flex: 1 1 200px; }
      h1, h2 { margin: 0; font-family: var(--tm-display); font-weight: 900; text-transform: uppercase; overflow-wrap: break-word; }
      h1 { font-size: clamp(var(--tm-fs-section), 7cqw, 72px); line-height: 1; padding-block: 0.12em; } /* brand-exception: .t-page */
      h2 { font-size: var(--tm-fs-section); line-height: 1.1; }
      .pills { display: flex; flex-wrap: wrap; gap: 6px; }
      .pills .chip { cursor: pointer; }
      .wrap { container-type: inline-size; }
    `,
  ];

  protected watchedEntities() { return (this._config?.pills || []).map((p) => p.entity); }
  override getGridOptions(): GridOptions { return { columns: "full", rows: "auto" }; }
  override getCardSize() { return this._config?.size === "section" ? 1 : 2; }

  static getConfigElement() { return editorFor(ThemistoHeadingCard); }
  static getStubConfig() { return { name: "Home", kicker: "Good evening", size: "page" }; }
  static editor(): EditorSpec {
    return {
      schema: [
        grid(textField("name"), textField("kicker")),
        choose("size", [["page", "Page title"], ["section", "Section title"]]),
        list("pills", { entity: { ...entity("entity"), label: "Entity", required: true }, name: { ...textField("name"), label: "Text (blank for name and state)" }, icon: { ...iconField(), label: "Icon" } }, "name", "entity"),
      ],
      labels: { size: "Size", pills: "Pills (up to four)" },
      helpers: { pills: "Each pill shows its entity's name and state, coloured automatically, or your own text. Tap opens the entity." },
    };
  }

  override render() {
    const c = this._config!;
    const title = this.t(c.name, "Home"), kicker = this.t(c.kicker, "");
    const pills = (c.pills || []).slice(0, 4).map((p) => {
      const s = this.stateOf(p.entity);
      const col = p.color ? cssColour(p.color, "") : autoColour(s);
      return html`<button class="chip" style="--cc:${col}" @click=${() => this.elementAction(p.entity)}>${p.icon ? icon(p.icon) : html`<i></i>`}${p.name || [friendlyName(s, p.entity), stateText(this._hass, s)].filter(Boolean).join(" · ") || "–"}</button>`;
    });
    return html`<div class="wrap"><div class="hg">
      <div class="titles">${kicker ? html`<span class="kick">${kicker}</span>` : nothing}${title ? (c.size === "section" ? html`<h2>${title}</h2>` : html`<h1>${title}</h1>`) : nothing}</div>
      ${pills.length ? html`<div class="pills">${pills}</div>` : nothing}
    </div></div>`;
  }
}

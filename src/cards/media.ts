import { css, html, nothing } from "lit";
import "../components/tm-slider";
import { ThemistoCard } from "../shared/base-card";
import { actions, appearance, bool, choose, colour, editorFor, entity, list, section, textField, titleFields, grid, type EditorSpec } from "../shared/editor";
import { icon } from "../shared/icons";
import { cap, friendlyName, isUnavailable, num } from "../shared/util";
import type { BaseConfig, HassEntity, HomeAssistant } from "../types";

interface Favourite { name: string; media_content_id: string; media_content_type?: string; image?: string }
interface BrowseNode { media_content_id: string; media_content_type: string; thumbnail?: string | null; children?: BrowseNode[] }
export interface MediaConfig extends BaseConfig {
  entity: string;
  favourites_entity?: string;
  favourites_include?: string[];
  favourites?: Favourite[];
  show_art?: boolean; show_progress?: boolean; show_transport?: boolean; show_volume?: boolean;
  show_group?: boolean; show_favourites?: boolean; show_shuffle_repeat?: boolean; show_mute?: boolean; show_chip?: boolean;
}

// MediaPlayerEntityFeature bits
const F = { PAUSE: 1, VOLUME_SET: 4, VOLUME_MUTE: 8, PREV: 16, NEXT: 32, PLAY_MEDIA: 512, PLAY: 16384, SHUFFLE: 32768, REPEAT: 262144 };

const artFallback = (seed: string) => {
  let h = 0; for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `background:radial-gradient(circle at 28% 30%,hsl(${h} 80% 66%),transparent 55%),radial-gradient(circle at 80% 85%,hsl(${(h + 70) % 360} 75% 55%),transparent 50%),linear-gradient(135deg,hsl(${(h + 200) % 360} 55% 32%),hsl(${(h + 240) % 360} 60% 16%))`;
};

export class ThemistoMediaCard extends ThemistoCard<MediaConfig> {
  static override presets = { compact: { columns: 6, rows: 2 }, standard: { columns: 12, rows: 4 }, large: { columns: 6, rows: 6 } };
  private _timer?: number;
  /** Favourite id -> artwork, from the Sonos media browser (the favourites sensor only has names). */
  private _thumbs: Record<string, string> = {};
  private _thumbKey?: string;
  private _broken = new Set<string>();

  static override styles = [
    ...ThemistoCard.styles,
    css`
      .art { position: relative; border-radius: 14px; overflow: hidden; display: grid; place-items: center; color: rgba(255,255,255,.85); flex: none; background-size: cover; background-position: center; }
      .art > svg { width: 26px; height: 26px; }
      .wide { display: grid; grid-template-columns: clamp(72px, 24cqw, 132px) minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto; gap: 12px 16px; }
      .wide > .art { width: 100%; aspect-ratio: 1; align-self: center; }
      .wide > .favs { grid-column: 1 / -1; }
      .solo { display: grid; grid-template-rows: minmax(0, 1fr) auto; gap: 12px; }
      .body { display: flex; flex-direction: column; gap: 10px; min-width: 0; min-height: 0; justify-content: space-between; }
      .trk { display: grid; gap: 3px; min-width: 0; }
      .trk strong { font-size: 15px; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .trk span { font-size: 12px; color: var(--tm-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .prog { position: relative; height: 4px; border-radius: 99px; background: var(--tm-line); flex: none; }
      .prog i { position: absolute; inset: 0 auto 0 0; border-radius: inherit; background: var(--tm-text-2); }
      .tp { display: flex; align-items: center; gap: 6px; flex: none; }
      .tp .play { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: var(--tm-text); color: var(--tm-solid); }
      .tp .play svg { width: 18px; height: 18px; }
      .tp .ic { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%; color: var(--tm-text-2); }
      .tp .ic svg { width: 17px; height: 17px; }
      .tp .ic[aria-pressed="true"] { color: var(--c); background: color-mix(in srgb, var(--c) 14%, transparent); }
      .favs { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; flex: none; mask-image: linear-gradient(90deg, #000 88%, transparent); }
      .favs::-webkit-scrollbar { display: none; }
      .favs button { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 11px 0 8px; border-radius: 99px; border: 1px solid var(--tm-line); font: 600 12px var(--tm-body); white-space: nowrap; flex: none; background: var(--tm-read-2); }
      .favs button svg { width: 13px; height: 13px; color: var(--tm-muted); }
      .favs button img { width: 22px; height: 22px; border-radius: 6px; object-fit: cover; margin-left: -4px; }
      .tall > .art { height: 136px; width: 100%; padding: 12px; display: flex; flex-direction: column; justify-content: space-between; align-items: stretch; }
      .tall .scrim { position: absolute; inset: 0; background: linear-gradient(rgba(0,0,0,.45), transparent 55%); }
      .tall > .art .row { position: relative; color: #fff; align-items: flex-start; justify-content: space-between; }
      .tall > .art .kick { color: rgba(255,255,255,.75); } .tall > .art .ttl { color: #fff; }
      .tall > .art .chip { color: #fff; border-color: rgba(255,255,255,.28); background: rgba(0,0,0,.32); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
      .compact { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 12px; align-items: center; }
      .compact > .art { width: 96px; height: 96px; }
      .vol { display: flex; align-items: center; gap: 6px; min-width: 0; }
      .vol tm-slider { flex: 1; min-width: 0; --slider-color: var(--tm-text-2); }
      @container (max-width: 359px) { .wide { grid-template-columns: minmax(0, 1fr); } .wide > .art { display: none; } }
      @container (max-width: 250px) { .compact { grid-template-columns: minmax(0, 1fr) auto; } .compact > .art { display: none; } }
    `,
  ];

  protected override validate(c: MediaConfig) { if (!c.entity) throw new Error("Choose a media player"); }
  protected watchedEntities() { return [this._config?.entity, this.favEntity]; }

  private get favEntity() {
    const c = this._config;
    if (c?.favourites_entity) return c.favourites_entity;
    return this._hass?.states["sensor.sonos_favorites"] ? "sensor.sonos_favorites" : undefined;
  }

  static getConfigElement() { return editorFor(ThemistoMediaCard); }
  static getStubConfig(hass: HomeAssistant) {
    const sonos = Object.keys(hass.states).find((e) => e.startsWith("media_player.") && hass.entities?.[e]?.platform === "sonos");
    return { entity: sonos || Object.keys(hass.states).find((e) => e.startsWith("media_player.")) || "media_player.example" };
  }
  static editor(hass: HomeAssistant, c: Record<string, any>): EditorSpec {
    const src = c.favourites_entity || (hass.states["sensor.sonos_favorites"] ? "sensor.sonos_favorites" : undefined);
    const items: Record<string, string> = (src && hass.states[src]?.attributes.items) || {};
    const opts = Object.entries(items).map(([id, name]) => [id, name] as [string, string]);
    return {
      schema: [
        entity("entity", "media_player"),
        ...titleFields(false),
        section("Favourites", [
          bool("show_favourites"),
          entity("favourites_entity", "sensor"),
          ...(opts.length ? [choose("favourites_include", opts, { multiple: true, reorder: true, mode: "list" })] : []),
          list("favourites", { name: { ...textField("name"), label: "Name", required: true }, media_content_id: { ...textField("media_content_id"), label: "Media content ID", required: true }, media_content_type: { ...textField("media_content_type"), label: "Media content type" }, image: { ...textField("image"), label: "Image URL" } }, "name", "media_content_id"),
        ], { icon: "mdi:star-outline", expanded: true }),
        section("Controls", [grid(bool("show_art"), bool("show_progress")), grid(bool("show_transport"), bool("show_volume")), grid(bool("show_mute"), bool("show_group")), grid(bool("show_shuffle_repeat"), bool("show_chip"))], { icon: "mdi:tune-variant" }),
        appearance([["compact", "Compact"], ["standard", "Wide"], ["large", "Tall"]], [colour("accent")]),
        actions(),
      ],
      labels: { show_favourites: "Show favourites", favourites_entity: "Sonos favourites sensor", favourites_include: "Favourites to show (in this order)", favourites: "Extra favourites (manual)", show_art: "Album art", show_progress: "Progress bar", show_transport: "Previous / next", show_volume: "Volume", show_mute: "Mute button", show_group: "Grouped speakers", show_shuffle_repeat: "Shuffle and repeat", show_chip: "Playing status chip", name: "Title (room)" },
      helpers: {
        favourites_entity: opts.length ? "Found your Sonos favourites." : "Enable sensor.sonos_favorites under Settings → Devices → Sonos → Entities to pick favourites here.",
        favourites_include: "Leave empty to show them all.",
        favourites: "For things that aren't Sonos favourites, with an optional image URL (Sonos favourites get their artwork automatically). Find the ID in Media → browse, or Developer tools.",
      },
    };
  }

  private favourites(): Favourite[] {
    const c = this._config!;
    const items: Record<string, string> = (this.favEntity && this.stateOf(this.favEntity)?.attributes.items) || {};
    const ids = c.favourites_include?.length ? c.favourites_include.filter((id) => items[id]) : Object.keys(items);
    return [...ids.map((id) => ({ name: items[id], media_content_id: id, media_content_type: "favorite_item_id" })), ...(c.favourites || [])];
  }

  protected override willUpdate() {
    // Refetch artwork when the player or the favourites list changes.
    const c = this._config, hass = this._hass;
    if (!c || !hass?.callWS || c.show_favourites === false) return;
    const fav = this.favEntity ? this.stateOf(this.favEntity) : undefined;
    const key = `${c.entity}|${fav?.last_updated ?? ""}`;
    if (key === this._thumbKey) return;
    this._thumbKey = key;
    this.loadThumbs(hass, c.entity).then((t) => { if (this._thumbKey === key) { this._thumbs = t; this.requestUpdate(); } }, () => {});
  }

  private async loadThumbs(hass: HomeAssistant, entity: string) {
    const browse = (type: string, id: string) => hass.callWS!<BrowseNode>({ type: "media_player/browse_media", entity_id: entity, media_content_type: type, media_content_id: id });
    const root = await browse("favorites", "");
    const folders = (root.children || []).filter((n) => n.media_content_type === "favorites_folder");
    const items = [...(root.children || []), ...(await Promise.all(folders.map((f) => browse("favorites_folder", f.media_content_id).catch(() => ({ children: [] } as unknown as BrowseNode))))).flatMap((f) => f.children || [])];
    const out: Record<string, string> = {};
    for (const n of items) if (n.thumbnail && n.media_content_type === "favorite_item_id") out[n.media_content_id] = n.thumbnail;
    return out;
  }

  private position(s: HassEntity) {
    const a = s.attributes;
    let pos = num(a.media_position, 0);
    if (s.state === "playing" && a.media_position_updated_at) pos += (Date.now() - Date.parse(a.media_position_updated_at)) / 1000;
    return Math.min(pos, num(a.media_duration, 0));
  }

  override disconnectedCallback() { super.disconnectedCallback(); clearInterval(this._timer); this._timer = undefined; }

  protected override updated() {
    // Tick the progress bar once a second only while something is playing.
    const playing = this.stateOf(this._config?.entity)?.state === "playing" && this._config?.show_progress !== false;
    if (playing && !this._timer) this._timer = window.setInterval(() => this.requestUpdate(), 1000);
    if (!playing && this._timer) { clearInterval(this._timer); this._timer = undefined; }
  }

  private svc(service: string, data: Record<string, unknown> = {}) { this.call("media_player", service, { entity_id: this._config!.entity, ...data }); }

  override render() {
    const c = this._config!, s = this.stateOf(c.entity);
    const name = this.t(c.name, friendlyName(s, c.entity));
    if (!s) return this.unavailable(name, `Entity not found: ${c.entity}`, icon("speaker"));
    if (isUnavailable(s)) return this.unavailable(name, "Unavailable", icon("speaker"));
    const a = s.attributes, feat = num(a.supported_features, 0);
    const has = (f: number) => (feat & f) === f;
    const playing = s.state === "playing", idle = !["playing", "paused", "buffering"].includes(s.state);
    const accent = this.colour(c.accent, "var(--tm-accent)");
    const stateCol = playing ? "var(--tm-ok)" : idle ? "var(--tm-idle)" : "var(--tm-warn)";
    const chip = c.show_chip === false ? nothing : html`<span class="chip" style="--cc:${stateCol}"><i></i>${this.hass?.formatEntityState?.(s) ?? cap(s.state)}</span>`;
    const title = idle ? "" : a.media_title || a.source || "Playing";
    const others: string[] = (c.show_group !== false && Array.isArray(a.group_members) ? a.group_members : []).filter((e: string) => e !== c.entity).map((e: string) => friendlyName(this.stateOf(e), e.split(".")[1]));
    const artist = idle ? "" : [a.media_artist || a.media_album_name || a.app_name, others.length ? `with ${others.join(", ")}` : ""].filter(Boolean).join(" · ");
    const pic = a.entity_picture_local || a.entity_picture;
    const artStyle = pic && !idle ? `background-image:url('${pic}')` : artFallback(String(a.media_title || name));
    const showArt = c.show_art !== false;
    const art = showArt ? html`<div class="art" style=${artStyle}>${idle ? icon("speaker") : nothing}</div>` : nothing;
    const dur = num(a.media_duration, 0);
    const prog = c.show_progress !== false && dur > 0 && !idle ? html`<div class="prog" role="progressbar" aria-valuenow=${Math.round(this.position(s))} aria-valuemax=${dur}><i style="width:${(this.position(s) / dur) * 100}%"></i></div>` : nothing;
    const canPlay = has(F.PLAY) || has(F.PAUSE);
    const playBtn = canPlay ? html`<button class="play" ?disabled=${idle && !this.favourites().length} aria-label=${playing ? "Pause" : "Play"} @click=${() => this.svc(playing ? "media_pause" : "media_play")}>${icon(playing ? "pause" : "play")}</button>` : nothing;
    const transport = c.show_transport !== false;
    const tp = html`<div class="tp">
      ${transport && has(F.PREV) ? html`<button class="ic" aria-label="Previous" @click=${() => this.svc("media_previous_track")}>${icon("prev")}</button>` : nothing}
      ${playBtn}
      ${transport && has(F.NEXT) ? html`<button class="ic" aria-label="Next" @click=${() => this.svc("media_next_track")}>${icon("next")}</button>` : nothing}
      ${c.show_shuffle_repeat && has(F.SHUFFLE) ? html`<button class="ic" aria-label="Shuffle" aria-pressed=${!!a.shuffle} @click=${() => this.svc("shuffle_set", { shuffle: !a.shuffle })}>${icon("shuffle")}</button>` : nothing}
      ${c.show_shuffle_repeat && has(F.REPEAT) ? html`<button class="ic" aria-label="Repeat ${a.repeat || "off"}" aria-pressed=${a.repeat && a.repeat !== "off"} @click=${() => this.svc("repeat_set", { repeat: a.repeat === "off" ? "all" : a.repeat === "all" ? "one" : "off" })}>${icon("repeat")}</button>` : nothing}
    </div>`;
    const vol = c.show_volume !== false && has(F.VOLUME_SET) ? html`<div class="vol">
      ${c.show_mute && has(F.VOLUME_MUTE) ? html`<button class="rbtn sm" aria-label=${a.is_volume_muted ? "Unmute" : "Mute"} @click=${() => this.svc("volume_mute", { is_volume_muted: !a.is_volume_muted })}>${icon(a.is_volume_muted ? "mute" : "speaker")}</button>` : nothing}
      <tm-slider .value=${Math.round(num(a.volume_level, 0) * 100)} min="0" max="100" icon="speaker" label="Volume" @value-changed=${(e: CustomEvent) => this.svc("volume_set", { volume_level: e.detail.value / 100 })}></tm-slider></div>` : nothing;
    const favs = c.show_favourites !== false && has(F.PLAY_MEDIA) ? this.favourites() : [];
    const favArt = (f: Favourite) => {
      const src = f.image || this._thumbs[f.media_content_id];
      return src && !this._broken.has(src) ? html`<img src=${src} alt="" loading="lazy" @error=${() => { this._broken.add(src); this.requestUpdate(); }}>` : icon("star");
    };
    const favRow = favs.length ? html`<div class="favs">${favs.map((f) => html`<button @click=${() => this.svc("play_media", { media_content_id: f.media_content_id, media_content_type: f.media_content_type || "favorite_item_id" })}>${favArt(f)}${f.name}</button>`)}</div>` : nothing;
    const trk = title ? html`<div class="trk"><strong>${title}</strong>${artist ? html`<span>${artist}</span>` : nothing}</div>` : nothing;
    const kicker = this.t(c.kicker, "Sonos");

    if (this.cardLayout === "compact") {
      return this.shell(html`<div class="in compact">${art}<div class="trk" style="gap:6px">${name ? html`<span class="kick">${name}</span>` : nothing}${title ? html`<strong>${title}</strong>` : nothing}${artist ? html`<span>${artist}</span>` : nothing}${prog}</div><div class="tp">${playBtn}</div></div>`, { c: accent });
    }
    if (this.cardLayout === "large") {
      return this.shell(html`<div class="in tall" style="gap:10px">
        ${showArt ? html`<div class="art" style=${artStyle}><div class="scrim"></div><div class="row"><div class="titles" style="min-width:0;display:grid;gap:4px">${kicker ? html`<span class="kick">${kicker}</span>` : nothing}<span class="ttl">${name}</span></div>${chip}</div></div>` : this.header(kicker, name, chip)}
        ${trk}${prog}<div class="row" style="justify-content:center">${tp}</div>${vol}${favRow}
      </div>`, { c: accent });
    }
    return this.shell(html`<div class="in ${showArt ? "wide" : "solo"}">${art}<div class="body">
      ${this.header(kicker, name, chip)}${trk}${prog}
      <div class="row">${tp}<div class="sp">${vol}</div></div>
    </div>${favRow}</div>`, { c: accent });
  }
}

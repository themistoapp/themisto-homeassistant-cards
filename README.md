# Themisto Cards

Home Assistant dashboard cards in the Themisto look: Black Italic figures, frosted panels and small status chips. They switch between light and dark with your Home Assistant theme.

Version 2 is a rebuild. Existing v1 YAML won't load; set the cards up again in the visual editor.

| Card | Type | Sizes (columns × rows) |
|---|---|---|
| Thermostat | `custom:themisto-thermostat-card` | compact 6×2 · standard 6×4 · large 6×5 |
| Sensor | `custom:themisto-sensor-card` | compact 6×2 · standard 6×4 · large 12×4 |
| Media | `custom:themisto-media-card` | compact 6×2 · wide 12×4 · tall 6×6 |
| Light | `custom:themisto-light-card` | compact 3×2 · standard 6×4 |
| Light list | `custom:themisto-light-list-card` | 6 or 12 wide, height fits the lights |
| Vehicle | `custom:themisto-vehicle-card` | compact 6×3 · standard 6×6 · large 12×4 |
| Network | `custom:themisto-unifi-card` | compact 6×2 · standard 6×4 · wide 12×3 |
| Containers | `custom:themisto-portainer-card` | 6 or 12 wide, height fits the containers |
| Status badge | `custom:themisto-status-badge` | badge |

## Install

### HACS
1. In HACS, open the menu → **Custom repositories**, add this repository's URL and choose **Dashboard**.
2. Download **Themisto Cards**, then refresh the browser.

### By hand
1. Copy `dist/themisto-cards.js` to `/config/www/themisto/themisto-cards.js`.
2. Under **Settings → Dashboards → ⋮ → Resources**, add `/local/themisto/themisto-cards.js?v=2.0.0` as a **JavaScript module**.
3. Refresh. When you update, replace the file and change the `?v=` number.

The fonts are built into the one file, so there's nothing else to copy.

## Setting cards up

Every option is in the visual editor. Add a card, search for "Themisto", and work through the sections. YAML is optional.

These rules apply to every card:

- **Size.** *Auto* picks a layout from the height you drag the card to. You can also fix it to compact, standard or large. Each size fits Home Assistant's grid exactly, and cards adapt to their width, so nothing overflows on a phone.
- **Titles.** *Title* and *Label above title* default to something sensible. Leave a box blank to use the default, or type a single space to hide it.
- **No entity, no element.** Chips, stats and buttons appear only when their entity is set. Controls a device can't use, like dimming on an on/off lamp, are left out.
- **Colours.** Accent and state colours use Home Assistant's colour picker.
- **Actions.** Tap, hold and double-tap use Home Assistant's own action editor. Chips and stats open more-info by default.

## Card notes

**Thermostat.** Modes come from the thermostat itself. You can choose which to show and rename them. *Presets* are your own named temperatures, not the thermostat's preset modes. They show on the large size, and tapping one sets the target. Quick taps on + and − are added up and sent once.

**Sensor.** The graph uses Home Assistant's live history and updates as the sensor changes. Stats can be other sensors, or computed from the graph (lowest, peak, average, change). On cards 480px or wider, stats sit in a column on the right; narrower cards show the first two under the graph. The status chip can change text and colour above or below a threshold.

**Media.** Turn on `sensor.sonos_favorites` (Settings → Devices → Sonos → Entities, it's disabled by default). The editor then lists your favourites so you can pick and order them. You can also add other media by content ID.

**Light / Light list.** Compact light tiles toggle on tap, open more-info on hold, and dim when you drag sideways. In the list, tap a dimmable row to open its brightness and colour controls. Rows that can't dim just switch on and off.

**Vehicle.** Pick an entity for each slot you have: fuel or battery level, range, odometer, lock, doors, windows, location, and for electric vehicles charging, power, limit, time to full and plug. For the image, use a transparent PNG or WebP. `assets/m140i.webp` is the M140i render, already trimmed: upload it to `/config/www/themisto/` and set the image to `/local/themisto/m140i.webp`.

**Network.** Map whatever your UniFi integration provides. Each client count can add up several sensors (for example one per access point). The chip shows Degraded when latency goes above your threshold.

**Containers.** Choose your Portainer endpoint device and the card finds its containers, including ones you add later. Restart asks before it runs. Press and hold a row to stop or start that container. You can pin, include or hide containers by name.

## Development

```sh
npm install
npm run dev     # harness with a mock Home Assistant: every card at every size, light/dark, worst-case data, live updates
npm test        # unit tests
npm run build   # dist/themisto-cards.js
```

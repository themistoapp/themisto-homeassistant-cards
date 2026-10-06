# Themisto Cards

Home Assistant dashboard cards in the Themisto look, following themisto.app/brand: Black Italic titles and readings, frosted glass cards with solid panels inside, and one pill style for status. They switch between light and dark with your Home Assistant theme.

Version 2 is a rebuild. Existing v1 YAML won't load; set the cards up again in the visual editor.

| Card | Type | Sizes (columns × rows) |
|---|---|---|
| Heading | `custom:themisto-heading-card` | full width, height fits |
| Thermostat | `custom:themisto-thermostat-card` | compact 6×2 · standard 6×4 · tall 6×5 |
| Sensor | `custom:themisto-sensor-card` | compact 6×2 · standard 6×4 · wide 12×4 |
| Energy | `custom:themisto-energy-card` | compact 6×4 · standard 6×6 · wide 12×4 |
| EV charger | `custom:themisto-charger-card` | compact 6×2 · standard 6×4 · wide 12×4 |
| Media | `custom:themisto-media-card` | compact 6×2 · wide 12×4 · tall 6×6 |
| Light | `custom:themisto-light-card` | compact 3×2 · standard 6×4 |
| Light list | `custom:themisto-light-list-card` | 6 or 12 wide, height fits the lights |
| Vehicle | `custom:themisto-vehicle-card` | compact 6×3 · standard 6×5 · wide 12×4 |
| Network | `custom:themisto-unifi-card` | compact 6×2 · standard 6×4 · wide 12×3 |
| Containers | `custom:themisto-portainer-card` | 6 or 12 wide, height fits the containers |
| Status badge | `custom:themisto-status-badge` | badge |

## Install

### HACS
1. In HACS, open the menu → **Custom repositories**, add this repository's URL and choose **Dashboard**.
2. Download **Themisto Cards**, then refresh the browser.

### By hand
1. Copy `dist/themisto-cards.js` to `/config/www/themisto/themisto-cards.js`.
2. Under **Settings → Dashboards → ⋮ → Resources**, add `/local/themisto/themisto-cards.js?v=2.14.0` as a **JavaScript module**.
3. Refresh. When you update, replace the file and change the `?v=` number.

The fonts are built into the one file, so there's nothing else to copy.

## Setting cards up

Every option is in the visual editor. Add a card, search for "Themisto", and work through the sections. YAML is optional.

These rules apply to every card:

- **Size.** *Auto* picks a layout from the height you drag the card to. You can also fix it to compact, standard, wide or tall, where the card has that size. In YAML, `large` still works and means the card's wide or tall size. Each size fits Home Assistant's grid exactly, and cards adapt to their width, so nothing overflows on a phone.
- **Titles.** *Title* and *Label above title* default to something sensible. Leave a box blank to use the default, or type a single space to hide it.
- **No entity, no element.** Chips, stats and buttons appear only when their entity is set. Controls a device can't use, like dimming on an on/off lamp, are left out.
- **Colours.** Status uses the brand's green, orange and red. Accent and state colours can be changed with Home Assistant's colour picker.
- **Pills.** A card shows a status pill only when nothing else on it already shows the state.
- **Actions.** Tap, hold and double-tap use Home Assistant's own action editor. Chips and stats open more-info by default.

## Card notes

**Heading.** A page or section title in the brand's sizes, with an optional label above and up to four pills showing an entity's name and state. It sits straight on the dashboard, without a card behind it.

**Thermostat.** The dial follows the Nest Learning Thermostat (3rd gen): black when idle, orange when heating, blue when cooling, with ticks lit between the current temperature and the target. The current temperature sits on the ring by its tick, and a leaf shows when the eco preset is on. Temperatures show to the nearest half degree. Modes come from the thermostat itself. You can choose which to show and rename them. *Presets* are your own named temperatures, not the thermostat's preset modes. They show on the tall size, and tapping one sets the target. Quick taps on + and − are added up and sent once.

**Sensor.** The graph uses Home Assistant's live history and updates as the sensor changes. Stats can be other sensors, or computed from the graph (lowest, peak, average, change). On cards 480px or wider, stats sit in a column on the right; narrower cards show the first two under the graph. The status chip can change text and colour above or below a threshold.

**Energy.** Each tile is identified by its icon: grid, solar, battery and home. Set *Peak output* under Solar (your system's maximum, in kW) to show a bar of solar output against it. The battery bar moves while it charges.

**EV charger.** The figure is the charger's power in kW (0 when idle) when you set a power monitor; the pill says whether it's charging, plugged in or idle.

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

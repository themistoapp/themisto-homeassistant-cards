import type { HomeAssistant } from "../types";
import { num } from "./util";

export interface Sample { t: number; v: number | null } // t in ms; null = unavailable

/**
 * Puts raw state samples on a fixed time axis. Each bucket takes the mean of samples inside it;
 * a bucket with no samples carries the last known value forward (sensor states persist until
 * they change). Unavailable stretches stay null so the graph shows a gap.
 */
export function bucket(samples: Sample[], start: number, end: number, n: number): (number | null)[] {
  const out: (number | null)[] = new Array(n).fill(null);
  const width = (end - start) / n;
  const sorted = [...samples].sort((a, b) => a.t - b.t);
  let i = 0;
  let last: number | null = null;
  while (i < sorted.length && sorted[i].t < start) last = sorted[i++].v;
  for (let b = 0; b < n; b++) {
    const bEnd = start + (b + 1) * width;
    let sum = 0, count = 0, sawNull = false;
    while (i < sorted.length && sorted[i].t < bEnd) {
      const v = sorted[i++].v;
      if (v === null) sawNull = true; else { sum += v; count++; }
      last = v;
    }
    out[b] = count ? sum / count : sawNull ? null : last;
  }
  return out;
}

type StreamMsg = { states?: Record<string, { s: string; lu: number; lc?: number }[]> };

/**
 * Live history over a sliding window using HA's history/stream websocket subscription:
 * one subscription per card, the first message carries the backlog, later ones append.
 * Returns an unsubscribe function.
 */
export function subscribeHistory(
  hass: HomeAssistant,
  entityIds: string[],
  hours: number,
  onData: (data: Record<string, Sample[]>) => void,
): () => void {
  const store: Record<string, Sample[]> = Object.fromEntries(entityIds.map((e) => [e, []]));
  let unsub: (() => void) | undefined;
  let closed = false;
  const windowMs = hours * 3600_000;
  hass.connection
    .subscribeMessage<StreamMsg>((msg) => {
      const cutoff = Date.now() - windowMs - 3600_000; // keep one extra hour for carry-forward
      for (const [id, list] of Object.entries(msg.states || {})) {
        const arr = (store[id] ||= []);
        for (const x of list) {
          const v = num(x.s);
          arr.push({ t: (x.lu ?? x.lc ?? 0) * 1000, v: Number.isFinite(v) ? v : null });
        }
        while (arr.length > 1 && arr[1].t < cutoff) arr.shift();
      }
      onData(store);
    }, {
      type: "history/stream",
      entity_ids: entityIds,
      start_time: new Date(Date.now() - windowMs).toISOString(),
      minimal_response: true,
      no_attributes: true,
      significant_changes_only: false,
    })
    .then((u) => { if (closed) u(); else unsub = u; })
    .catch(() => onData(store));
  return () => { closed = true; unsub?.(); };
}

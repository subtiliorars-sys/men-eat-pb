import type { TableEventId } from "./types.js";

export interface TableEventDef {
  id: TableEventId;
  label: string;
  description: string;
  duration: number;
}

export const TABLE_EVENTS: Record<TableEventId, TableEventDef> = {
  ants: {
    id: "ants",
    label: "Ant Invasion!",
    description: "Ants swarm the table — blobs spawn 2× faster, chomps worth 1.5× for 8s.",
    duration: 8,
  },
  mom_share: {
    id: "mom_share",
    label: "Mom Says Share",
    description: "Take turns! Same man twice = half value. Alternating men = +50% bonus for 10s.",
    duration: 10,
  },
};

export const TABLE_EVENT_IDS: TableEventId[] = ["ants", "mom_share"];

export function tableEventDef(id: TableEventId): TableEventDef {
  return TABLE_EVENTS[id];
}

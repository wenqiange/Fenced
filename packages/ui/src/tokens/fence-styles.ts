/**
 * Fence materials. Per the brand doc, a style reskins only the fence itself —
 * semantic colours (breach amber above all) never change with it.
 */
export type FenceStyleId = "timber-pine" | "shou-sugi-ban" | "nordic-birch" | "fieldstone-iron";

export interface FenceMaterial {
  id: FenceStyleId;
  name: string;
  blurb: string;
  post: string;
  postCap: string;
  rail: string;
  picket: string;
  /** Darker stroke along a picket's edge — reads as grain/bevel. */
  picketEdge: string;
  picketEmpty: string;
  latch: string;
  /** Rails flash this on panel completion. */
  glow: string;
  /** Sessions needed to unlock; previews are always allowed. */
  unlockAtSessions: number;
}

export const FENCE_STYLES: Record<FenceStyleId, FenceMaterial> = {
  "timber-pine": {
    id: "timber-pine",
    name: "Timber & Pine",
    blurb: "The original. Warm timber pickets on pine posts.",
    post: "#1F3D30",
    postCap: "#2E5A46",
    rail: "#A8732F",
    picket: "#C08A4E",
    picketEdge: "#9C6A35",
    picketEmpty: "rgba(192, 138, 78, 0.18)",
    latch: "#3B3F3C",
    glow: "#F2C98A",
    unlockAtSessions: 0,
  },
  "shou-sugi-ban": {
    id: "shou-sugi-ban",
    name: "Shou Sugi Ban",
    blurb: "Charred cedar, finished in copper.",
    post: "#1A1716",
    postCap: "#2A2421",
    rail: "#B26B3F",
    picket: "#2E2724",
    picketEdge: "#4A3B33",
    picketEmpty: "rgba(178, 107, 63, 0.16)",
    latch: "#C27B4A",
    glow: "#E9A26F",
    unlockAtSessions: 10,
  },
  "nordic-birch": {
    id: "nordic-birch",
    name: "Nordic Birch",
    blurb: "Pale birch and slate. Quiet and light.",
    post: "#4B5560",
    postCap: "#5E6A75",
    rail: "#BFAF95",
    picket: "#E6DAC4",
    picketEdge: "#CBBC9F",
    picketEmpty: "rgba(191, 175, 149, 0.22)",
    latch: "#4B5560",
    glow: "#FFF3D6",
    unlockAtSessions: 25,
  },
  "fieldstone-iron": {
    id: "fieldstone-iron",
    name: "Fieldstone & Iron",
    blurb: "Dry-stone posts and forged iron rails.",
    post: "#7A746B",
    postCap: "#8E877D",
    rail: "#2F3336",
    picket: "#4A4F53",
    picketEdge: "#33373A",
    picketEmpty: "rgba(122, 116, 107, 0.2)",
    latch: "#1F2224",
    glow: "#C9D4DA",
    unlockAtSessions: 50,
  },
};

export const FENCE_STYLE_ORDER: FenceStyleId[] = [
  "timber-pine",
  "shou-sugi-ban",
  "nordic-birch",
  "fieldstone-iron",
];

export function fenceMaterial(id: string | null | undefined): FenceMaterial {
  return FENCE_STYLES[(id as FenceStyleId) ?? "timber-pine"] ?? FENCE_STYLES["timber-pine"];
}

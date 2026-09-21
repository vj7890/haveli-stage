/**
 * The Haveli set-out, read from haveli-stage.obj. Metres. +X house right,
 * +Y up, +Z toward the audience; origin at the centre of the main stage's
 * front edge at hall-floor level. Every number here is the model's own.
 */
export const LED = {
  /** The back LED's raster — the physical wall at 2.5 mm pitch, 1:1. */
  px: [10240, 1920] as [number, number],
  pitchMm: 2.5,
  w: 25.6, h: 4.8,
  x: [-12.8, 12.8] as [number, number],
  y: [1.605, 6.405] as [number, number],
  /** The face the room sees — the carcass is behind it. */
  z: -7.195,
  aspect: 25.6 / 4.8,
}

export const STAGE = { deckH: 1.3, frontW: 22.5, midW: 26.3, depth: 7.5, foreH: 1.1, foreW: 9.75, foreD: 4.88 }
export const HALL = { w: 45, d: 50, wallH: 7.6, floorZ: [-7.5, 42.5] as [number, number] }
export const CABIN = { x: [-3.72, 3.72] as [number, number], y: [1.66, 4.965] as [number, number], z: [-6.05, -0.3] as [number, number], plinthH: 0.36 }
export const CHAIR = { x: 0, y: 2.02, z: -3.35 }

/** LED-space (metres) → raster pixels, top-left origin. */
export const ledPx = (x: number, y: number): [number, number] => [
  Math.round(((x - LED.x[0]) / LED.w) * LED.px[0]),
  Math.round(((LED.y[1] - y) / LED.h) * LED.px[1]),
]

/** Where the cabin sits in the picture: the box it covers, in pixels. */
export const cabinPx = () => {
  const [x0, y0] = ledPx(CABIN.x[0], CABIN.y[1])
  const [x1, y1] = ledPx(CABIN.x[1], CABIN.y[0])
  return { x0, y0, x1: Math.min(x1, LED.px[0]), y1: Math.min(y1, LED.px[1]) }
}

/** Handy aim points for the rig, scene metres. */
export const TARGETS: { id: string; label: string; at: [number, number, number] }[] = [
  { id: 'chair', label: 'Chair', at: [0, 2.6, CHAIR.z] },
  { id: 'cabin', label: 'Cabin', at: [0, 3.3, (CABIN.z[0] + CABIN.z[1]) / 2] },
  { id: 'centre', label: 'Centre stage', at: [0, STAGE.deckH + 1, -1.5] },
  { id: 'fore', label: 'Forestage', at: [0, STAGE.foreH + 1, 2.4] },
  { id: 'ledL', label: 'LED left', at: [-9, 4, LED.z] },
  { id: 'ledR', label: 'LED right', at: [9, 4, LED.z] },
  { id: 'house', label: 'The room', at: [0, 1.4, 22] },
  { id: 'down', label: 'Straight down', at: [0, -1, 0] },
]

/** Named groups in the model, for the visibility toggles. */
export const MODEL_GROUPS: { id: string; label: string; match: (name: string) => boolean; color: string }[] = [
  { id: 'stage', label: 'Stage, stairs, backstage', match: (n) => /^(main_stage|stair_|backstage)/.test(n), color: '#8e99a6' },
  { id: 'forestage', label: 'Forestage — 4 × 4 decks', match: (n) => n.startsWith('forestage_'), color: '#a8b3c0' },
  { id: 'led', label: 'Back LED — 25.6 × 4.8 m', match: (n) => n.startsWith('led_'), color: '#f0a050' },
  { id: 'cabin', label: 'Cabin and chair', match: (n) => /^(cabin_|chair_)/.test(n), color: '#d8d2c4' },
  { id: 'masking', label: 'Curtain wings, drape, cordons', match: (n) => /^(curtain_|drape|cordon_)/.test(n), color: '#5a5048' },
  { id: 'hall', label: 'Hall floor and walls', match: (n) => n.startsWith('hall_'), color: '#7d8794' },
]

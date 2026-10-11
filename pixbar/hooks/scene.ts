// The whale's sea, drawn as pure data: a pixel grid in, Raster cells out.
// No `$` and no imports in here, so the tests can run every state without an engine, and
// pixbar.dev can import this file as it is to draw its preview.

export type Mode = 'idle' | 'thinking' | 'tool-use' | 'responding'

export type Skin = {
  name: string
  w: number
  nframes: number
  idle: number
  frames: string[] // (nframes + 1) * 10 rows, each `w` digits
  dirty: string[] // 10 rows of `w` 0/1 digits: what turns cream on uncommitted work
  base: number
  gauge: number
  cream: number
  inks: (number | undefined)[] // digits 2..4
  habitat?: 'sea' | 'land' // land: walks on grass under a sky instead of swimming; unset is the sea
  ride?: 'skateboard' // land: rides a skateboard while it answers (clawd); unset walks
}

// The whale, exactly as skins/whale.sh ships it (scripts/check-whale.ts keeps them equal).
export const WHALE: Skin = {
  name: 'whale',
  w: 15,
  nframes: 4,
  idle: 4,
  frames: [
    '000000000000000', '000000000000000', '111111111110111', '111111111111111', '110111111111110',
    '111111111111100', '111111111111100', '000001111110110', '111111111100011', '000001100000011',
    '000000000000011', '111111111110111', '111111111111110', '110111111111100', '111111111111100',
    '111111111111110', '000001111110111', '111111111100011', '000001100000000', '000000000000000',
    '000000000000011', '000000000000011', '111111111110110', '111111111111100', '110111111111100',
    '111111111111110', '111111111111111', '000001111110111', '111111111100000', '000001100000000',
    '000000000000000', '000000000000011', '111111111110111', '111111111111110', '110111111111100',
    '111111111111100', '111111111111110', '000001111110111', '111111111100011', '000001100000000',
    '000000000000000', '000000000000011', '111111111110111', '111111111111110', '110111111111100',
    '111111111111100', '111111111111110', '000001111110111', '111111111100011', '000001100000000',
  ],
  dirty: Array(10).fill('000000000001111'),
  base: 0xf7931a,
  gauge: 0xd8695e,
  cream: 0xfaf9f5,
  inks: [],
}

const rgbTriple = (v: string | undefined): number | undefined => {
  const m = v?.match(/^(\d{1,3});(\d{1,3});(\d{1,3})$/)
  if (!m) return undefined
  const [r = 0, g = 0, b = 0] = [m[1], m[2], m[3]].map(Number)
  if (r > 255 || g > 255 || b > 255) return undefined
  return (r << 16) | (g << 8) | b
}

// Reads a pixerbar skin file (shell) without running it: the scalar assignments
// and the two quoted-string arrays. Anything malformed returns undefined, and the
// caller keeps the built-in whale.
export function parseSkin(src: string): Skin | undefined {
  const scalar = (name: string) => src.match(new RegExp(`^\\s*${name}=['"]?([^'"\\s#;]+(?:;[^'"\\s#;]+)*)['"]?`, 'm'))?.[1]
  const array = (name: string) => {
    const body = src.match(new RegExp(`^\\s*${name}=\\(([\\s\\S]*?)^\\s*\\)`, 'm'))?.[1]
    return body ? [...body.replace(/#.*$/gm, '').matchAll(/"([0-9]+)"/g)].map(m => m[1] ?? '') : undefined
  }
  const w = Number(scalar('W'))
  const nframes = Number(scalar('NFRAMES'))
  const frames = array('FRAMES') as string[] | undefined
  const dirty = array('DIRTY') as string[] | undefined
  if (!Number.isInteger(w) || w < 8 || w > 40) return undefined
  if (!Number.isInteger(nframes) || nframes < 2 || nframes > 6) return undefined
  if (!frames || frames.length !== (nframes + 1) * 10 || frames.some(r => r.length !== w)) return undefined
  const idle = Number(scalar('IDLE_FRAME') ?? nframes)
  return {
    name: scalar('SKIN_NAME') ?? 'skin',
    w,
    nframes,
    idle: Number.isInteger(idle) && idle >= 0 && idle <= nframes ? idle : nframes,
    frames,
    dirty: dirty && dirty.length === 10 && dirty.every(r => r.length === w) ? dirty : Array(10).fill('0'.repeat(w)),
    base: rgbTriple(scalar('SKIN_BASE')) ?? WHALE.base,
    gauge: rgbTriple(scalar('SKIN_GAUGE')) ?? WHALE.gauge,
    cream: rgbTriple(scalar('SKIN_CREAM')) ?? WHALE.cream,
    inks: [undefined, undefined, rgbTriple(scalar('SKIN_INK2')), rgbTriple(scalar('SKIN_INK3')), rgbTriple(scalar('SKIN_INK4'))],
    // unset, not 'sea', when the file says nothing: a copy saved before HABITAT existed
    // takes the habitat from the mod's own skin of the same name
    habitat: ({ land: 'land', sea: 'sea' } as const)[scalar('HABITAT') ?? ''],
    ride: scalar('RIDE') === 'skateboard' ? 'skateboard' : undefined,
  }
}

// ---------------------------------------------------------------- the sea ---

export const SEA_H = 20 // pixels: 10 terminal rows of half-blocks
export const SURF = 0 // the surface wave is the top row: no sky above it
const AIR = -1
// The floor, the same in both scenes: one row along the bottom, a sand crest at sea, grass on
// land. The creature rests on the row above it.
const GROUND = SEA_H - 1
const SEABED = GROUND
// The floor's top row at column x: smooth, the same everywhere and in both scenes.
const floorTop = (_x: number) => GROUND

const C = {
  water: 0x0f2233,
  deep: 0x0a1824,
  surface: 0x4e6f8e,
  spray: 0x9cc8ef,
  dim: 0x7b8591,
  sand: 0x3b3428,
  crest: 0x52483a, // the lit edge along the top of the sand
  weed: 0x2e6b57,
  weedHi: 0x3f8a70,
}

// Both scenes fade over the six rows above their floor and keep their plants in the same places.
const PLANTS = [0.06, 0.34, 0.64, 0.9]

// Uncommitted work: plants come up and litter lies on the floor, the same in both scenes.
// Committed: the floor is clean, nothing on it. Nothing changes colour.
const JUNK = { paper: 0xd9d2c0, tin: 0x9aa3ad, tinLo: 0x6b737c, glass: 0x8a5a2b, glassHi: 0xb07a3e }
function strew(put: (x: number, y: number, c: number) => void, w: number) {
  const at = (fx: number) => Math.round(w * fx)
  const lay = (x: number, up: number, c: number) => put(x, floorTop(x) - up, c) // on the floor, never in it: the floor stays smooth
  lay(at(0.12), 1, JUNK.paper); lay(at(0.12) + 1, 1, JUNK.paper); lay(at(0.12) + 1, 2, JUNK.paper) // a crumpled sheet
  lay(at(0.25), 1, JUNK.tin); lay(at(0.25) + 1, 1, JUNK.tinLo) // a can on its side
  lay(at(0.73), 1, JUNK.glass); lay(at(0.73) + 1, 1, JUNK.glass); lay(at(0.73) + 2, 1, JUNK.glassHi) // a bottle
}

export const mix = (a: number, b: number, t: number) => {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t)
  return (ch(16) << 16) | (ch(8) << 8) | ch(0)
}

export type SceneState = {
  t: number // ms since start
  mode: Mode
  ctxPct: number // colour
  level: number // smoothed sprite top row, from the five-hour window
  isDirty: boolean // uncommitted work: plants and litter on the floor; committed, a clean floor
  x: number // the sprite's left column; it swims back and forth
  dir: -1 | 1 // -1 swims left (head first, as drawn), 1 swims right (mirrored)
  bubbles: { x: number; y: number; y0?: number }[] // on land, dust: y0 is where it rose from
  sun?: number // land: the moon's place on its arc, 0..100, eased toward the five-hour window
  w?: number // the sea's width in columns; absent, seaWidth(skin). A pane sizes it to itself.
}

// One width for every shipped creature (whale 15 wide, clawd 21), so they sit side by side at one size.
export const seaWidth = (skin: Skin) => Math.max(54, skin.w + 33)
export const widthOf = (skin: Skin, s: SceneState) => Math.max(skin.w + 12, s.w ?? seaWidth(skin))

// px per ms, by state: parked when idle, slow in thought, fast at work
const SPEED: Record<Mode, number> = { idle: 0, thinking: 0.003, 'tool-use': 0.016, responding: 0.008 }
// On land it stays put to think and to work; only answering moves it, on its board.
const speedOf = (skin: Skin, mode: Mode) => (skin.habitat === 'land' && mode !== 'responding' ? 0 : SPEED[mode])

export function stepSwim(skin: Skin, s: SceneState, dt: number) {
  const max = widthOf(skin, s) - skin.w - 3
  s.x += s.dir * speedOf(skin, s.mode) * dt
  if (s.x < 3) { s.x = 3; s.dir = 1 }
  if (s.x > max) { s.x = max; s.dir = -1 }
}

function headTop(skin: Skin, f: number) {
  for (let r = 0; r < 10; r++) if (skin.frames[f * 10 + r]?.[0] !== '0') return r
  return 2
}

export function frameAt(skin: Skin, mode: Mode, t: number) {
  if (mode === 'idle') return skin.idle
  if (skin.habitat === 'land') {
    // the wand is for work: thinking, it stands with its eyes open and blinks; answering, it skates
    if (mode === 'thinking') return skin.idle
    if (mode === 'responding') return 0
  }
  if (mode === 'thinking') return Math.min([3, 0, 3, 2][Math.floor(t / 700) % 4] ?? 0, skin.nframes - 1)
  if (mode === 'responding') return (t % SPOUT_MS) < SPOUT_MS / 2 ? 1 % skin.nframes : Math.min(3, skin.nframes - 1)
  return Math.floor(t / 150) % skin.nframes
}

// Five-hour window → the sprite's top row. 100%: the head at the surface. 0%: resting on the seabed.
export function levelFor(skin: Skin, pct: number) {
  const f = skin.idle
  const top = SURF - headTop(skin, f) + 1
  const bottom = SEABED - 1 - 9
  return bottom - (Math.max(0, Math.min(100, pct)) / 100) * (bottom - top)
}

const SPOUT_MS = 1400
const SPOUT: [number, number, 'c' | 's' | 'd'][][] = [
  [[0, -1, 'c']],
  [[0, -1, 'c'], [0, -2, 'c']],
  [[0, -1, 'c'], [0, -2, 'c'], [0, -3, 'c']],
  [[0, -1, 'c'], [0, -2, 'c'], [0, -3, 'c'], [-1, -4, 's'], [1, -4, 's']],
  [[0, -1, 's'], [0, -2, 's'], [0, -3, 's'], [-1, -4, 's'], [1, -4, 's'], [-2, -4, 's'], [2, -4, 's']],
  [[0, -1, 'd'], [0, -2, 'd'], [-2, -3, 's'], [2, -3, 's']],
  [[-2, -2, 'd'], [2, -2, 'd']],
  [], [], [],
]
const SONAR_MS = 1600

// The hill behind the creature on land.
const ridgeTop = (x: number) => GROUND - 1 - Math.round(1 + Math.sin(x / 6) + Math.sin(x / 2.3) * 0.5)

export function paintScene(skin: Skin, s: SceneState): Int32Array {
  if (skin.habitat === 'land') return paintLand(skin, s)
  const w = widthOf(skin, s), h = SEA_H
  const px = new Int32Array(w * h).fill(AIR)
  const put = (x: number, y: number, c: number) => {
    if (x >= 0 && x < w && y >= 0 && y < h) px[y * w + x] = c
  }

  // water, fading deeper over the six rows above the seabed; the surface wave on top
  for (let y = 0; y < SEABED; y++) {
    const c = mix(C.water, C.deep, Math.max(0, (y - (SEABED - 6)) / 6))
    for (let x = 0; x < w; x++) put(x, y, c)
  }
  for (let x = 0; x < w; x++) if ((x + Math.floor(s.t / 350)) % 7 < 3) put(x, SURF, C.surface)
  // the seabed: smooth sand, a lit crest along its top
  for (let x = 0; x < w; x++) { const top = floorTop(x); put(x, top, C.crest); for (let y = top + 1; y < h; y++) put(x, y, C.sand) }
  // uncommitted work: seagrass swaying and litter on the seabed; committed, nothing
  if (s.isDirty) PLANTS.forEach((fx, i) => {
    const x0 = Math.round(w * fx), tall = 3 + (i % 2), base = floorTop(x0) - 1
    for (let k = 0; k < tall; k++) {
      const sway = Math.round(Math.sin(s.t / 1300 + i * 1.7 + k * 0.5) * (k / tall) * 1.4)
      put(x0 + sway, base - k, k % 2 ? C.weedHi : C.weed)
    }
  })
  if (s.isDirty) strew(put, w)

  // the whale
  const f = frameAt(skin, s.mode, s.t)
  const flip = s.dir > 0
  const lunge = s.mode === 'tool-use' && (Math.floor(s.t / 150) % 4) % 2 ? s.dir : 0
  const ox = Math.round(s.x) + lunge
  const colX = (c: number) => ox + (flip ? skin.w - 1 - c : c)
  const bob = s.mode === 'thinking' ? Math.round(Math.sin(s.t / 900)) : 0
  const oy = Math.max(SURF - headTop(skin, f) + 1, Math.min(SEABED - 10, Math.round(s.level) + bob))
  const firstRed = 10 - Math.round(s.ctxPct / 10)
  const blink = s.mode === 'idle' && s.t % 4200 < 160
  for (let r = 0; r < 10; r++) {
    const row = skin.frames[f * 10 + r] ?? ''
    for (let c = 0; c < skin.w; c++) {
      const d = row[c] ?? '0'
      const isEye = blink && d === '0' && c === 2 && row[0] !== '0' && row[3] !== '0'
      if (d === '0' && !isEye) continue
      const ink = d >= '2' ? skin.inks[Number(d)] : undefined
      put(colX(c), oy + r, ink ?? (r >= firstRed ? skin.gauge : skin.base))
    }
  }

  // thinking: sonar arcs leave the snout and fade as they spread
  if (s.mode === 'thinking') {
    const mid = oy + 5
    for (const lag of [0, SONAR_MS / 2]) {
      const d = 1 + Math.floor(((s.t + lag) % SONAR_MS) / (SONAR_MS / 5))
      if (d > 4) continue
      // two columns out, so even the first arc's tips stand a clear column off the snout
      const x = colX(0) + s.dir * (d + 2), hh = Math.min(d, 2), tone = mix(C.spray, C.water, (d - 1) * 0.22)
      for (let k = -hh + 1; k <= hh - 1; k++) put(x, mid + k, tone)
      put(x + s.dir * -1, mid - hh, tone); put(x + s.dir * -1, mid + hh, tone)
    }
  }

  // responding: the spout above the surface, a bubble column below it
  if (s.mode === 'responding') {
    const top = oy + headTop(skin, f), bx = colX(4)
    if (top - SURF > 1) {
      const k = Math.floor((s.t % SPOUT_MS) / 140)
      for (let i = 0; i < 3; i++) { const y = top - 1 - ((k + i * 3) % 7); if (y > SURF) put(bx + (i % 2), y, C.spray) }
    } else {
      const phase = Math.floor((s.t % SPOUT_MS) / (SPOUT_MS / SPOUT.length))
      for (const [dx, dy, k] of SPOUT[phase] ?? []) put(bx + dx, top + dy, k === 'c' ? skin.cream : k === 's' ? C.spray : C.dim)
    }
  }

  for (const b of s.bubbles) if (b.y > SURF) put(Math.round(b.x), Math.round(b.y), C.spray)
  return px
}

// Mouth position, where bubbles start. On land, the heels, where dust is kicked up.
export function mouthOf(skin: Skin, s: SceneState): { x: number; y: number; y0?: number } {
  if (skin.habitat === 'land') {
    const y = GROUND - 1
    return { x: s.dir > 0 ? Math.round(s.x) - 1 : Math.round(s.x) + skin.w, y, y0: y }
  }
  const snout = s.dir > 0 ? Math.round(s.x) + skin.w - 1 : Math.round(s.x)
  return { x: snout + s.dir, y: Math.round(s.level) + 7 }
}

export function stepBubbles(s: SceneState, dt: number) {
  for (const b of s.bubbles) {
    if (b.y0 !== undefined) { b.y -= 0.003 * dt; b.x -= s.dir * 0.004 * dt }
    else { b.y -= 0.009 * dt; b.x += 0.15 * Math.sin(b.y) }
  }
  s.bubbles = s.bubbles.filter(b => (b.y0 !== undefined ? b.y > b.y0 - 3 : b.y > SURF && b.x >= 0)).slice(-40)
}

// ---------------------------------------------------------------- the land ---

const L = {
  skyDay: 0x16304a, skyDusk: 0x3b2135, haze: 0x24465f, hazeDusk: 0x5a3040,
  moon: 0xf4ecc8, moonset: 0xe8c47a, cloud: 0x2f4c6a, cloudDusk: 0x5b3a4c, star: 0x9aa3ad,
  hill: 0x1d3a2c, grass: 0x3f8a4f, grassHi: 0x56a862, dirt: 0x4a3a28,
  dust: 0x8a7a60,
  deck: 0x8c3150, wheel: 0xf2b45a, // the sticker's board: maroon deck (lifted to read on dark grass), gold wheels, maroon hub
}

// The columns the feet span in the idle pose: the board sits under them, two wider each side.
function feetOf(skin: Skin) {
  const row = skin.frames[skin.idle * 10 + inkRows(skin, skin.idle).bottom] ?? ''
  const l = row.search(/[1-4]/), r = Math.max(row.lastIndexOf('1'), row.lastIndexOf('2'), row.lastIndexOf('3'), row.lastIndexOf('4'))
  return l < 0 ? { l: 0, r: skin.w - 1 } : { l: Math.max(0, l - 2), r: Math.min(skin.w - 1, r + 2) }
}

// First and last rows with anything in them, over the whole frame.
function inkRows(skin: Skin, f: number) {
  let top = -1, bottom = 9
  for (let r = 0; r < 10; r++) if (/[1-4]/.test(skin.frames[f * 10 + r] ?? '')) { if (top < 0) top = r; bottom = r }
  return { top: Math.max(0, top), bottom }
}

// The empty pixels the body closes round - the eyes - found by flooding in from the edge.
// A blink fills them.
function holesOf(skin: Skin, f: number) {
  const open = new Set<number>(), q: number[] = []
  const empty = (r: number, c: number) => (skin.frames[f * 10 + r]?.[c] ?? '0') === '0'
  for (let r = 0; r < 10; r++) for (let c = 0; c < skin.w; c++)
    if ((r === 0 || r === 9 || c === 0 || c === skin.w - 1) && empty(r, c)) { open.add(r * skin.w + c); q.push(r * skin.w + c) }
  while (q.length) {
    const i = q.pop()!, r = Math.floor(i / skin.w), c = i % skin.w
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const rr = r + dr, cc = c + dc, j = rr * skin.w + cc
      if (rr >= 0 && rr < 10 && cc >= 0 && cc < skin.w && !open.has(j) && empty(rr, cc)) { open.add(j); q.push(j) }
    }
  }
  const holes = new Set<number>()
  for (let r = 0; r < 10; r++) for (let c = 0; c < skin.w; c++) if (empty(r, c) && !open.has(r * skin.w + c)) holes.add(r * skin.w + c)
  return holes
}

const JUMP_MS = 1400 // answering, it jumps once a beat: up three pixels and down again in the first 600ms

// The same signals, read for something that walks. Context is still its colour and git
// still litters the floor; the turn is still how it moves. The five-hour window can't be a
// depth on land, so it is the time of night: the moon rises on a fresh window and sets at 100%.
export function paintLand(skin: Skin, s: SceneState): Int32Array {
  const w = widthOf(skin, s), h = SEA_H
  const px = new Int32Array(w * h).fill(AIR)
  const put = (x: number, y: number, c: number) => {
    if (x >= 0 && x < w && y >= 0 && y < h) px[y * w + x] = c
  }
  const day = Math.max(0, Math.min(100, s.sun ?? 0)) / 100
  const dusk = day * day

  for (let y = 0; y < GROUND; y++) {
    const haze = Math.max(0, (y - (GROUND - 6)) / 6)
    const c = mix(mix(L.skyDay, L.skyDusk, dusk), mix(L.haze, L.hazeDusk, dusk), haze)
    for (let x = 0; x < w; x++) put(x, y, c)
  }
  if (day > 0.8) {
    for (const [fx, y] of [[0.08, 1], [0.27, 3], [0.46, 0], [0.71, 2], [0.93, 1]] as const) {
      const x = Math.round(w * fx)
      if ((Math.floor(s.t / 700) + x) % 5) put(x, y, mix(L.skyDusk, L.star, (day - 0.8) * 5))
    }
  }
  const sx = Math.round(2 + day * (w - 5)), sy = Math.round(1 + 7 * (2 * day - 1) ** 2)
  // a crescent moon on the arc, opening to the left; it warms as it sets
  const moon = mix(L.moon, L.moonset, dusk)
  for (const [dx, dy] of [[0, -1], [-1, -1], [1, 0], [0, 0], [1, 1], [0, 1], [0, 2], [-1, 2]] as const) put(sx + dx, sy + dy, moon)
  ;[0, 1].forEach(i => {
    const cx = Math.round(((s.t / (2600 + i * 1700) + i * 0.55) % 1) * (w + 8)) - 6, cy = 2 + i * 2
    const c = mix(L.cloud, L.cloudDusk, dusk)
    for (let k = 1; k < 4; k++) put(cx + k, cy, c)
    for (let k = 0; k < 6; k++) put(cx + k, cy + 1, c)
  })
  for (let x = 0; x < w; x++) for (let y = ridgeTop(x); y < GROUND; y++) put(x, y, L.hill)
  // the ground: smooth, a grass top over dirt
  for (let x = 0; x < w; x++) { const top = floorTop(x); put(x, top, L.grass); for (let y = top + 1; y < h; y++) put(x, y, L.dirt) }
  // uncommitted work: grass tufts and litter; committed, nothing
  if (s.isDirty) PLANTS.forEach((fx, i) => {
    const x0 = Math.round(w * fx), sway = Math.round(Math.sin(s.t / 1100 + i * 2.1) * 0.6), b = floorTop(x0) - 1, b3 = floorTop(x0 + 3) - 1
    put(x0, b, L.grassHi); put(x0 + 1 + sway, b - 1, L.grassHi)
    if (i % 2) { put(x0 + 3, b3, L.grass); put(x0 + 3 + sway, b3 - 1, L.grass) }
  })
  if (s.isDirty) strew(put, w)

  // the creature: a rider skates while it answers; otherwise it stands, the board leaning beside it except at work
  const f = frameAt(skin, s.mode, s.t)
  const { bottom } = inkRows(skin, skin.idle)
  const flip = s.dir > 0
  const board = skin.ride === 'skateboard'
  const riding = board && s.mode === 'responding'
  const ph = (s.t % JUMP_MS) / 600
  const lift = s.mode === 'responding' && ph < 1 ? Math.round(3 * Math.sin(Math.PI * ph)) : 0
  const ox = Math.round(s.x), oy = GROUND - 1 - bottom - lift - (riding ? 2 : 0)
  const colX = (c: number) => ox + (flip ? skin.w - 1 - c : c)
  const feet = feetOf(skin)
  if (riding) {
    const deckY = GROUND - 2 - lift, spin = Math.floor(s.t / 120) % 2
    for (let c = feet.l; c <= feet.r; c++) put(colX(c), deckY, L.deck)
    put(colX(feet.r), deckY - 1, L.deck) // the tail kicks up at the back
    // two-pixel wheels, the maroon hub swapping sides as they roll
    for (const c of [feet.l + 1, feet.r - 2]) { put(colX(c), deckY + 1, spin ? L.deck : L.wheel); put(colX(c + 1), deckY + 1, spin ? L.wheel : L.deck) }
  } else if (board && s.mode !== 'tool-use') {
    // leaned on its tail behind the creature, wheels out
    // in the first column clear of the idle pose, or just past the sprite
    let c = feet.r + 3
    while (c < skin.w && skin.frames.slice(skin.idle * 10, skin.idle * 10 + 10).some(r => r[c] !== '0')) c++
    for (let y = GROUND - 6; y < GROUND; y++) put(colX(c), y, L.deck)
    put(colX(c) + (flip ? -1 : 1), GROUND - 2, L.wheel); put(colX(c) + (flip ? -1 : 1), GROUND - 5, L.wheel)
  }
  const firstRed = 10 - Math.round(s.ctxPct / 10)
  // thinking: a blink every 1.8s, the eyes filled for 180ms
  const shut = s.mode === 'thinking' && s.t % 1800 < 180 ? holesOf(skin, f) : undefined
  for (let r = 0; r < 10; r++) {
    const row = skin.frames[f * 10 + r] ?? ''
    for (let c = 0; c < skin.w; c++) {
      const d = row[c] ?? '0'
      if (d === '0' && !shut?.has(r * skin.w + c)) continue
      const ink = d >= '2' ? skin.inks[Number(d)] : undefined
      put(colX(c), oy + r, ink ?? (r >= firstRed ? skin.gauge : skin.base))
    }
  }
  for (const b of s.bubbles) put(Math.round(b.x), Math.round(b.y), mix(L.dust, L.dirt, ((b.y0 ?? b.y) - b.y) / 3))
  return px
}

// ------------------------------------------------------------- the cells ---

const DEFAULT = 0x01000000
const UPPER = 0x2580 // ▀
const LOWER = 0x2584 // ▄

// Two pixel rows per cell: the top pixel is the foreground of ▀, the bottom its background.
export function toCells(px: Int32Array, w: number, h: number): Uint32Array {
  const rows = Math.ceil(h / 2)
  const out = new Uint32Array(w * rows * 3)
  for (let r = 0; r < rows; r++) for (let x = 0; x < w; x++) {
    const top = px[2 * r * w + x] ?? AIR, bot = 2 * r + 1 < h ? (px[(2 * r + 1) * w + x] ?? AIR) : AIR
    const i = (r * w + x) * 3
    if (top === AIR && bot === AIR) { out[i] = 0x20; out[i + 1] = DEFAULT; out[i + 2] = DEFAULT }
    else if (top === AIR) { out[i] = LOWER; out[i + 1] = bot; out[i + 2] = DEFAULT }
    else { out[i] = UPPER; out[i + 1] = top; out[i + 2] = bot === AIR ? DEFAULT : bot }
  }
  return out
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
export function base64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0, b = bytes[i + 1], c = bytes[i + 2]
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0)
    out += B64.charAt((n >> 18) & 63) + B64.charAt((n >> 12) & 63) + (b === undefined ? '=' : B64.charAt((n >> 6) & 63)) + (c === undefined ? '=' : B64.charAt(n & 63))
  }
  return out
}

export function encodeCells(cells: Uint32Array): string {
  // little-endian u32 triplets, as RasterProps asks
  const bytes = new Uint8Array(cells.length * 4)
  const view = new DataView(bytes.buffer)
  cells.forEach((v, i) => view.setUint32(i * 4, v, true))
  return base64(bytes)
}

// --------------------------------------------------------------- the text ---

export function fmtTokens(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 ? 1 : 0).replace(/\.0$/, '') + 'M'
  if (n >= 1e3) return (n >= 1e4 ? Math.round(n / 1e3) : Math.round(n / 100) / 10) + 'k'
  return String(Math.round(n))
}

export const bar = (pct: number, n = 10) => {
  const k = Math.max(0, Math.min(n, Math.round((pct / 100) * n)))
  return '▰'.repeat(k) + '▱'.repeat(n - k)
}

export const useColor = (p: number) => (p >= 90 ? '#ff3b30' : p >= 80 ? '#e8672e' : p >= 50 ? '#e3a63f' : '#34c759')
export const ctxColor = (p: number) => (p >= 80 ? '#ff3b30' : p >= 50 ? '#e3a63f' : '#7b8591')

export function windowLabel(kind: string) {
  if (kind === 'five_hour') return '5h'
  if (kind === 'seven_day') return 'week'
  const rest = kind.replace(/^seven_day_/, '').replace(/_/g, ' ')
  return rest.charAt(0).toUpperCase() + rest.slice(1)
}

export function until(fromMs: number, toMs: number) {
  let m = Math.max(0, Math.round((toMs - fromMs) / 60000))
  const d = Math.floor(m / 1440); m -= d * 1440
  const h = Math.floor(m / 60); m -= h * 60
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad2 = (n: number) => String(n).padStart(2, '0')
// Local time: under a day away, the clock; further, the day too.
export function resetAt(nowMs: number, iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return undefined
  const clock = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  return d.getTime() - nowMs < 864e5 ? clock : `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${clock}`
}

export const WORDS: Record<Mode, string[]> = {
  idle: [],
  thinking: ['Diving', 'Sounding', 'Drifting'],
  'tool-use': ['Breaching', 'Lunge-feeding', 'Fluking'],
  responding: ['Surfacing', 'Spouting'],
}

// For a creature that walks: no diving, no breaching.
export const LAND_WORDS: Record<Mode, string[]> = {
  idle: [],
  thinking: ['Pondering', 'Musing', 'Scheming'],
  'tool-use': ['Conjuring', 'Tinkering', 'Scurrying'],
  responding: ['Skating', 'Kickflipping', 'Rolling'],
}

export function modeFromSpinner(m: string): Mode {
  if (m === 'tool-use' || m === 'tool-input') return 'tool-use'
  if (m === 'responding') return 'responding'
  return 'thinking'
}

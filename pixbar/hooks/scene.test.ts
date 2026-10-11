import { describe, expect, test } from 'claude-code/testing'

import {
  SEA_H, SURF, WHALE, encodeCells, fmtTokens, frameAt, levelFor, mouthOf, paintScene, parseSkin, seaWidth, stepBubbles, stepSwim, toCells, windowLabel,
} from './scene'
import type { SceneState } from './scene'

const scene = (over: Partial<SceneState> = {}): SceneState => ({
  t: 0, mode: 'idle', ctxPct: 0, level: levelFor(WHALE, 0), isDirty: false, x: 20, dir: -1, bubbles: [], ...over,
})

// Where the whale's ink landed: the topmost and bottommost rows holding the body colour.
function inkRows(px: Int32Array, w: number, colours: number[]) {
  const rows: number[] = []
  for (let y = 0; y < SEA_H; y++) for (let x = 0; x < w; x++) if (colours.includes(px[y * w + x] ?? -1)) rows.push(y)
  return { top: Math.min(...rows), bottom: Math.max(...rows) }
}

describe('height follows the five-hour window', () => {
  test('100% puts the head at the surface', async () => {
    const w = seaWidth(WHALE)
    const px = paintScene(WHALE, scene({ level: levelFor(WHALE, 100) }))
    // the snout column (x=20, drawn head-left): the flukes may rise above it, the head may not
    let head = -1
    for (let y = SEA_H - 1; y >= 0; y--) if ([WHALE.base, WHALE.gauge].includes(px[y * w + 20] ?? -1)) head = y
    expect(head).toBe(SURF + 1)
  })

  test('0% rests the belly on the sand, not in it', async () => {
    const w = seaWidth(WHALE)
    const px = paintScene(WHALE, scene({ level: levelFor(WHALE, 0) }))
    const body = inkRows(px, w, [WHALE.base, WHALE.gauge])
    expect(body.bottom).toBe(SEA_H - 2) // on the floor's one row
  })
})

describe('colour follows context', () => {
  test('0% is all base, 100% is all gauge', async () => {
    const w = seaWidth(WHALE)
    const count = (px: Int32Array, c: number) => px.filter(v => v === c).length
    expect(count(paintScene(WHALE, scene({ ctxPct: 0 })), WHALE.gauge)).toBe(0)
    expect(count(paintScene(WHALE, scene({ ctxPct: 100 })), WHALE.base)).toBe(0)
    expect(w).toBeGreaterThan(WHALE.w)
  })
})

test('uncommitted work puts plants and litter on the floor; committed, it is clean; nothing changes colour', async () => {
  const JUNK = [0xd9d2c0, 0x9aa3ad, 0x6b737c, 0x8a5a2b, 0xb07a3e]
  const PLANT = [0x2e6b57, 0x3f8a70, 0x56a862, 0x3f8a4f] // seagrass, and the tufts' greens
  const land = { ...WHALE, habitat: 'land' as const }
  const count = (px: Int32Array, cs: number[]) => px.filter(v => cs.includes(v)).length
  for (const skin of [WHALE, land]) {
    const clean = paintScene(skin, scene({ x: 30 })), dirty = paintScene(skin, scene({ x: 30, isDirty: true }))
    expect(count(clean, JUNK)).toBe(0) // committed: a clean floor
    expect(count(dirty, JUNK)).toBe(8) // a sheet, a can, a bottle: on the floor, never in it
    // a pixel only changes where litter or a plant lands: floor and creature keep their colours
    let changed = 0
    for (let i = 0; i < clean.length; i++) if (clean[i] !== dirty[i] && !JUNK.includes(dirty[i] ?? -1) && !PLANT.includes(dirty[i] ?? -1)) changed++
    expect(changed).toBe(0)
  }
  expect(count(paintScene(WHALE, scene({ x: 30 })), [0x2e6b57, 0x3f8a70])).toBe(0) // committed: no seagrass
  expect(count(paintScene(WHALE, scene({ x: 30, isDirty: true })), [0x2e6b57, 0x3f8a70])).toBeGreaterThan(0)
})

test('the floor is smooth and sits at the same height in both scenes', async () => {
  const land = { ...WHALE, habitat: 'land' as const }
  const w = seaWidth(WHALE), sea = paintScene(WHALE, scene({ x: 30 })), ground = paintScene(land, scene({ x: 30 }))
  const tops = (px: Int32Array, edge: number) => Array.from({ length: 28 }, (_, x) => { let y = 0; while (y < SEA_H && px[y * w + x] !== edge) y++; return y })
  const seaTops = tops(sea, 0x52483a), landTops = tops(ground, 0x3f8a4f)
  expect(seaTops).toEqual(landTops)
  expect(new Set(seaTops)).toEqual(new Set([SEA_H - 1])) // flat: the bottom row, all the way across
})

test('the whale swims and turns at the walls', async () => {
  const s = scene({ mode: 'tool-use', x: 4, dir: -1 })
  stepSwim(WHALE, s, 1000)
  expect(s.dir).toBe(1)
  const idle = scene({ x: 10 })
  stepSwim(WHALE, idle, 1000)
  expect(idle.x).toBe(10)
})

test('cells encode as base64 of u32 triplets', async () => {
  const w = seaWidth(WHALE)
  const cells = toCells(paintScene(WHALE, scene()), w, SEA_H)
  expect(cells.length).toBe(w * (SEA_H / 2) * 3)
  expect(encodeCells(cells).length).toBe(Math.ceil((cells.length * 4) / 3) * 4)
})

test('the shipped whaleagent skin parses to the built-in whale', async () => {
  const src = [
    'SKIN_NAME="whaleagent"', 'NFRAMES=4', 'W=15', "SKIN_BASE='247;147;26'", "SKIN_GAUGE='216;105;94'",
    "SKIN_CREAM='250;249;245'", 'IDLE_FRAME=4', 'FAST_A=1; FAST_B=0',
    'DIRTY=(', WHALE.dirty.map(r => `"${r}"`).join(' '), ')',
    'FRAMES=(', '  # 0 - tail down', WHALE.frames.map(r => `"${r}"`).join(' '), ')',
  ].join('\n')
  const skin = parseSkin(src)
  expect(skin?.frames).toEqual(WHALE.frames)
  expect(skin?.dirty).toEqual(WHALE.dirty)
  expect(skin?.base).toBe(WHALE.base)
  expect(parseSkin('W=15\nNFRAMES=4\nFRAMES=(\n"1"\n)')).toBeUndefined()
})

test('labels and token counts', async () => {
  expect(fmtTokens(90_000)).toBe('90k')
  expect(fmtTokens(4_200)).toBe('4.2k')
  expect(fmtTokens(1_000_000)).toBe('1M')
  expect(windowLabel('five_hour')).toBe('5h')
  expect(windowLabel('seven_day')).toBe('week')
  expect(windowLabel('seven_day_fable')).toBe('Fable')
})

test('nothing in the tank is transparent', async () => {
  for (const mode of ['idle', 'thinking', 'tool-use', 'responding'] as const) {
    const px = paintScene(WHALE, scene({ mode, t: 700, level: levelFor(WHALE, 100) }))
    expect(px.every(v => v !== -1)).toBe(true)
  }
})

describe('land', () => {
  const land = { ...WHALE, habitat: 'land' as const, ride: 'skateboard' as const }

  test('HABITAT=land in a skin file puts it on land; unset is left for the shipped skin to fill', () => {
    const src = (h: string) => [
      'SKIN_NAME="walker"', 'W=15', 'NFRAMES=4', h,
      'FRAMES=(', ...WHALE.frames.map(r => `"${r}"`), ')',
    ].join('\n')
    expect(parseSkin(src("HABITAT='land'"))?.habitat).toBe('land')
    expect(parseSkin(src("HABITAT='sea'"))?.habitat).toBe('sea')
    expect(parseSkin(src("HABITAT='moon'"))?.habitat).toBeUndefined()
    expect(parseSkin(src(''))?.habitat).toBeUndefined()
    expect(paintScene({ ...WHALE, habitat: 'sea' }, { t: 0, mode: 'idle', ctxPct: 0, level: 5, isDirty: false, x: 10, dir: -1, bubbles: [] }))
      .toEqual(paintScene(WHALE, { t: 0, mode: 'idle', ctxPct: 0, level: 5, isDirty: false, x: 10, dir: -1, bubbles: [] }))
  })

  test('every pixel is painted, in every mode and at every hour', () => {
    for (const mode of ['idle', 'thinking', 'tool-use', 'responding'] as const) {
      for (const sun of [0, 50, 100]) {
        const s = scene({ mode, sun, t: 1500 })
        s.bubbles.push(mouthOf(land, s))
        expect(paintScene(land, s).includes(-1)).toBe(false)
      }
    }
  })

  test('every creature gets the same width, so two side by side are one size', () => {
    expect(seaWidth(WHALE)).toBe(seaWidth({ ...WHALE, w: 21 }))
  })

  test('the wand is for work: thinking and answering show no ink', () => {
    // frames 1-3 carry ink, frame 0 and idle do not
    const inked = { ...land, inks: [undefined, undefined, undefined, 0x39ff7a], frames: WHALE.frames.map((r, i) => (i >= 10 && i < 40 && i % 10 === 5 ? r.replace(/1/, '3') : r)) }
    for (let t = 0; t < 6000; t += 100) {
      for (const mode of ['thinking', 'responding'] as const) expect([0, inked.idle]).toContain(frameAt(inked, mode, t))
    }
    expect(new Set(Array.from({ length: 8 }, (_, k) => frameAt(inked, 'tool-use', k * 150))).size).toBe(4)
  })

  test('it skates while it answers, walks without the board at work, and leans it beside itself at rest', () => {
    const DECK = 0x8c3150
    // deck pixels per row: riding, one long row (plus a kicked tail and the wheel hubs); parked, a column
    const rows = (mode: 'idle' | 'tool-use' | 'thinking' | 'responding') => {
      const px = paintScene(land, scene({ mode, t: 0 })), w = seaWidth(land), n = new Map<number, number>()
      for (let i = 0; i < px.length; i++) if (px[i] === DECK) n.set(Math.floor(i / w), (n.get(Math.floor(i / w)) ?? 0) + 1)
      return [...n.values()]
    }
    expect(Math.max(...rows('responding'))).toBeGreaterThanOrEqual(6) // the whale-shaped test skin has narrow feet
    expect(rows('tool-use').length).toBe(0)
    for (const mode of ['idle', 'thinking'] as const) {
      expect(Math.max(...rows(mode))).toBe(1) // on its tail, upright
      expect(rows(mode).length).toBe(6)
    }
  })

  test('thinking and working stand still, thinking blinks; answering jumps', () => {
    for (const mode of ['thinking', 'tool-use'] as const) {
      const s = scene({ mode, x: 20 })
      stepSwim(land, s, 1000)
      expect(s.x).toBe(20) // stays put to think and to work
    }
    // the whale-shaped skin's eye is a hole at row 4 of its idle pose: open, then shut
    const at = (t: number) => paintScene(land, scene({ mode: 'thinking', t }))
    expect(at(100).filter(v => v === land.base).length).toBe(at(900).filter(v => v === land.base).length + 1)
    const top = (t: number) => {
      const px = paintScene(land, scene({ mode: 'responding', t })), w = seaWidth(land)
      for (let i = 0; i < px.length; i++) if (px[i] === land.base) return Math.floor(i / w)
      return -1
    }
    expect(top(0) - top(300)).toBe(3) // the top of the jump
    expect(top(1000)).toBe(top(0)) // landed
  })

  test('a land creature without RIDE never shows a board', () => {
    const walker = { ...land, ride: undefined }
    for (const mode of ['idle', 'thinking', 'tool-use', 'responding'] as const)
      expect(paintScene(walker, scene({ mode })).includes(0x8c3150)).toBe(false)
    expect(parseSkin(['W=15', 'NFRAMES=4', "RIDE='skateboard'", 'FRAMES=(', ...WHALE.frames.map(r => `"${r}"`), ')'].join('\n'))?.ride).toBe('skateboard')
  })

  test('dust rises a little from the heels and settles', () => {
    const s = scene({ mode: 'tool-use' })
    s.bubbles.push(mouthOf(land, s))
    stepBubbles(s, 300)
    expect(s.bubbles.length).toBe(1)
    stepBubbles(s, 1500)
    expect(s.bubbles.length).toBe(0)
  })
})


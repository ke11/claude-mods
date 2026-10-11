import type { Elements, Register } from 'claude-code'

import {
  WHALE, LAND_WORDS, WORDS, SEA_H, bar, ctxColor, encodeCells, fmtTokens, levelFor, modeFromSpinner, mouthOf,
  paintScene, parseSkin, resetAt, seaWidth, stepBubbles, stepSwim, toCells, until, useColor, widthOf, windowLabel,
} from './scene'
import type { Mode, SceneState, Skin } from './scene'

// PixBar: a pixel creature in the band above the prompt, or in a pane of its own.
//   context used      → its colour, filling from the belly up
//   five-hour window  → in the sea, how high it swims; on land, the time of day
//   uncommitted work  → plants and litter on the floor; committed, the floor is clean
//   turn state        → how it moves: parked when idle, slow in thought,
//                       fast at work, a spout or a speech bubble while responding
//
// Creatures: the whale (built in), the ones this mod ships in skins/, and any the
// person has under ~/.claude/pixbar/skins/. `/pixbar <name>` switches and remembers.

const TICK = 100 // ms per frame: 10 fps
const GIT_EVERY = 5000
const BREAKDOWN_EVERY = 15000
const SAFE_NAME = /^[A-Za-z0-9._-]+$/
const PANE = 'whale' // the pane's request id; its title is the creature's name
const WHALE_NAMES = ['whale', 'whaleagent']

type Placement = 'band' | 'pane'

type Win = { kind: string; pct: number; resetsAt?: string }
type Cat = { name: string; tokens: number; color: string; kind: string }

export const register: Register = (on, options) => {
  // `placement` in /config picks the default; /pixbar band|pane switches for the session
  let placement: Placement = options.placement === 'pane' ? 'pane' : 'band'
  let skin: Skin = WHALE
  // the band's scene leads; the pane's copies its state and swims in its own width
  const scene: SceneState = { t: 0, mode: 'idle', ctxPct: 0, level: levelFor(WHALE, 0), isDirty: false, x: 20, dir: -1, bubbles: [] }
  const paneScene: SceneState = { ...scene, x: 20, bubbles: [], w: 60 }
  let fivePct = 0
  let ctx = { tokens: 0, window: 0, pct: 0 }
  let windows: Win[] = []
  let cats: Cat[] = []
  let breakdown = { total: 0, max: 0 }
  let lastBreakdown = 0
  let branch = ''
  let model = ''
  let dir = ''
  let bandId: string | undefined
  let wordIx = 0
  let isBreakdownShown = true
  let textKey = ''
  // set up in session.start, where `$` and HOME are known; the other hooks call them
  let applyUsage: (context: { tokens?: number; window: number; percent?: number }, limits: { kind: string; percentUsed: number; resetsAt?: string }[]) => void = () => undefined
  let refreshBreakdown: () => Promise<void> = async () => undefined

  // Context against the session's own limit: the compaction window the breakdown reports
  // (what /context measures against), else the model's window. Tokens fall back to the
  // breakdown's total before the first response reports a live count.
  const ctxNow = () => {
    const window = breakdown.max > 0 ? breakdown.max : ctx.window
    const tokens = ctx.tokens > 0 ? ctx.tokens : breakdown.total
    const pct = window > 0 ? Math.min(100, Math.round((tokens / window) * 100)) : ctx.pct
    return { tokens, window, pct }
  }

  const cellsOf = (s: SceneState) => encodeCells(toCells(paintScene(skin, s), widthOf(skin, s), SEA_H))
  const syncPane = () => {
    paneScene.t = scene.t
    paneScene.mode = scene.mode
    paneScene.ctxPct = scene.ctxPct
    paneScene.level = scene.level
    paneScene.sun = scene.sun
    paneScene.isDirty = scene.isDirty
  }

  // Set up in session.start, where `$` is known: where creatures live, and how to find one.
  let home = ''
  let root = ''
  const userDirs = () => [`${home}/.claude/pixbar`, `${home}/.claude/pixerbar`] // pixerbar: before the rename
  const loadSkin = async (read: (path: string) => Promise<string>, name: string): Promise<Skin | undefined> => {
    if (WHALE_NAMES.includes(name)) return WHALE
    if (!SAFE_NAME.test(name)) return undefined
    const parseAt = async (dir: string) => {
      try {
        return parseSkin(await read(`${dir}/${name}.sh`))
      } catch {
        return undefined // not in this folder
      }
    }
    // your own skins first, then the shipped ones, then pixerbar-era copies: an old
    // export must never stand in for a shipped creature (a 1 Sep clawd gave it a purple eye)
    for (const dir of [`${home}/.claude/pixbar/skins`, `${root}/skins`, `${home}/.claude/pixerbar/skins`]) {
      const parsed = await parseAt(dir)
      if (!parsed) continue
      // a pixerbar-era copy has no HABITAT: clawd would swim. The shipped skin knows.
      if (!parsed.habitat) {
        const shipped = await parseAt(`${root}/skins`)
        parsed.habitat = shipped?.habitat
        parsed.ride ??= shipped?.ride
      }
      return parsed
    }
    return undefined
  }
  const useSkin = (next: Skin) => {
    skin = next
    for (const s of [scene, paneScene]) {
      s.level = levelFor(skin, fivePct)
      s.x = Math.min(s.x, widthOf(skin, s) - skin.w - 3)
      s.bubbles = []
    }
  }
  const nameOf = (s: Skin) => (s === WHALE ? 'whale' : s.name)

  on('session.start', async ($, e, next) => {
    home = (await $.env.get('HOME')) ?? ''
    root = $.plugin.root
    const read = (path: string) => $.fs.read(path)

    // The creature last chosen with /pixbar, or installed as a skin; the whale otherwise.
    for (const dir of userDirs()) {
      try {
        const found = await loadSkin(read, (await $.fs.read(`${dir}/active`)).trim())
        if (found) { useSkin(found); break }
      } catch {
        // nothing chosen here: try the next folder, then keep the whale
      }
    }
    scene.level = levelFor(skin, fivePct)

    await $.command.register({ name: 'pixbar', description: 'Pick a theme or a layout: /pixbar theme whale|clawd, /pixbar layout band|pane' })
    if (placement === 'pane') void $.ui.open({ id: PANE, title: nameOf(skin) })

    // Re-checks the text beside the whale; redraws only when a visible value changed.
    const refreshText = () => {
      const now = Date.now()
      const key = JSON.stringify([dir, branch, scene.isDirty, model, ctx, windows.map(w => [w.pct, w.resetsAt && until(now, Date.parse(w.resetsAt))]), cats, breakdown, isBreakdownShown])
      if (key !== textKey) {
        textKey = key
        $.ui.invalidate('ui.render')
      }
    }

    const refreshGit = async () => {
      try {
        const cwd = await $.session.cwd()
        const home2 = home && cwd.startsWith(home) ? '~' + cwd.slice(home.length) : cwd
        dir = home2
        model = await $.session.model()
        const r = await $.process.run(['git', 'status', '--porcelain=v1', '-b'], { cwd, timeoutMs: 3000 })
        if (r.exitCode !== 0) {
          branch = ''
          scene.isDirty = false
        } else {
          const [head = '', ...rest] = r.stdout.split('\n')
          branch = head.replace(/^## /, '').replace(/\.\.\..*$/, '').replace(/^No commits yet on /, '')
          scene.isDirty = rest.some(l => l.trim() !== '')
        }
      } catch {
        branch = ''
      }
      refreshText()
    }

    refreshBreakdown = async () => {
      try {
        const u = await $.session.usage({ breakdown: 'summary' })
        const b = u.context.breakdown
        if (b) {
          cats = b.categories.filter(c => c.kind !== 'deferred').map(c => ({ name: c.name, tokens: c.tokens, color: c.color, kind: c.kind }))
          breakdown = { total: b.totalTokens, max: b.rawMaxTokens }
          scene.ctxPct = ctxNow().pct
        }
        lastBreakdown = Date.now()
      } catch {
        // no breakdown on this host: the band shows the single ctx row only
      }
      refreshText()
    }

    applyUsage = (context, limits) => {
      ctx = { tokens: context.tokens ?? 0, window: context.window, pct: context.percent ?? 0 }
      scene.ctxPct = ctxNow().pct
      windows = limits.map(l => ({ kind: l.kind, pct: l.percentUsed, resetsAt: l.resetsAt }))
      fivePct = windows.find(w => w.kind === 'five_hour')?.pct ?? 0
      refreshText()
    }

    try {
      const u = await $.session.usage()
      applyUsage(u.context, u.rateLimits)
    } catch {
      // keep the zeros
    }
    void refreshGit()
    void refreshBreakdown()

    // the frame clock
    let sinceGit = 0
    let sinceText = 0
    $.clock.every(TICK, () => {
      scene.t += TICK
      const target = levelFor(skin, fivePct)
      scene.level += (target - scene.level) * Math.min(1, TICK / 350)
      scene.sun = (scene.sun ?? fivePct) + (fivePct - (scene.sun ?? fivePct)) * Math.min(1, TICK / 350)
      if (scene.mode === 'tool-use' && Math.random() < TICK / 700) scene.bubbles.push(mouthOf(skin, scene))
      stepSwim(skin, scene, TICK)
      stepBubbles(scene, TICK)
      if (placement === 'pane') {
        syncPane()
        if (scene.mode === 'tool-use' && Math.random() < TICK / 700) paneScene.bubbles.push(mouthOf(skin, paneScene))
        stepSwim(skin, paneScene, TICK)
        stepBubbles(paneScene, TICK)
      }
      sinceGit += TICK
      sinceText += TICK
      if (sinceGit >= GIT_EVERY) { sinceGit = 0; void refreshGit() }
      if (sinceText >= 30000) { sinceText = 0; refreshText() } // the reset countdowns
      if (placement === 'band' && bandId) void $.ui.blit({ requestId: bandId, key: 'sea', cells: cellsOf(scene) }).catch(() => undefined)
      if (placement === 'pane') void $.ui.blit({ requestId: PANE, key: 'sea', cells: cellsOf(paneScene) }).catch(() => undefined)
    })

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    applyUsage(e.context, e.rateLimits)
    if (e.changed.includes('context') && Date.now() - lastBreakdown > BREAKDOWN_EVERY) void refreshBreakdown()
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    scene.mode = 'idle'
    void refreshBreakdown()
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    scene.mode = 'thinking'
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    try {
      for (const s of [scene, paneScene]) {
        const m = mouthOf(skin, s)
        if (m.y0 !== undefined) s.bubbles.push({ ...m }, { ...m, x: m.x - s.dir })
        else s.bubbles.push({ x: m.x, y: m.y }, { x: m.x, y: m.y + 2 }, { x: m.x, y: m.y + 4 })
      }
    } catch {
      // a bubble is never worth blocking a tool
    }
    return next(e)
  })

  // Every creature this person can pick: the whale, the ones shipped here, their own.
  const creatures = async (list: (path: string) => Promise<{ name: string }[]>) => {
    const names = new Set(['whale'])
    for (const dir of [`${root}/skins`, ...userDirs().map(d => `${d}/skins`)]) {
      const entries = await list(dir).catch(() => [])
      for (const f of entries) if (f.name.endsWith('.sh')) names.add(f.name.slice(0, -3))
    }
    return [...names]
  }

  // /pixbar theme <name> picks the creature; /pixbar layout <band|pane> moves it. A bare
  // creature or layout word still works as a shortcut, and anything else gets the menu.
  const LAYOUTS = ['band', 'pane'] as const
  const pick = (names: readonly string[], current: string) =>
    names.map(n => `${n === current ? '●' : '○'} ${n}`.padEnd(10, ' ')).join(' ')

  on('command.run', { command: 'pixbar' }, async ($, e) => {
    const [first = '', second = '', ...rest] = e.args.trim().toLowerCase().split(/\s+/)
    const themes = await creatures(path => $.fs.list(path))
    const theme = nameOf(skin)

    const menu = () => [
      `PixBar · ${theme} · ${placement}`,
      '',
      `theme    ${pick(themes, theme)}  /pixbar theme ${themes.find(t => t !== theme) ?? theme}`,
      `layout   ${pick(LAYOUTS, placement)}  /pixbar layout ${placement === 'band' ? 'pane' : 'band'}`,
      'c        show or hide the context window',
    ].join('\n')

    const setLayout = async (to: 'band' | 'pane') => {
      placement = to
      if (to === 'pane') {
        const opened = await $.ui.open({ id: PANE, title: theme })
        $.ui.invalidate('ui.render')
        return { text: opened.isPlaced
          ? '✓ Layout: pane, beside the transcript (this session). To keep it: placement in /config.'
          : '✓ Layout: pane. It opens once the terminal is wide enough (144 columns).' }
      }
      await $.ui.close({ id: PANE }).catch(() => undefined)
      $.ui.invalidate('ui.render')
      return { text: '✓ Layout: band, above the prompt.' }
    }

    const setTheme = async (name: string) => {
      const found = await loadSkin(path => $.fs.read(path), name)
      if (!found) return { text: `✗ No theme called ${name}. Themes: ${themes.join(', ')}.\n  Try /pixbar theme ${themes.find(t => t !== theme) ?? theme}` }
      useSkin(found)
      // remembered where installed skins mark theirs, so the next session starts with it
      await $.fs.write(`${home}/.claude/pixbar/active`, `${name}\n`).catch(() => undefined)
      $.ui.invalidate('ui.render')
      return { text: `✓ Theme: ${nameOf(found)}. Kept for your next session.` }
    }

    if (rest.length > 0) return { text: `✗ Too many words. ${first === 'layout' ? 'Try /pixbar layout pane' : 'Try /pixbar theme clawd'}\n\n${menu()}` }
    if (first === '') return { text: menu() }
    if (first === 'theme') return second === '' ? { text: `Theme: ${theme}. Themes: ${themes.join(', ')}.\n  /pixbar theme <name> picks one.` } : setTheme(second)
    if (first === 'layout') {
      if (second === '') return { text: `Layout: ${placement}. /pixbar layout band or /pixbar layout pane.` }
      return second === 'band' || second === 'pane' ? setLayout(second) : { text: `✗ No layout called ${second}. Layouts: band, pane.\n  Try /pixbar layout ${placement === 'band' ? 'pane' : 'band'}` }
    }
    // shortcuts: /pixbar pane, /pixbar clawd
    if (second === '' && (first === 'band' || first === 'pane')) return setLayout(first)
    if (second === '' && themes.includes(first)) return setTheme(first)
    return { text: `✗ Not a command: /pixbar ${e.args.trim()}\n\n${menu()}` }
  })

  // Closing the pane by hand sends the whale back to the band rather than losing it.
  on('ui.close', async ($, e, next) => {
    if (e.id === PANE && e.origin.kind === 'person') {
      placement = 'band'
      $.ui.invalidate('ui.render')
    }
    return next(e)
  })

  // The spinner names what the whale is doing, and tells the band the turn's state.
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    const mode: Mode = modeFromSpinner(e.props.mode)
    if (mode !== scene.mode) {
      scene.mode = mode
      wordIx += 1
    }
    if (e.props.message !== null) return next(e)
    const words = (skin.habitat === 'land' ? LAND_WORDS : WORDS)[mode]
    const word = words[wordIx % words.length]
    return word ? next({ ...e, props: { ...e.props, word } }) : next(e)
  })

  // One drawing for both homes. The band puts the tank left and the text right;
  // the pane stacks them, the tank as wide as the pane.
  const view = (els: Elements['terminal'], onToggle: () => void, cols: number, seaW: number, cellsStr: string, isPane: boolean) => {
    const { Box, Text, Raster, Button } = els
    const now = Date.now()
    const dim = '#7b8591'
    const live = ctxNow()

    const row = (key: string, label: string, pct: number, color: string, tail: [string, string?][]) => (
      <Box key={key} flexDirection="row">
        <Text color={dim}>{label.padEnd(6, ' ')}</Text>
        <Text color={color}>{bar(pct)}</Text>
        <Text color={color}>{' ' + String(Math.round(pct)).padStart(3, ' ') + '%'}</Text>
        {tail.map(([t, c]) => <Text color={c ?? dim}>{t}</Text>)}
      </Box>
    )

    const stats = (
      <Box flexDirection="column">
        <Box flexDirection="row">
          <Text color="#6aa6ff">{dir}</Text>
          {branch !== '' && <Text color="#e3a63f">{' ' + branch}</Text>}
          {branch !== '' && <Text color={scene.isDirty ? '#ff3b30' : '#34c759'}>{scene.isDirty ? ' ✘' : ' ✔'}</Text>}
          <Text color={dim}>{' ' + model}</Text>
        </Box>
        {row('ctx', 'ctx', live.pct, ctxColor(live.pct), [
          ['   '],
          [`${fmtTokens(live.tokens)} / ${fmtTokens(live.window)}`, '#d7dbe0'],
        ])}
        {windows.length === 0 && <Text color={dim}>5h    no rate-limit windows reported</Text>}
        {windows.map(w => {
          const at = w.resetsAt ? resetAt(now, w.resetsAt) : undefined
          // the reset, roomy and plain: when, then how long
          const tail: [string, string?][] = at ? [['   '], [at, '#d7dbe0'], [` · in ${until(now, Date.parse(w.resetsAt!))}`]] : []
          return row(w.kind, windowLabel(w.kind), w.pct, useColor(w.pct), tail)
        })}
      </Box>
    )

    // Layout: the tank on the left, everything else in one column on the right that
    // takes the rest of the width. Below ~50 spare columns the column drops under the tank.
    const GAP = 2
    const isWide = !isPane && cols - seaW - GAP >= 50
    const rightW = isWide ? cols - seaW - GAP : cols

    // the full context window, as /context breaks it down, sized to the right column
    const used = cats.filter(c => c.kind !== 'free' && c.tokens > 0)
    const free = cats.find(c => c.kind === 'free')
    const max = Math.max(1, breakdown.max)
    const barW = Math.max(10, rightW)
    const segs = used.map(c => ({ c, n: Math.max(1, Math.round((c.tokens / max) * barW)) }))
    const freeN = Math.max(0, barW - segs.reduce((a, s) => a + s.n, 0))

    // the legend: a grid of equal columns, name and tokens only, each name cut to fit so no entry wraps
    type Item = { key: string; color: string; name: string; tokens: string; pct: string; isFree: boolean }
    const items: Item[] = used.map(c => ({ key: c.name, color: c.color, name: c.name, tokens: fmtTokens(c.tokens), pct: '', isFree: false }))
    if (free) items.push({ key: 'free', color: dim, name: 'free', tokens: fmtTokens(free.tokens), pct: '', isFree: true })
    const ncol = rightW >= 84 ? 3 : 2
    const colW = Math.floor(rightW / ncol)
    const fit = (it: Item) => {
      const room = colW - 2 - (1 + it.tokens.length) - (it.pct ? 1 + it.pct.length : 0) - 2
      return it.name.length <= room ? it.name : it.name.slice(0, Math.max(1, room - 1)) + '…'
    }
    const gridRows: Item[][] = []
    for (let i = 0; i < items.length; i += ncol) gridRows.push(items.slice(i, i + ncol))

    const contextBlock = cats.length > 0 && (
      <Box flexDirection="column" marginTop={isWide ? 0 : 1} width={rightW}>
        <Box flexDirection="row" justifyContent="space-between" width={rightW}>
          <Box flexDirection="row">
            <Text color="claude">◆ </Text>
            <Text bold>context window   </Text>
            <Text bold>{fmtTokens(breakdown.total)}</Text>
            <Text color={dim}>{` / ${fmtTokens(breakdown.max)}`}</Text>
          </Box>
          <Button
            key="toggle-context"
            plain
            hotkey="c"
            label={isBreakdownShown ? 'hide' : 'show'}
            onPress={onToggle}
          />
        </Box>
        {isBreakdownShown && (
          <Box flexDirection="row">
            {segs.map(s => <Text color={s.c.color}>{'█'.repeat(s.n)}</Text>)}
            <Text color={dim}>{'░'.repeat(freeN)}</Text>
          </Box>
        )}
        {isBreakdownShown && gridRows.map((r, i) => (
          <Box key={`legend-${i}`} flexDirection="row">
            {r.map(it => (
              <Box key={it.key} width={colW} flexDirection="row">
                <Text color={it.color}>■ </Text>
                <Text color={it.isFree ? dim : undefined}>{fit(it) + ' '}</Text>
                <Text bold>{it.tokens}</Text>
                {it.pct !== '' && <Text color={dim}>{' ' + it.pct}</Text>}
              </Box>
            ))}
          </Box>
        ))}
      </Box>
    )

    return (
      <Box flexDirection={isWide ? 'row' : 'column'} gap={GAP} alignItems="flex-start">
        <Raster key="sea" columns={seaW} rows={SEA_H / 2} cells={cellsStr} />
        {/* beside the tank, the column is the tank's height: stats flush with its top,
            the context window flush with its bottom */}
        <Box flexDirection="column" width={rightW} minHeight={isWide ? SEA_H / 2 : undefined} justifyContent={isWide ? 'space-between' : 'flex-start'}>
          {stats}
          {contextBlock}
        </Box>
      </Box>
    )
  }

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (placement !== 'band' || e.props.hasSurvey || e.surface !== 'terminal') return next(e)
    bandId = e.requestId
    return view($.ui.resolve(e), () => {
      isBreakdownShown = !isBreakdownShown
      $.ui.invalidate('ui.render')
    }, e.props.bodyColumns, seaWidth(skin), cellsOf(scene), false)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)
    const cols = Math.max(skin.w + 12, e.props.bodyColumns)
    paneScene.w = cols
    syncPane()
    return view($.ui.resolve(e), () => {
      isBreakdownShown = !isBreakdownShown
      $.ui.invalidate('ui.render')
    }, cols, cols, cellsOf(paneScene), true)
  })
}


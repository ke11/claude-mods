import { describe, expect, test } from 'claude-code/testing'
import { startTheme } from './register'

const run = ($: any, args: string) => $.command.run({ plugin: 'pixbar', command: 'pixbar', args })

test('bare /pixbar prints the menu with theme and layout', async $ => {
  const out = await run($, '')
  expect(out.text).toContain('theme')
  expect(out.text).toContain('layout')
  expect(out.text).toContain('/pixbar layout pane')
})

// the test sandbox has no skin files, so the built-in whale is the theme to pick
test('/pixbar theme whale picks the whale and keeps it', async $ => {
  const out = await run($, 'theme whale')
  expect(out.text).toContain('Theme: whale')
  expect(out.text).toContain('next session')
})

test('/pixbar theme with an unknown name lists the themes', async $ => {
  const out = await run($, 'theme shark')
  expect(out.text).toContain('No theme called shark')
})

test('/pixbar layout with an unknown word suggests one', async $ => {
  const out = await run($, 'layout sideways')
  expect(out.text).toContain('Layouts: band, pane')
})

test('shortcuts still work: /pixbar whale, /pixbar band', async $ => {
  expect((await run($, 'whale')).text).toContain('Theme: whale')
  expect((await run($, 'band')).text).toContain('Layout: band')
})

test('nonsense gets the menu back', async $ => {
  const out = await run($, 'shark')
  expect(out.text).toContain('Not a command')
  expect(out.text).toContain('/pixbar theme')
})

describe('theme in /plugin configure against /pixbar theme', () => {
  test('a first install takes the configure pick', () => {
    expect(startTheme('clawd', undefined, undefined)).toEqual({ name: 'clawd', keep: true })
  })
  test('an update keeps the creature picked with /pixbar', () => {
    expect(startTheme('whale', undefined, 'clawd')).toEqual({ name: 'clawd', keep: true })
  })
  test('a changed configure pick wins over an older /pixbar pick', () => {
    expect(startTheme('clawd', 'whale', 'whale')).toEqual({ name: 'clawd', keep: true })
  })
  test('an unchanged configure pick leaves a later /pixbar pick alone, a skin of your own included', () => {
    expect(startTheme('whale', 'whale', 'shark')).toEqual({ name: 'shark', keep: false })
  })
})

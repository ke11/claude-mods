import { expect, test } from 'claude-code/testing'

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

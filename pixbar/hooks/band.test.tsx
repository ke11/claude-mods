import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'pixbar',
  surface: 'terminal',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 30, bodyColumns: 140, scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as const

const PANE = {
  plugin: 'pixbar',
  surface: 'terminal',
  component: 'Pane',
  requestId: 'whale',
  props: { title: 'whale', isFocused: false, bodyColumns: 70, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

test('layout band: the whale draws above the prompt', async $ => {
  const ui = await $.ui.mount(BAND)
  expect(await ui.find({ key: 'sea' })).toBeDefined()
  await ui.unmount()
})

test('layout pane: the pane draws the whale', { options: { layout: 'pane' } }, async $ => {
  const pane = await $.ui.mount(PANE)
  expect(await pane.find({ key: 'sea' })).toBeDefined()
  await pane.unmount()
})

// The shipped skins, as text inside the mod: pixbar/hooks/skins.ts is written from skins/*.sh.
// The skin files sit outside the mod's folder and the mod reads none of its own files while
// it runs, so what was checked is what runs.
//   bun scripts/build-skins.ts           write it
//   bun scripts/build-skins.ts --check   fail when it is out of date
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'

const dir = new URL('../skins/', import.meta.url)
const out = new URL('../pixbar/hooks/skins.ts', import.meta.url)
const names = readdirSync(dir).filter(f => f.endsWith('.sh')).sort()
const rows = names.map(f => {
  const text = readFileSync(new URL(f, dir), 'utf8')
  // kept as written, a row a line, so the file reads as the skin does
  if (/[`\\]|\$\{/.test(text)) throw new Error(`${f}: a backtick, a backslash or \${ cannot go in a skin`)
  return `  ${f.slice(0, -3)}: \`${text}\`,`
})
const text = [
  '// Written by scripts/build-skins.ts from skins/*.sh. Do not edit: change the skin file and run it again.',
  'export const SHIPPED: Record<string, string> = {',
  ...rows,
  '}',
  '',
].join('\n')

if (process.argv.includes('--check')) {
  if (readFileSync(out, 'utf8') !== text) {
    console.error('pixbar/hooks/skins.ts is out of date: run bun scripts/build-skins.ts')
    process.exit(1)
  }
  console.log('pixbar/hooks/skins.ts matches skins/')
} else {
  writeFileSync(out, text)
  console.log(`wrote ${names.length} skins`)
}

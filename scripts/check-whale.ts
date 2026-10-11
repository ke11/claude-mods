// skins/whale.sh must be the built-in whale (WHALE in pixbar/hooks/scene.ts): same frames,
// fluke and colours. The plugin test sandbox can't read files, so this runs under bun.
//   bun scripts/check-whale.ts
import { readFileSync } from 'node:fs'
import { WHALE, parseSkin } from '../pixbar/hooks/scene'

const parsed = parseSkin(readFileSync(new URL('../pixbar/skins/whale.sh', import.meta.url), 'utf8'))
const problems: string[] = []
if (!parsed) problems.push('skins/whale.sh does not parse')
else {
  for (const key of ['w', 'nframes', 'idle', 'base', 'gauge', 'cream'] as const)
    if (parsed[key] !== WHALE[key]) problems.push(`${key}: file ${parsed[key]}, built-in ${WHALE[key]}`)
  for (const key of ['frames', 'dirty'] as const)
    parsed[key].forEach((row, i) => { if (row !== WHALE[key][i]) problems.push(`${key}[${i}]: file ${row}, built-in ${WHALE[key][i]}`) })
  if (parsed.habitat !== 'sea') problems.push(`habitat: ${parsed.habitat ?? 'unset'}, want sea`)
}
if (problems.length) {
  console.error(`skins/whale.sh and the built-in whale differ:\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log('skins/whale.sh matches the built-in whale')

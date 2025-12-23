import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

const targetDir = path.join(repoRoot, 'public', 'images', 'species')

async function exists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function main() {
  if (!(await exists(targetDir))) {
    // If the directory doesn't exist (fresh repo), don't fail the build.
    return
  }

  const entries = await fs.readdir(targetDir, { withFileTypes: true })

  const offenders = []
  for (const entry of entries) {
    if (!entry.isFile()) continue

    const name = entry.name
    const lower = name.toLowerCase()

    if (name !== lower) {
      offenders.push(name)
    }
  }

  if (offenders.length) {
    offenders.sort((a, b) => a.localeCompare(b))

    const lines = [
      'Asset filename casing check failed.',
      'GitHub Pages is case-sensitive, so image filenames must be lowercase.',
      '',
      `Directory: ${targetDir}`,
      'Offending files:',
      ...offenders.map((x) => `- ${x}`),
      '',
      'Fix: rename these files to all-lowercase (e.g. 01610.png, not 01610.PNG).'
    ]

    throw new Error(lines.join('\n'))
  }
}

main().catch((err) => {
  console.error(err?.message || err)
  process.exitCode = 1
})

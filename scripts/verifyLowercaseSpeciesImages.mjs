import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

const imagesRoot = path.join(repoRoot, 'public', 'images')

async function exists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function main() {
  if (!(await exists(imagesRoot))) {
    // If the directory doesn't exist (fresh repo), don't fail the build.
    return
  }

  const rootEntries = await fs.readdir(imagesRoot, { withFileTypes: true })
  const dirsToScan = rootEntries.filter((e) => e.isDirectory()).map((e) => path.join(imagesRoot, e.name))
  const filesToScan = rootEntries.filter((e) => e.isFile()).map((e) => imagesRoot)

  const scanDirs = Array.from(new Set([...dirsToScan, ...filesToScan]))

  const offenders = []
  for (const dir of scanDirs) {
    if (!(await exists(dir))) continue
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isFile()) continue

      const name = entry.name
      const ext = path.extname(name)
      if (ext && ext !== ext.toLowerCase()) offenders.push({ dir, name })
    }
  }

  if (offenders.length) {
    offenders.sort((a, b) => (a.dir + a.name).localeCompare(b.dir + b.name))

    const lines = [
      'Asset filename casing check failed.',
      'GitHub Pages is case-sensitive, so image filenames must be lowercase.',
      '',
      `Root: ${imagesRoot}`,
      'Offending files:',
      ...offenders.map((x) => `- ${path.relative(repoRoot, path.join(x.dir, x.name))}`),
      '',
      'Fix: rename these files to use lowercase extensions (e.g. 01610.png, not 01610.PNG).'
    ]

    throw new Error(lines.join('\n'))
  }
}

main().catch((err) => {
  console.error(err?.message || err)
  process.exitCode = 1
})

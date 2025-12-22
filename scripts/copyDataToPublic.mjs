import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

const srcDataDir = path.join(repoRoot, 'Data')
const destDataDir = path.join(repoRoot, 'public', 'Data')

const ignoreNames = new Set(['test.json', 'generateStats.ps1'])

async function pathExists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function copyDir(srcDir, destDir) {
  await fs.mkdir(destDir, { recursive: true })
  const entries = await fs.readdir(srcDir, { withFileTypes: true })

  for (const entry of entries) {
    if (ignoreNames.has(entry.name)) continue

    const srcPath = path.join(srcDir, entry.name)
    const destPath = path.join(destDir, entry.name)

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath)
      continue
    }

    // Keep only JSON assets.
    if (!entry.name.toLowerCase().endsWith('.json')) continue

    // Prefer corrected species assets under Data/Species/.
    // Avoid copying stale root Data/SPECIES-*.json to public.
    if (srcDir === srcDataDir && /^SPECIES-.*\.json$/i.test(entry.name)) continue

    await fs.copyFile(srcPath, destPath)
  }
}

async function main() {
  if (!(await pathExists(srcDataDir))) {
    throw new Error(`Missing Data directory: ${srcDataDir}`)
  }

  await fs.rm(destDataDir, { recursive: true, force: true })
  await copyDir(srcDataDir, destDataDir)

  console.log(`Copied Data/ -> public/Data/`) 
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})

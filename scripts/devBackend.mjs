import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = process.cwd()
const backendDir = path.join(repoRoot, 'backend')

const isWindows = process.platform === 'win32'
const pythonExe = isWindows
  ? path.join(repoRoot, '.venv', 'Scripts', 'python.exe')
  : path.join(repoRoot, '.venv', 'bin', 'python')

if (!fs.existsSync(backendDir)) {
  console.error('Backend folder not found:', backendDir)
  process.exit(1)
}

if (!fs.existsSync(pythonExe)) {
  console.error('Python venv executable not found:', pythonExe)
  console.error('Create the venv first (e.g. `python -m venv .venv`).')
  process.exit(1)
}

const env = {
  ...process.env,
  PYTHONPATH: backendDir,
  DATABASE_URL: process.env.DATABASE_URL || 'sqlite:///./bigyear.db',
}

const args = ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000', '--reload']

console.log('Starting backend:', pythonExe)
console.log('cwd:', backendDir)
console.log('DATABASE_URL:', env.DATABASE_URL)

const child = spawn(pythonExe, args, {
  cwd: backendDir,
  env,
  stdio: 'inherit',
})

child.on('exit', (code) => {
  process.exit(code ?? 0)
})

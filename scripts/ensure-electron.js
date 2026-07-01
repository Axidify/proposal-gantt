const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const electronDir = path.join(__dirname, '..', 'node_modules', 'electron')
const frameworkPath = path.join(
  electronDir,
  'dist',
  'Electron.app',
  'Contents',
  'Frameworks',
  'Electron Framework.framework'
)

if (!fs.existsSync(frameworkPath)) {
  execFileSync(process.execPath, [path.join(electronDir, 'install.js')], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  })
}

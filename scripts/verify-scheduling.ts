/**
 * @deprecated Use `npm test` or `npm run verify-scheduling` (Vitest).
 */
import { execSync } from 'node:child_process'

execSync('npm run verify-scheduling', { stdio: 'inherit' })

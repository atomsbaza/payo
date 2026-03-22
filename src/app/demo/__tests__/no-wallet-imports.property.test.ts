import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Feature: demo-flow-revamp, Property 2: Demo pages do not import wallet modules
 *
 * **Validates: Requirements 3.1, 3.4, 5.2**
 *
 * For any source file under src/app/demo/, the file must NOT contain
 * import statements for wallet-related modules:
 * - useSendTransaction (from wagmi)
 * - useWriteContract (from wagmi)
 * - useAccount (from wagmi)
 * - ConnectButton (from @rainbow-me/rainbowkit)
 */

const FORBIDDEN_IMPORTS = [
  'useSendTransaction',
  'useWriteContract',
  'useAccount',
  'ConnectButton',
] as const

/** Recursively collect all .ts and .tsx files under a directory */
function collectSourceFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      // skip __tests__ directories to avoid self-referencing
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue
      results.push(...collectSourceFiles(full))
    } else if (/\.tsx?$/.test(entry.name)) {
      results.push(full)
    }
  }
  return results
}

describe('Property 2: Demo pages do not import wallet modules', () => {
  const demoDir = path.resolve(__dirname, '..')
  const sourceFiles = collectSourceFiles(demoDir)

  it('should find demo source files to test', () => {
    expect(sourceFiles.length).toBeGreaterThan(0)
  })

  for (const filePath of collectSourceFiles(demoDir)) {
    const relative = path.relative(demoDir, filePath)

    for (const forbidden of FORBIDDEN_IMPORTS) {
      it(`${relative} does not import ${forbidden}`, () => {
        const content = fs.readFileSync(filePath, 'utf-8')
        const pattern = new RegExp(`\\b${forbidden}\\b`)
        expect(content).not.toMatch(pattern)
      })
    }
  }
})

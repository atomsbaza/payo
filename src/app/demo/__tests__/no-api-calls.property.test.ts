import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Feature: demo-flow-revamp, Property 3: Demo pages do not call real APIs
 *
 * **Validates: Requirements 5.1, 5.4**
 *
 * For any source file under src/app/demo/, the file must NOT contain
 * fetch calls or string literals referencing real API endpoints:
 * - /api/links
 * - /api/tx
 * - /api/fees
 */

const FORBIDDEN_API_PATHS = ['/api/links', '/api/tx', '/api/fees'] as const

/** Recursively collect all .ts and .tsx files under a directory */
function collectSourceFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue
      results.push(...collectSourceFiles(full))
    } else if (/\.tsx?$/.test(entry.name)) {
      results.push(full)
    }
  }
  return results
}

describe('Property 3: Demo pages do not call real APIs', () => {
  const demoDir = path.resolve(__dirname, '..')
  const sourceFiles = collectSourceFiles(demoDir)

  it('should find demo source files to test', () => {
    expect(sourceFiles.length).toBeGreaterThan(0)
  })

  for (const filePath of collectSourceFiles(demoDir)) {
    const relative = path.relative(demoDir, filePath)

    for (const apiPath of FORBIDDEN_API_PATHS) {
      it(`${relative} does not contain fetch calls to ${apiPath}`, () => {
        const content = fs.readFileSync(filePath, 'utf-8')

        // Check for fetch calls: fetch('/api/...'), fetch("/api/..."), fetch(`/api/...`)
        const fetchPattern = new RegExp(
          `fetch\\s*\\(\\s*['"\`]${apiPath.replace(/\//g, '\\/')}`,
        )
        expect(content).not.toMatch(fetchPattern)
      })

      it(`${relative} does not contain string literals referencing ${apiPath}`, () => {
        const content = fs.readFileSync(filePath, 'utf-8')

        // Check for string literals: '/api/...', "/api/...", `/api/...`
        const stringPattern = new RegExp(
          `['"\`]${apiPath.replace(/\//g, '\\/')}`,
        )
        expect(content).not.toMatch(stringPattern)
      })
    }
  }
})

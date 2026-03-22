import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * Feature: payo-rebrand, Property 4: Brand color tokens ครบถ้วน
 *
 * For any brand color token in {brand-primary, brand-accent, bg-base, bg-surface},
 * the CSS variable defined in globals.css must be a valid hex color code
 * that matches the design spec value.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4
 */

const EXPECTED_TOKENS: Array<{ variable: string; hex: string }> = [
  { variable: '--brand-primary', hex: '#4F46E5' },
  { variable: '--brand-accent', hex: '#10B981' },
  { variable: '--bg-base', hex: '#030712' },
  { variable: '--bg-surface', hex: '#111827' },
]

function parseCssVariables(css: string): Map<string, string> {
  const vars = new Map<string, string>()
  // Match CSS custom property declarations inside :root
  const rootMatch = css.match(/:root\s*\{([^}]+)\}/)
  if (!rootMatch) return vars

  const rootBlock = rootMatch[1]
  const varRegex = /(--[\w-]+)\s*:\s*([^;]+);/g
  let match: RegExpExecArray | null
  while ((match = varRegex.exec(rootBlock)) !== null) {
    vars.set(match[1].trim(), match[2].trim())
  }
  return vars
}

describe('Feature: payo-rebrand, Property 4: Brand color tokens ครบถ้วน', () => {
  const cssPath = resolve(__dirname, '..', 'globals.css')
  const cssContent = readFileSync(cssPath, 'utf-8')
  const cssVars = parseCssVariables(cssContent)

  it('every brand color token exists and matches the design spec hex value', () => {
    fc.assert(
      fc.property(fc.constantFrom(...EXPECTED_TOKENS), ({ variable, hex }) => {
        const actual = cssVars.get(variable)
        expect(actual, `CSS variable ${variable} should be defined in :root`).toBeDefined()
        expect(actual!.toUpperCase()).toBe(hex.toUpperCase())
      }),
      { numRuns: 100 },
    )
  })

  it('all brand color token values are valid hex color codes', () => {
    fc.assert(
      fc.property(fc.constantFrom(...EXPECTED_TOKENS), ({ variable }) => {
        const actual = cssVars.get(variable)
        expect(actual).toBeDefined()
        expect(actual).toMatch(/^#[0-9A-Fa-f]{6}$/)
      }),
      { numRuns: 100 },
    )
  })
})

import { describe, expect, it } from 'vitest'
import * as core from '../src/index.js'

describe('@md/core package surface', () => {
  it('exports a version string', () => {
    expect(typeof core.version).toBe('string')
  })
})

import { describe, it, expect } from 'vitest'
import { parsePrice, normalize } from '../utils.js'

describe('parsePrice', () => {
  it('extracts numeric value from KSh formatted string', () => {
    expect(parsePrice('KSh 150')).toBe(150)
    expect(parsePrice('KSh 1,340,000')).toBe(1340000)
    expect(parsePrice('KSh 1,550,000')).toBe(1550000)
  })

  it('handles plain numbers', () => {
    expect(parsePrice('150')).toBe(150)
    expect(parsePrice('25000')).toBe(25000)
  })

  it('handles strings with no digits', () => {
    expect(parsePrice('')).toBe(0)
    expect(parsePrice(null)).toBe(0)
    expect(parsePrice(undefined)).toBe(0)
    expect(parsePrice('KSh')).toBe(0)
  })

  it('handles edge cases', () => {
    expect(parsePrice('KSh 0')).toBe(0)
    expect(parsePrice('5@')).toBe(5)
  })
})

describe('normalize', () => {
  it('trims and lowercases', () => {
    expect(normalize('  Hello World  ')).toBe('hello world')
    expect(normalize('ELECTRONICS')).toBe('electronics')
  })

  it('handles null/undefined', () => {
    expect(normalize(null)).toBe('')
    expect(normalize(undefined)).toBe('')
  })
})

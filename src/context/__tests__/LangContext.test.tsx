// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { LangProvider, useLang } from '../LangContext'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

function TestConsumer() {
  const { lang, t, toggleLang } = useLang()
  return (
    <div>
      <span data-testid="lang">{lang}</span>
      <span data-testid="label">{t.navHome}</span>
      <button onClick={toggleLang}>toggle</button>
    </div>
  )
}

describe('LangContext', () => {
  beforeEach(() => localStorageMock.clear())

  it('defaults to English', () => {
    render(<LangProvider><TestConsumer /></LangProvider>)
    expect(screen.getByTestId('lang').textContent).toBe('en')
  })

  it('toggleLang switches from en to th', async () => {
    render(<LangProvider><TestConsumer /></LangProvider>)
    await act(async () => {
      screen.getByRole('button').click()
    })
    expect(screen.getByTestId('lang').textContent).toBe('th')
  })

  it('toggleLang switches back from th to en', async () => {
    render(<LangProvider><TestConsumer /></LangProvider>)
    await act(async () => { screen.getByRole('button').click() })
    await act(async () => { screen.getByRole('button').click() })
    expect(screen.getByTestId('lang').textContent).toBe('en')
  })

  it('persists lang to localStorage on toggle', async () => {
    render(<LangProvider><TestConsumer /></LangProvider>)
    await act(async () => { screen.getByRole('button').click() })
    expect(localStorageMock.getItem('lang')).toBe('th')
  })

  it('loads saved lang from localStorage', async () => {
    localStorageMock.setItem('lang', 'th')
    render(<LangProvider><TestConsumer /></LangProvider>)
    // wait for useEffect
    await act(async () => {})
    expect(screen.getByTestId('lang').textContent).toBe('th')
  })

  it('t object changes language when toggled', async () => {
    render(<LangProvider><TestConsumer /></LangProvider>)
    const enLabel = screen.getByTestId('label').textContent
    await act(async () => { screen.getByRole('button').click() })
    const thLabel = screen.getByTestId('label').textContent
    expect(enLabel).not.toBe(thLabel)
  })
})

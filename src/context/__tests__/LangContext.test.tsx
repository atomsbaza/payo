// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { LangProvider, useLang } from '../LangContext'

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
  it('defaults to English', () => {
    render(<LangProvider><TestConsumer /></LangProvider>)
    expect(screen.getByTestId('lang').textContent).toBe('en')
  })

  it('toggleLang is a no-op — language stays English', async () => {
    render(<LangProvider><TestConsumer /></LangProvider>)
    await act(async () => {
      screen.getByRole('button').click()
    })
    expect(screen.getByTestId('lang').textContent).toBe('en')
  })

  it('t object always returns English strings', () => {
    render(<LangProvider><TestConsumer /></LangProvider>)
    expect(screen.getByTestId('label').textContent).toBe('Home')
  })
})

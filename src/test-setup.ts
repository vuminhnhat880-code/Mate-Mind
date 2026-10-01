import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

const storage = new Map<string, string>()
const localStorageMock: Storage = {
  get length() { return storage.size },
  clear: () => storage.clear(),
  getItem: (key) => storage.get(key) ?? null,
  key: (index) => Array.from(storage.keys())[index] ?? null,
  removeItem: (key) => { storage.delete(key) },
  setItem: (key, value) => { storage.set(key, String(value)) },
}
Object.defineProperty(window, 'localStorage', { configurable: true, value: localStorageMock })

afterEach(() => cleanup())

'use client'
import { useSyncExternalStore } from 'react'

const noop = () => () => {}

/** Reads a browser-only value without a hydration mismatch or a setState-in-effect. */
export function useClientValue<T>(read: () => T, serverValue: T): T {
  return useSyncExternalStore(noop, read, () => serverValue)
}

import { aiProviderName } from '../env'
import { createAnthropicProvider } from './anthropic'
import { createMockProvider } from './mock'
import type { AiProvider } from './types'

let cached: AiProvider | undefined

export function getAiProvider(): AiProvider {
  if (!cached) cached = aiProviderName() === 'anthropic' ? createAnthropicProvider() : createMockProvider()
  return cached
}

/** Test hook. */
export function setAiProvider(p: AiProvider | undefined): void {
  cached = p
}

export type { AiProvider } from './types'

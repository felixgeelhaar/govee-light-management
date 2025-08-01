import { describe, it, expect } from 'vitest'
import { createActor } from 'xstate'
import { apiConnectionMachine } from '../../../src/frontend/machines/apiConnectionMachine'

describe('apiConnectionMachine', () => {
  it('starts in disconnected state', () => {
    const actor = createActor(apiConnectionMachine)
    actor.start()
    
    expect(actor.getSnapshot().value).toBe('disconnected')
    expect(actor.getSnapshot().context.apiKey).toBe('')
    expect(actor.getSnapshot().context.error).toBeNull()
  })

  it('transitions to connecting when CONNECT event is sent with API key', () => {
    const actor = createActor(apiConnectionMachine)
    actor.start()
    
    actor.send({ type: 'CONNECT', apiKey: 'test-api-key' })
    
    expect(actor.getSnapshot().value).toBe('connecting')
    expect(actor.getSnapshot().context.apiKey).toBe('test-api-key')
  })

  it('transitions to connected when validation succeeds', () => {
    const actor = createActor(apiConnectionMachine)
    actor.start()
    
    actor.send({ type: 'CONNECT', apiKey: 'valid-api-key' })
    expect(actor.getSnapshot().value).toBe('connecting')
    
    // Manually send validation success event
    actor.send({ type: 'VALIDATION_SUCCESS' })
    expect(actor.getSnapshot().value).toBe('connected')
  })

  it('transitions to error state when validation fails', () => {
    const actor = createActor(apiConnectionMachine)
    actor.start()
    
    actor.send({ type: 'CONNECT', apiKey: 'invalid-key' })
    expect(actor.getSnapshot().value).toBe('connecting')
    
    // Manually send validation failed event
    actor.send({ type: 'VALIDATION_FAILED', error: 'Invalid API key' })
    expect(actor.getSnapshot().value).toBe('error')
    expect(actor.getSnapshot().context.error).toBe('Invalid API key')
  })

  it('can retry from error state', () => {
    const actor = createActor(apiConnectionMachine)
    actor.start()
    
    // Force to error state
    actor.send({ type: 'CONNECT', apiKey: 'invalid-key' })
    actor.send({ type: 'VALIDATION_FAILED', error: 'Invalid API key' })
    
    expect(actor.getSnapshot().value).toBe('error')
    
    // Retry
    actor.send({ type: 'RETRY' })
    
    expect(actor.getSnapshot().value).toBe('connecting')
  })

  it('can disconnect from connected state', () => {
    const actor = createActor(apiConnectionMachine)
    actor.start()
    
    // Force to connected state
    actor.send({ type: 'CONNECT', apiKey: 'valid-key' })
    actor.send({ type: 'VALIDATION_SUCCESS' })
    
    expect(actor.getSnapshot().value).toBe('connected')
    
    // Disconnect
    actor.send({ type: 'DISCONNECT' })
    
    expect(actor.getSnapshot().value).toBe('disconnected')
    expect(actor.getSnapshot().context.apiKey).toBe('')
  })
})
import { describe, it, expect } from 'vitest'
import { createActor, fromPromise } from 'xstate'
import { lightDiscoveryMachine } from '../../../src/frontend/machines/lightDiscoveryMachine'

describe('lightDiscoveryMachine', () => {
  it('starts in idle state', () => {
    const actor = createActor(lightDiscoveryMachine, {})
    actor.start()
    
    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context.lights).toEqual([])
    expect(actor.getSnapshot().context.error).toBeNull()
  })

  it('transitions to fetching when FETCH event is sent', () => {
    const actor = createActor(lightDiscoveryMachine, {})
    actor.start()
    
    actor.send({ type: 'FETCH' })
    
    expect(actor.getSnapshot().value).toBe('fetching')
    expect(actor.getSnapshot().context.isFetching).toBe(true)
  })

  it('transitions to success when lights are fetched', () => {
    const actor = createActor(lightDiscoveryMachine, {})
    actor.start()
    
    actor.send({ type: 'FETCH' })
    expect(actor.getSnapshot().value).toBe('fetching')
    
    // Manually send fetch success event
    actor.send({ 
      type: 'FETCH_SUCCESS', 
      lights: [
        { label: 'Test Light', value: 'device1|model1' }
      ] 
    })
    
    expect(actor.getSnapshot().value).toBe('success')
    expect(actor.getSnapshot().context.lights.length).toBe(1)
  })

  it('transitions to error when fetch fails', () => {
    const actor = createActor(lightDiscoveryMachine, {})
    actor.start()
    
    actor.send({ type: 'FETCH' })
    expect(actor.getSnapshot().value).toBe('fetching')
    
    // Manually send fetch failed event
    actor.send({ type: 'FETCH_FAILED', error: 'Failed to fetch lights' })
    
    expect(actor.getSnapshot().value).toBe('error')
    expect(actor.getSnapshot().context.error).toBe('Failed to fetch lights')
  })

  it('can retry from error state', () => {
    const actor = createActor(lightDiscoveryMachine, {})
    actor.start()
    
    // Force to error state
    actor.send({ type: 'FETCH' })
    actor.send({ type: 'FETCH_FAILED', error: 'Network error' })
    
    expect(actor.getSnapshot().value).toBe('error')
    
    // Retry
    actor.send({ type: 'RETRY' })
    
    expect(actor.getSnapshot().value).toBe('fetching')
  })

  it('can refresh from success state', () => {
    const actor = createActor(lightDiscoveryMachine, {})
    actor.start()
    
    // Force to success state with mock data
    actor.send({ type: 'FETCH' })
    actor.send({ 
      type: 'FETCH_SUCCESS', 
      lights: [
        { label: 'Test Light', value: 'device1|model1' }
      ] 
    })
    
    expect(actor.getSnapshot().value).toBe('success')
    
    // Refresh
    actor.send({ type: 'REFRESH' })
    
    expect(actor.getSnapshot().value).toBe('fetching')
  })

  it('filters lights based on search query', () => {
    const actor = createActor(lightDiscoveryMachine, {})
    actor.start()
    
    // Set up lights
    actor.send({ type: 'FETCH' })
    actor.send({ 
      type: 'FETCH_SUCCESS', 
      lights: [
        { label: 'Living Room Light', value: 'device1|model1' },
        { label: 'Bedroom Light', value: 'device2|model2' },
        { label: 'Kitchen Strip', value: 'device3|model3' }
      ] 
    })
    
    // Search for "room"
    actor.send({ type: 'SEARCH', query: 'room' })
    
    const context = actor.getSnapshot().context
    expect(context.searchQuery).toBe('room')
    expect(context.filteredLights).toHaveLength(2)
    expect(context.filteredLights[0].label).toContain('Room')
  })
})
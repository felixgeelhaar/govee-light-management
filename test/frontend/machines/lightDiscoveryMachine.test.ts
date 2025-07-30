import { describe, it, expect } from 'vitest'
import { createActor, fromPromise } from 'xstate'
import { lightDiscoveryMachine } from '../../../src/frontend/machines/lightDiscoveryMachine'

describe('lightDiscoveryMachine', () => {
  it('starts in idle state', () => {
    const actor = createActor(lightDiscoveryMachine)
    actor.start()
    
    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context.lights).toEqual([])
    expect(actor.getSnapshot().context.error).toBeNull()
  })

  it('transitions to fetching when FETCH event is sent', () => {
    const actor = createActor(lightDiscoveryMachine)
    actor.start()
    
    actor.send({ type: 'FETCH' })
    
    expect(actor.getSnapshot().value).toBe('fetching')
    expect(actor.getSnapshot().context.isFetching).toBe(true)
  })

  it('transitions to success when lights are fetched', async () => {
    const actor = createActor(lightDiscoveryMachine)
    actor.start()
    
    const states: string[] = []
    actor.subscribe((snapshot) => {
      states.push(snapshot.value as string)
    })
    
    actor.send({ type: 'FETCH' })
    
    // Wait for async fetch
    await new Promise(resolve => setTimeout(resolve, 100))
    
    expect(states).toContain('success')
    expect(actor.getSnapshot().context.lights.length).toBeGreaterThan(0)
  })

  it('transitions to error when fetch fails', async () => {
    const actor = createActor(
      lightDiscoveryMachine.provide({
        actors: {
          fetchLights: fromPromise(async () => {
            throw new Error('Failed to fetch lights')
          })
        }
      }),
      { input: { shouldFail: true } }
    )
    actor.start()
    
    const states: string[] = []
    actor.subscribe((snapshot) => {
      states.push(snapshot.value as string)
    })
    
    actor.send({ type: 'FETCH' })
    
    await new Promise(resolve => setTimeout(resolve, 100))
    
    expect(states).toContain('error')
    expect(actor.getSnapshot().context.error).toBeTruthy()
  })

  it('can retry from error state', () => {
    const actor = createActor(lightDiscoveryMachine)
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
    const actor = createActor(lightDiscoveryMachine)
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
    const actor = createActor(lightDiscoveryMachine)
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
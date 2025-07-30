import { describe, it, expect } from 'vitest'
import { createActor, fromPromise } from 'xstate'
import { groupManagementMachine } from '../../../src/frontend/machines/groupManagementMachine'
import type { LightGroup } from '../../../src/shared/types'

describe('groupManagementMachine', () => {
  it('starts in idle state', () => {
    const actor = createActor(groupManagementMachine)
    actor.start()
    
    expect(actor.getSnapshot().value).toBe('idle')
    expect(actor.getSnapshot().context.groups).toEqual([])
    expect(actor.getSnapshot().context.currentGroup).toBeNull()
    expect(actor.getSnapshot().context.error).toBeNull()
  })

  it('transitions to loading when LOAD_GROUPS event is sent', () => {
    const actor = createActor(groupManagementMachine)
    actor.start()
    
    actor.send({ type: 'LOAD_GROUPS' })
    
    expect(actor.getSnapshot().value).toBe('loading')
    expect(actor.getSnapshot().context.isLoading).toBe(true)
  })

  it('transitions to ready when groups are loaded successfully', async () => {
    const actor = createActor(groupManagementMachine)
    actor.start()
    
    const states: string[] = []
    actor.subscribe((snapshot) => {
      states.push(snapshot.value as string)
    })
    
    actor.send({ type: 'LOAD_GROUPS' })
    
    // Wait for async load
    await new Promise(resolve => setTimeout(resolve, 100))
    
    expect(states).toContain('ready')
    expect(actor.getSnapshot().context.groups.length).toBeGreaterThan(0)
  })

  it('transitions to error when loading fails', async () => {
    const actor = createActor(
      groupManagementMachine.provide({
        actors: {
          loadGroups: fromPromise(async () => {
            throw new Error('Failed to load groups')
          })
        }
      }),
      { input: { shouldFailLoad: true } }
    )
    actor.start()
    
    const states: string[] = []
    actor.subscribe((snapshot) => {
      states.push(snapshot.value as string)
    })
    
    actor.send({ type: 'LOAD_GROUPS' })
    
    await new Promise(resolve => setTimeout(resolve, 100))
    
    expect(states).toContain('error')
    expect(actor.getSnapshot().context.error).toBeTruthy()
  })

  it('transitions to editing when CREATE_GROUP event is sent', () => {
    const actor = createActor(groupManagementMachine)
    actor.start()
    
    // Go to ready state first
    actor.send({ type: 'LOAD_GROUPS' })
    actor.send({ 
      type: 'GROUPS_LOADED', 
      groups: [
        { id: 'group1', name: 'Test Group', lightIds: ['light1'], isActive: false }
      ] 
    })
    
    expect(actor.getSnapshot().value).toBe('ready')
    
    // Now create group
    actor.send({ type: 'CREATE_GROUP' })
    
    expect(actor.getSnapshot().value).toBe('editing')
    expect(actor.getSnapshot().context.currentGroup).toBeNull()
    expect(actor.getSnapshot().context.selectedLights).toEqual([])
  })

  it('transitions to editing when EDIT_GROUP event is sent with group data', () => {
    const actor = createActor(groupManagementMachine)
    actor.start()
    
    const testGroup: LightGroup = {
      id: 'group1',
      name: 'Test Group',
      lightIds: ['light1', 'light2'],
      isActive: false
    }
    
    // Go to ready state first
    actor.send({ type: 'LOAD_GROUPS' })
    actor.send({ type: 'GROUPS_LOADED', groups: [testGroup] })
    
    // Edit group
    actor.send({ type: 'EDIT_GROUP', group: testGroup })
    
    expect(actor.getSnapshot().value).toBe('editing')
    expect(actor.getSnapshot().context.currentGroup).toEqual(testGroup)
    expect(actor.getSnapshot().context.selectedLights).toEqual(['light1', 'light2'])
  })

  it('can select and deselect lights in editing state', () => {
    const actor = createActor(groupManagementMachine)
    actor.start()
    
    // Go to editing state
    actor.send({ type: 'LOAD_GROUPS' })
    actor.send({ type: 'GROUPS_LOADED', groups: [] })
    actor.send({ type: 'CREATE_GROUP' })
    
    expect(actor.getSnapshot().value).toBe('editing')
    
    // Select lights
    actor.send({ type: 'SELECT_LIGHT', lightId: 'light1' })
    actor.send({ type: 'SELECT_LIGHT', lightId: 'light2' })
    
    expect(actor.getSnapshot().context.selectedLights).toEqual(['light1', 'light2'])
    
    // Deselect a light
    actor.send({ type: 'DESELECT_LIGHT', lightId: 'light1' })
    
    expect(actor.getSnapshot().context.selectedLights).toEqual(['light2'])
  })

  it('transitions to saving when SAVE_GROUP event is sent', () => {
    const actor = createActor(groupManagementMachine)
    actor.start()
    
    // Go to editing state
    actor.send({ type: 'LOAD_GROUPS' })
    actor.send({ type: 'GROUPS_LOADED', groups: [] })
    actor.send({ type: 'CREATE_GROUP' })
    
    // Save group
    actor.send({ 
      type: 'SAVE_GROUP', 
      name: 'New Group', 
      selectedLights: ['light1', 'light2'] 
    })
    
    expect(actor.getSnapshot().value).toBe('saving')
    expect(actor.getSnapshot().context.isLoading).toBe(true)
  })

  it('saves group and returns to ready state', async () => {
    const actor = createActor(groupManagementMachine)
    actor.start()
    
    const states: string[] = []
    actor.subscribe((snapshot) => {
      states.push(snapshot.value as string)
    })
    
    // Go to editing state
    actor.send({ type: 'LOAD_GROUPS' })
    actor.send({ type: 'GROUPS_LOADED', groups: [] })
    actor.send({ type: 'CREATE_GROUP' })
    
    // Save group
    actor.send({ 
      type: 'SAVE_GROUP', 
      name: 'New Group', 
      selectedLights: ['light1', 'light2'] 
    })
    
    // Wait for async save
    await new Promise(resolve => setTimeout(resolve, 100))
    
    expect(states).toContain('ready')
    expect(actor.getSnapshot().context.groups.length).toBe(1)
    expect(actor.getSnapshot().context.groups[0].name).toBe('New Group')
    expect(actor.getSnapshot().context.currentGroup).toBeNull()
  })

  it('handles save failure and transitions to error', async () => {
    const actor = createActor(
      groupManagementMachine.provide({
        actors: {
          saveGroup: fromPromise(async () => {
            throw new Error('Failed to save group')
          })
        }
      }),
      { input: { shouldFailSave: true } }
    )
    actor.start()
    
    const states: string[] = []
    actor.subscribe((snapshot) => {
      states.push(snapshot.value as string)
    })
    
    // Go to editing state and save
    actor.send({ type: 'LOAD_GROUPS' })
    actor.send({ type: 'GROUPS_LOADED', groups: [] })
    actor.send({ type: 'CREATE_GROUP' })
    actor.send({ 
      type: 'SAVE_GROUP', 
      name: 'New Group', 
      selectedLights: ['light1'] 
    })
    
    await new Promise(resolve => setTimeout(resolve, 100))
    
    expect(states).toContain('error')
    expect(actor.getSnapshot().context.error).toBeTruthy()
  })

  it('transitions to deleting when DELETE_GROUP event is sent', () => {
    const actor = createActor(groupManagementMachine)
    actor.start()
    
    // Go to ready state with groups
    const testGroup = { 
      id: 'group1', 
      name: 'Test Group', 
      lightIds: ['light1'], 
      isActive: false 
    }
    actor.send({ type: 'LOAD_GROUPS' })
    actor.send({ type: 'GROUPS_LOADED', groups: [testGroup] })
    
    // Delete group
    actor.send({ type: 'DELETE_GROUP', groupId: 'group1' })
    
    expect(actor.getSnapshot().value).toBe('deleting')
    expect(actor.getSnapshot().context.isLoading).toBe(true)
  })

  it('deletes group and returns to ready state', async () => {
    const actor = createActor(groupManagementMachine)
    actor.start()
    
    const states: string[] = []
    actor.subscribe((snapshot) => {
      states.push(snapshot.value as string)
    })
    
    // Go to ready state with groups
    const testGroup = { 
      id: 'group1', 
      name: 'Test Group', 
      lightIds: ['light1'], 
      isActive: false 
    }
    actor.send({ type: 'LOAD_GROUPS' })
    actor.send({ type: 'GROUPS_LOADED', groups: [testGroup] })
    
    expect(actor.getSnapshot().context.groups.length).toBe(1)
    
    // Delete group
    actor.send({ type: 'DELETE_GROUP', groupId: 'group1' })
    
    // Wait for async delete
    await new Promise(resolve => setTimeout(resolve, 100))
    
    expect(states).toContain('ready')
    expect(actor.getSnapshot().context.groups.length).toBe(0)
  })

  it('handles delete failure and transitions to error', async () => {
    const actor = createActor(
      groupManagementMachine.provide({
        actors: {
          deleteGroup: fromPromise(async () => {
            throw new Error('Failed to delete group')
          })
        }
      }),
      { input: { shouldFailDelete: true } }
    )
    actor.start()
    
    const states: string[] = []
    actor.subscribe((snapshot) => {
      states.push(snapshot.value as string)
    })
    
    // Go to ready state and delete
    actor.send({ type: 'LOAD_GROUPS' })
    actor.send({ type: 'GROUPS_LOADED', groups: [
      { id: 'group1', name: 'Test', lightIds: [], isActive: false }
    ] })
    actor.send({ type: 'DELETE_GROUP', groupId: 'group1' })
    
    await new Promise(resolve => setTimeout(resolve, 100))
    
    expect(states).toContain('error')
    expect(actor.getSnapshot().context.error).toBeTruthy()
  })

  it('can cancel editing and return to ready state', () => {
    const actor = createActor(groupManagementMachine)
    actor.start()
    
    // Go to editing state
    actor.send({ type: 'LOAD_GROUPS' })
    actor.send({ type: 'GROUPS_LOADED', groups: [] })
    actor.send({ type: 'CREATE_GROUP' })
    
    // Select some lights
    actor.send({ type: 'SELECT_LIGHT', lightId: 'light1' })
    
    expect(actor.getSnapshot().value).toBe('editing')
    expect(actor.getSnapshot().context.selectedLights).toEqual(['light1'])
    
    // Cancel editing
    actor.send({ type: 'CANCEL_EDIT' })
    
    expect(actor.getSnapshot().value).toBe('ready')
    expect(actor.getSnapshot().context.currentGroup).toBeNull()
    expect(actor.getSnapshot().context.selectedLights).toEqual([])
  })

  it('can recover from error state by loading groups', () => {
    const actor = createActor(groupManagementMachine)
    actor.start()
    
    // Force to error state
    actor.send({ type: 'LOAD_GROUPS' })
    actor.send({ type: 'OPERATION_FAILED', error: 'Test error' })
    
    expect(actor.getSnapshot().value).toBe('error')
    expect(actor.getSnapshot().context.error).toBe('Test error')
    
    // Recover by loading
    actor.send({ type: 'LOAD_GROUPS' })
    
    expect(actor.getSnapshot().value).toBe('loading')
    expect(actor.getSnapshot().context.error).toBeNull()
  })
})
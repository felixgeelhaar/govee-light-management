import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import GroupControlView from '../../views/GroupControlView.vue'

describe('GroupControlView', () => {
  it('renders the group control interface', () => {
    const wrapper = mount(GroupControlView)
    expect(wrapper.find('.group-control-view').exists()).toBe(true)
  })

  it('displays API key input section', () => {
    const wrapper = mount(GroupControlView)
    expect(wrapper.find('[data-testid="api-key-section"]').exists()).toBe(true)
  })

  it('displays group management section', () => {
    const wrapper = mount(GroupControlView)
    expect(wrapper.find('[data-testid="group-management-section"]').exists()).toBe(true)
  })

  it('displays control mode section', () => {
    const wrapper = mount(GroupControlView)
    expect(wrapper.find('[data-testid="control-mode-section"]').exists()).toBe(true)
  })

  it('shows create new group button', () => {
    const wrapper = mount(GroupControlView)
    const buttons = wrapper.findAll('button')
    const createButton = buttons.find(button => button.text().includes('Create New Group'))
    expect(createButton).toBeDefined()
  })
})
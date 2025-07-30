import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import LightControlView from '../../views/LightControlView.vue'

describe('LightControlView', () => {
  it('renders the light control interface', () => {
    const wrapper = mount(LightControlView)
    expect(wrapper.find('.light-control-view').exists()).toBe(true)
  })

  it('displays API key input section', () => {
    const wrapper = mount(LightControlView)
    expect(wrapper.find('[data-testid="api-key-section"]').exists()).toBe(true)
  })

  it('displays light selection section', () => {
    const wrapper = mount(LightControlView)
    expect(wrapper.find('[data-testid="light-selection-section"]').exists()).toBe(true)
  })

  it('displays control mode section', () => {
    const wrapper = mount(LightControlView)
    expect(wrapper.find('[data-testid="control-mode-section"]').exists()).toBe(true)
  })
})
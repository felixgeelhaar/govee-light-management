import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import App from '../App.vue'

describe('App', () => {
  it('renders properly', () => {
    const wrapper = mount(App)
    expect(wrapper.exists()).toBe(true)
  })

  it('has the correct component structure', () => {
    const wrapper = mount(App)
    expect(wrapper.find('.govee-light-manager').exists()).toBe(true)
  })
})
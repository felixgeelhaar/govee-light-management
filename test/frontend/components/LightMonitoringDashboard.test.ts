import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import LightMonitoringDashboard from '../../../src/frontend/components/LightMonitoringDashboard.vue';

// Mock the composables
vi.mock('../../../src/frontend/services/lightMonitoringService', () => ({
  useLightMonitoring: () => ({
    isMonitoring: { value: false },
    monitoringStats: { 
      value: {
        monitoredCount: 0,
        onlineCount: 0,
        offlineCount: 0,
        changeCount: 0
      }
    },
    getAllLightStates: () => ({}),
    getRecentChanges: () => [],
    startMonitoring: vi.fn(),
    stopMonitoring: vi.fn(),
    syncLightStates: vi.fn(),
    updateConfig: vi.fn(),
    onStateChange: vi.fn(() => () => {})
  })
}));

vi.mock('../../../src/frontend/composables/useLightDiscovery', () => ({
  useLightDiscovery: () => ({
    filteredLights: { value: [] },
    isReady: { value: true },
    isFetchingLights: { value: false },
    lights: { value: [] },
    isIdle: { value: true },
    fetchLights: vi.fn()
  })
}));

vi.mock('../../../src/frontend/composables/useFeedback', () => ({
  useFeedbackHelpers: () => ({
    showWarning: vi.fn(),
    showSuccessToast: vi.fn(),
    showApiError: vi.fn(),
    showInfo: vi.fn()
  })
}));

describe('LightMonitoringDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the dashboard header', () => {
    const wrapper = mount(LightMonitoringDashboard);
    
    expect(wrapper.find('h3').text()).toBe('Light Monitoring');
    expect(wrapper.find('.dashboard-header').exists()).toBe(true);
  });

  it('displays monitoring stats', () => {
    const wrapper = mount(LightMonitoringDashboard);
    
    const statCards = wrapper.findAll('.stat-card');
    expect(statCards).toHaveLength(4);
    
    expect(statCards[0].find('.stat-label').text()).toBe('Monitored');
    expect(statCards[1].find('.stat-label').text()).toBe('Online');
    expect(statCards[2].find('.stat-label').text()).toBe('Offline');
    expect(statCards[3].find('.stat-label').text()).toBe('Changes');
  });

  it('shows start monitoring button when not monitoring', () => {
    const wrapper = mount(LightMonitoringDashboard);
    
    const startButton = wrapper.find('button');
    expect(startButton.text()).toBe('Start Monitoring');
    expect(startButton.attributes('disabled')).toBeDefined();
  });

  it('renders monitoring sections', () => {
    const wrapper = mount(LightMonitoringDashboard);
    
    const sections = wrapper.findAll('.monitoring-section');
    expect(sections.length).toBeGreaterThan(0);
    
    const titles = wrapper.findAll('h4');
    expect(titles.some(title => title.text() === 'Monitored Lights')).toBe(true);
    expect(titles.some(title => title.text() === 'Configuration')).toBe(true);
  });

  it('displays configuration options', () => {
    const wrapper = mount(LightMonitoringDashboard);
    
    expect(wrapper.find('#pollInterval').exists()).toBe(true);
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(true);
  });

  it('renders with default configuration values', () => {
    const wrapper = mount(LightMonitoringDashboard);
    
    const pollIntervalInput = wrapper.find('#pollInterval');
    expect(pollIntervalInput.element.value).toBe('30');
  });
});
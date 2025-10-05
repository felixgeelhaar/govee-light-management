import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import DiagnosticsPanel from "../../components/DiagnosticsPanel.vue";

describe("DiagnosticsPanel", () => {
  const baseSnapshot = {
    transport: {
      checks: 3,
      lastDurationMs: 72,
      lastSnapshot: [
        {
          kind: "cloud",
          label: "Govee Cloud",
          isHealthy: true,
          latencyMs: 65,
          lastChecked: 1700000000000,
        },
      ],
    },
    discovery: {
      total: 4,
      stale: 1,
      totalDurationMs: 200,
      lastDurationMs: 80,
      lastCount: 6,
    },
    commands: {
      total: 10,
      failures: 2,
      totalDurationMs: 520,
      byCommand: {
        power: {
          total: 4,
          failures: 1,
          totalDurationMs: 160,
          lastError: { name: "TimeoutError", message: "Request timed out" },
        },
      },
    },
  };

  it("renders key metrics when snapshot is provided", () => {
    const wrapper = mount(DiagnosticsPanel, {
      props: { snapshot: baseSnapshot },
    });

    expect(wrapper.text()).toContain("Diagnostics");
    expect(wrapper.text()).toContain("Govee Cloud");
    expect(wrapper.text()).toContain("Available");
    expect(wrapper.text()).toContain("50 ms");
    expect(wrapper.text()).toContain("Command Success");
    expect(wrapper.text()).toContain("80%");
    expect(wrapper.text()).toContain("Stale Responses");
    expect(wrapper.text()).toContain("1");
  });

  it("emits refresh and reset events", async () => {
    const wrapper = mount(DiagnosticsPanel, {
      props: { snapshot: baseSnapshot },
    });

    const buttons = wrapper.findAll("button.btn-small");
    expect(buttons).toHaveLength(2);

    await buttons[0].trigger("click");
    await buttons[1].trigger("click");

    const events = wrapper.emitted();
    expect(events.refresh).toHaveLength(1);
    expect(events.reset).toHaveLength(1);
  });

  it("hides panel when no snapshot data is provided", () => {
    const wrapper = mount(DiagnosticsPanel, {
      props: { snapshot: null },
    });

    expect(wrapper.find(".diagnostics").exists()).toBe(false);
  });
});

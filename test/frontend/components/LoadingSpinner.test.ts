import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import LoadingSpinner from "../../../src/frontend/components/LoadingSpinner.vue";

describe("LoadingSpinner", () => {
  it("renders with default props", () => {
    const wrapper = mount(LoadingSpinner);
    
    expect(wrapper.exists()).toBe(true);
    expect(wrapper.find(".loading-spinner").exists()).toBe(true);
    expect(wrapper.find(".spinner-svg").exists()).toBe(true);
    expect(wrapper.find(".spinner-circle").exists()).toBe(true);
  });

  it("applies default variant and size", () => {
    const wrapper = mount(LoadingSpinner);
    
    expect(wrapper.find(".loading-spinner-primary").exists()).toBe(true);
    expect(wrapper.find(".spinner-svg").attributes("width")).toBe("32");
    expect(wrapper.find(".spinner-svg").attributes("height")).toBe("32");
  });

  it("accepts custom size prop", () => {
    const wrapper = mount(LoadingSpinner, {
      props: {
        size: 64,
      },
    });

    expect(wrapper.find(".spinner-svg").attributes("width")).toBe("64");
    expect(wrapper.find(".spinner-svg").attributes("height")).toBe("64");
    
    const element = wrapper.find(".loading-spinner").element as HTMLElement;
    expect(element.style.width).toBe("64px");
    expect(element.style.height).toBe("64px");
  });

  it("accepts custom variant prop", () => {
    const variants = ["primary", "secondary", "light", "dark"] as const;
    
    variants.forEach((variant) => {
      const wrapper = mount(LoadingSpinner, {
        props: {
          variant,
        },
      });

      expect(wrapper.find(`.loading-spinner-${variant}`).exists()).toBe(true);
    });
  });

  it("accepts custom stroke width prop", () => {
    const wrapper = mount(LoadingSpinner, {
      props: {
        strokeWidth: 5,
      },
    });

    expect(wrapper.find(".spinner-circle").attributes("stroke-width")).toBe("5");
  });

  it("combines all props correctly", () => {
    const wrapper = mount(LoadingSpinner, {
      props: {
        size: 48,
        variant: "secondary",
        strokeWidth: 4,
      },
    });

    expect(wrapper.find(".loading-spinner-secondary").exists()).toBe(true);
    expect(wrapper.find(".spinner-svg").attributes("width")).toBe("48");
    expect(wrapper.find(".spinner-svg").attributes("height")).toBe("48");
    expect(wrapper.find(".spinner-circle").attributes("stroke-width")).toBe("4");
  });

  it("maintains proper SVG structure", () => {
    const wrapper = mount(LoadingSpinner);
    
    const svg = wrapper.find(".spinner-svg");
    expect(svg.attributes("viewBox")).toBe("0 0 50 50");
    
    const circle = wrapper.find(".spinner-circle");
    expect(circle.attributes("cx")).toBe("25");
    expect(circle.attributes("cy")).toBe("25");
    expect(circle.attributes("r")).toBe("20");
    expect(circle.attributes("fill")).toBe("none");
  });

  it("has proper CSS classes for styling", () => {
    const wrapper = mount(LoadingSpinner);
    
    expect(wrapper.classes()).toContain("loading-spinner");
    expect(wrapper.classes()).toContain("loading-spinner-primary");
  });

  it("supports all variant types", () => {
    const variants = [
      { variant: "primary", class: "loading-spinner-primary" },
      { variant: "secondary", class: "loading-spinner-secondary" },
      { variant: "light", class: "loading-spinner-light" },
      { variant: "dark", class: "loading-spinner-dark" },
    ] as const;

    variants.forEach(({ variant, class: expectedClass }) => {
      const wrapper = mount(LoadingSpinner, {
        props: { variant },
      });

      expect(wrapper.find(`.${expectedClass}`).exists()).toBe(true);
    });
  });

  it("maintains aspect ratio with different sizes", () => {
    const sizes = [16, 24, 32, 48, 64, 128];
    
    sizes.forEach((size) => {
      const wrapper = mount(LoadingSpinner, {
        props: { size },
      });

      const element = wrapper.find(".loading-spinner").element as HTMLElement;
      expect(element.style.width).toBe(`${size}px`);
      expect(element.style.height).toBe(`${size}px`);
      
      const svg = wrapper.find(".spinner-svg");
      expect(svg.attributes("width")).toBe(size.toString());
      expect(svg.attributes("height")).toBe(size.toString());
    });
  });

  it("uses correct default stroke width", () => {
    const wrapper = mount(LoadingSpinner);
    
    expect(wrapper.find(".spinner-circle").attributes("stroke-width")).toBe("3");
  });
});
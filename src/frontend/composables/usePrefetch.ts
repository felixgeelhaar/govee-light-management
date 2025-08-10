import { onMounted } from 'vue';

/**
 * Composable for prefetching components and resources
 * Improves perceived performance by loading resources in advance
 */
export function usePrefetch() {
  const prefetchedComponents = new Set<string>();
  
  /**
   * Prefetch a component module
   * @param componentPath Path to the component to prefetch
   */
  const prefetchComponent = async (componentPath: string) => {
    if (prefetchedComponents.has(componentPath)) {
      return;
    }
    
    try {
      // Use dynamic import with webpackPrefetch comment for build optimization
      await import(/* @vite-ignore */ componentPath);
      prefetchedComponents.add(componentPath);
    } catch (error) {
      console.warn(`Failed to prefetch component: ${componentPath}`, error);
    }
  };
  
  /**
   * Prefetch multiple components
   * @param paths Array of component paths to prefetch
   */
  const prefetchComponents = async (paths: string[]) => {
    const promises = paths.map(path => prefetchComponent(path));
    await Promise.allSettled(promises);
  };
  
  /**
   * Prefetch components after the main view has loaded
   * This improves initial load time while preparing future navigation
   */
  const prefetchOnIdle = (paths: string[]) => {
    onMounted(() => {
      // Use requestIdleCallback if available, otherwise use setTimeout
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => {
          prefetchComponents(paths);
        }, { timeout: 2000 });
      } else {
        setTimeout(() => {
          prefetchComponents(paths);
        }, 1000);
      }
    });
  };
  
  /**
   * Prefetch based on user interaction hints
   * @param element Element to observe for interaction
   * @param componentPath Component to prefetch on hover/focus
   */
  const prefetchOnInteraction = (
    element: HTMLElement | null,
    componentPath: string
  ) => {
    if (!element) return;
    
    const handleInteraction = () => {
      prefetchComponent(componentPath);
      // Remove listeners after first interaction
      element.removeEventListener('mouseenter', handleInteraction);
      element.removeEventListener('focus', handleInteraction);
    };
    
    element.addEventListener('mouseenter', handleInteraction, { once: true });
    element.addEventListener('focus', handleInteraction, { once: true });
  };
  
  /**
   * Create a link prefetch tag for external resources
   * @param url URL to prefetch
   * @param as Resource type (script, style, etc.)
   */
  const prefetchResource = (url: string, as: 'script' | 'style' | 'font' = 'script') => {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = as;
    link.href = url;
    document.head.appendChild(link);
  };
  
  return {
    prefetchComponent,
    prefetchComponents,
    prefetchOnIdle,
    prefetchOnInteraction,
    prefetchResource,
    prefetchedComponents
  };
}
import { setup, assign, createActor } from 'xstate';

// Toast types
export type ToastType = 'success' | 'error' | 'warning' | 'info';

// Toast context
export interface ToastContext {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  persistent?: boolean;
  category?: string; // Used for categorizing related toasts (e.g., 'api-connection', 'light-test')
  priority?: number; // Higher numbers = higher priority
}

// Queue item includes context and metadata
export interface QueuedToast extends ToastContext {
  queuedAt: number;
  attempts?: number;
}

// Events
export type ToastEvent =
  | { type: 'SHOW'; toast: Omit<ToastContext, 'id'> }
  | { type: 'UPDATE'; id: string; updates: Partial<ToastContext> }
  | { type: 'DISMISS'; id: string }
  | { type: 'DISMISS_CATEGORY'; category: string }
  | { type: 'CLEAR_ALL' }
  | { type: 'PROCESS_QUEUE' }
  | { type: 'AUTO_DISMISS' }
  | { type: 'RETRY_FAILED' };

// Machine context
export interface ToastMachineContext {
  activeToasts: Map<string, ToastContext>;
  queue: QueuedToast[];
  maxActive: number;
  defaultDuration: number;
  categoryLimits: Map<string, number>; // Max toasts per category
  priorityThreshold: number; // Minimum priority to interrupt existing toasts
}

// Guards
const canShowToast = (context: ToastMachineContext, event: any) => {
  if (event.type !== 'SHOW') return false;
  
  const { toast } = event;
  const currentCount = context.activeToasts.size;
  
  // Check if we're at max capacity
  if (currentCount >= context.maxActive) {
    // If toast has high priority, allow it to replace lower priority ones
    if (toast.priority && toast.priority >= context.priorityThreshold) {
      return true;
    }
    return false;
  }
  
  // Check category limits
  if (toast.category) {
    const categoryLimit = context.categoryLimits.get(toast.category) || Infinity;
    const categoryCount = Array.from(context.activeToasts.values())
      .filter(t => t.category === toast.category).length;
    
    if (categoryCount >= categoryLimit) {
      return false;
    }
  }
  
  return true;
};

const shouldReplaceExistingToast = (context: ToastMachineContext, event: any) => {
  if (event.type !== 'SHOW') return false;
  
  const { toast } = event;
  
  // If same category, replace the oldest one
  if (toast.category) {
    const existingInCategory = Array.from(context.activeToasts.entries())
      .filter(([_, t]) => t.category === toast.category);
    
    return existingInCategory.length > 0;
  }
  
  return false;
};








// Toast State Machine using setup API
export const toastMachine = setup({
  types: {
    context: {} as ToastMachineContext,
    events: {} as ToastEvent
  },
  guards: {
    canShowToast: ({ context, event }) => {
      if (event.type !== 'SHOW') return false;
      
      const { toast } = event;
      const currentCount = context.activeToasts.size;
      
      // Check if we're at max capacity
      if (currentCount >= context.maxActive) {
        // If toast has high priority, allow it to replace lower priority ones
        if (toast.priority && toast.priority >= context.priorityThreshold) {
          return true;
        }
        return false;
      }
      
      // Check category limits
      if (toast.category) {
        const categoryLimit = context.categoryLimits.get(toast.category) || Infinity;
        const categoryCount = Array.from(context.activeToasts.values())
          .filter((t: ToastContext) => t.category === toast.category).length;
        
        if (categoryCount >= categoryLimit) {
          return false;
        }
      }
      
      return true;
    },
    hasActiveToasts: ({ context }) => context.activeToasts.size > 1,
    canProcessQueue: ({ context }) => context.activeToasts.size < context.maxActive
  },
  actions: {
    showToast: assign(({ context, event }) => {
      if (event.type !== 'SHOW') return context;
      
      const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const toast: ToastContext = {
        ...event.toast,
        id,
        duration: event.toast.duration ?? context.defaultDuration,
        priority: event.toast.priority ?? 0
      };
      
      const newActiveToasts = new Map(context.activeToasts);
      
      // If we need to replace an existing toast
      if (toast.category) {
        const existingInCategory = Array.from(newActiveToasts.entries())
          .filter(([_, t]) => t.category === toast.category)
          .sort(([_, a], [__, b]) => (a.priority || 0) - (b.priority || 0));
        
        if (existingInCategory.length > 0) {
          const [oldId] = existingInCategory[0];
          newActiveToasts.delete(oldId);
        }
      }
      // If we're at capacity, remove lowest priority toast
      else if (newActiveToasts.size >= context.maxActive && toast.priority && toast.priority >= context.priorityThreshold) {
        const lowestPriority = Array.from(newActiveToasts.entries())
          .sort(([_, a], [__, b]) => (a.priority || 0) - (b.priority || 0));
        
        if (lowestPriority.length > 0) {
          const [oldId] = lowestPriority[0];
          newActiveToasts.delete(oldId);
        }
      }
      
      newActiveToasts.set(id, toast);
      return { ...context, activeToasts: newActiveToasts };
    }),
    queueToast: assign(({ context, event }) => {
      if (event.type !== 'SHOW') return context;
      
      const queuedToast: QueuedToast = {
        ...event.toast,
        id: `queued-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        queuedAt: Date.now(),
        priority: event.toast.priority ?? 0
      };
      
      // Insert in priority order (highest first)
      const newQueue = [...context.queue, queuedToast]
        .sort((a, b) => (b.priority || 0) - (a.priority || 0));
      
      return { ...context, queue: newQueue };
    }),
    updateToast: assign(({ context, event }) => {
      if (event.type !== 'UPDATE') return context;
      
      const newActiveToasts = new Map(context.activeToasts);
      const existingToast = newActiveToasts.get(event.id);
      
      if (existingToast) {
        newActiveToasts.set(event.id, { ...existingToast, ...event.updates });
      }
      
      return { ...context, activeToasts: newActiveToasts };
    }),
    dismissToast: assign(({ context, event }) => {
      if (event.type !== 'DISMISS') return context;
      
      const newActiveToasts = new Map(context.activeToasts);
      newActiveToasts.delete(event.id);
      return { ...context, activeToasts: newActiveToasts };
    }),
    dismissCategory: assign(({ context, event }) => {
      if (event.type !== 'DISMISS_CATEGORY') return context;
      
      const newActiveToasts = new Map(context.activeToasts);
      
      Array.from(newActiveToasts.entries()).forEach(([id, toast]) => {
        if (toast.category === event.category) {
          newActiveToasts.delete(id);
        }
      });
      
      const newQueue = context.queue.filter(toast => toast.category !== event.category);
      
      return { ...context, activeToasts: newActiveToasts, queue: newQueue };
    }),
    clearAll: assign(({ context }) => ({
      ...context,
      activeToasts: new Map(),
      queue: []
    })),
    processQueue: assign(({ context }) => {
      const newActiveToasts = new Map(context.activeToasts);
      let newQueue = [...context.queue];
      
      // Process queue items that can now be shown
      while (newActiveToasts.size < context.maxActive && newQueue.length > 0) {
        const nextToast = newQueue.shift()!;
        
        // Check category limits
        if (nextToast.category) {
          const categoryLimit = context.categoryLimits.get(nextToast.category) || Infinity;
          const categoryCount = Array.from(newActiveToasts.values())
            .filter(t => t.category === nextToast.category).length;
          
          if (categoryCount >= categoryLimit) {
            continue; // Skip this toast, try next
          }
        }
        
        // Add to active toasts
        newActiveToasts.set(nextToast.id, nextToast);
        break;
      }
      
      return { ...context, activeToasts: newActiveToasts, queue: newQueue };
    })
  }
}).createMachine({
  id: 'toastMachine',
  context: {
    activeToasts: new Map(),
    queue: [],
    maxActive: 3,
    defaultDuration: 5000,
    categoryLimits: new Map([
      ['api-connection', 1],
      ['light-test', 1],
      ['light-discovery', 1]
    ]),
    priorityThreshold: 8
  },
  initial: 'idle',
  states: {
    idle: {
      on: {
        SHOW: [
          {
            guard: 'canShowToast',
            actions: 'showToast',
            target: 'displaying'
          },
          {
            actions: 'queueToast',
            target: 'queuing'
          }
        ],
        UPDATE: {
          actions: 'updateToast'
        },
        DISMISS: {
          actions: 'dismissToast'
        },
        DISMISS_CATEGORY: {
          actions: 'dismissCategory'
        },
        CLEAR_ALL: {
          actions: 'clearAll'
        }
      }
    },
    displaying: {
      on: {
        SHOW: [
          {
            guard: 'canShowToast',
            actions: 'showToast'
          },
          {
            actions: 'queueToast',
            target: 'queuing'
          }
        ],
        UPDATE: {
          actions: 'updateToast'
        },
        DISMISS: [
          {
            guard: 'hasActiveToasts',
            actions: ['dismissToast', 'processQueue']
          },
          {
            actions: 'dismissToast',
            target: 'idle'
          }
        ],
        DISMISS_CATEGORY: {
          actions: ['dismissCategory', 'processQueue']
        },
        PROCESS_QUEUE: {
          actions: 'processQueue'
        },
        CLEAR_ALL: {
          actions: 'clearAll',
          target: 'idle'
        }
      },
      after: {
        1000: {
          actions: 'processQueue'
        }
      }
    },
    queuing: {
      on: {
        SHOW: {
          actions: 'queueToast'
        },
        UPDATE: {
          actions: 'updateToast'
        },
        DISMISS: [
          {
            guard: ({ context }) => context.activeToasts.size > 0,
            actions: ['dismissToast', 'processQueue'],
            target: 'displaying'
          },
          {
            actions: 'dismissToast',
            target: 'idle'
          }
        ],
        DISMISS_CATEGORY: {
          actions: ['dismissCategory', 'processQueue']
        },
        PROCESS_QUEUE: [
          {
            guard: 'canProcessQueue',
            actions: 'processQueue',
            target: 'displaying'
          }
        ],
        CLEAR_ALL: {
          actions: 'clearAll',
          target: 'idle'
        }
      },
      after: {
        500: {
          actions: 'processQueue'
        }
      }
    }
  }
});

// Service class to manage the state machine
export class ToastService {
  private actor: any;
  private callbacks: Map<string, Function> = new Map();
  private recentToasts: Map<string, { count: number; lastShown: number; id: string }> = new Map();
  private groupingWindow = 3000; // 3 seconds for grouping similar toasts
  
  constructor() {
    this.actor = createActor(toastMachine);
    
    // Set up automatic queue processing
    this.actor.subscribe((state: any) => {
      // Auto-process queue when space becomes available
      if (state.matches('displaying') || state.matches('queuing')) {
        setTimeout(() => {
          if (state.context.queue.length > 0 && 
              state.context.activeToasts.size < state.context.maxActive) {
            this.actor.send({ type: 'PROCESS_QUEUE' });
          }
        }, 100);
      }
      
      // Trigger callbacks
      this.callbacks.forEach(callback => callback(state));
    });
    
    this.actor.start();
  }
  
  // Public API
  showToast(toast: Omit<ToastContext, 'id'>): string {
    // Create a grouping key for similar toasts
    const groupingKey = `${toast.type}-${toast.category || 'default'}-${toast.title}`;
    const now = Date.now();
    
    // Check if we have a recent similar toast
    const recent = this.recentToasts.get(groupingKey);
    if (recent && (now - recent.lastShown) < this.groupingWindow) {
      // Update existing toast instead of creating new one
      const updatedCount = recent.count + 1;
      const updatedToast = {
        ...toast,
        message: updatedCount > 1 
          ? `${toast.message} (${updatedCount} similar)` 
          : toast.message,
        duration: Math.max(toast.duration || 5000, 4000) // Extend duration for grouped toasts
      };
      
      this.updateToast(recent.id, updatedToast);
      
      // Update grouping record
      this.recentToasts.set(groupingKey, {
        count: updatedCount,
        lastShown: now,
        id: recent.id
      });
      
      return recent.id;
    }
    
    // Create new toast
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.actor.send({ type: 'SHOW', toast: { ...toast, id } });
    
    // Record for grouping
    this.recentToasts.set(groupingKey, {
      count: 1,
      lastShown: now,
      id
    });
    
    // Clean up old grouping records
    this.cleanupRecentToasts();
    
    return id;
  }
  
  updateToast(id: string, updates: Partial<ToastContext>): void {
    this.actor.send({ type: 'UPDATE', id, updates });
  }
  
  dismissToast(id: string): void {
    this.actor.send({ type: 'DISMISS', id });
    
    // Clean up grouping record
    for (const [key, record] of this.recentToasts.entries()) {
      if (record.id === id) {
        this.recentToasts.delete(key);
        break;
      }
    }
  }
  
  dismissCategory(category: string): void {
    this.actor.send({ type: 'DISMISS_CATEGORY', category });
  }
  
  clearAll(): void {
    this.actor.send({ type: 'CLEAR_ALL' });
  }
  
  // Get current state
  getActiveToasts(): ToastContext[] {
    return Array.from(this.actor.getSnapshot().context.activeToasts.values());
  }
  
  getQueueLength(): number {
    return this.actor.getSnapshot().context.queue.length;
  }
  
  // Subscribe to changes
  subscribe(callback: (state: any) => void): () => void {
    const id = Math.random().toString(36);
    this.callbacks.set(id, callback);
    
    return () => {
      this.callbacks.delete(id);
    };
  }
  
  // Convenience methods for common toast types
  showSuccess(title: string, message?: string, category?: string): string {
    return this.showToast({ 
      type: 'success', 
      title, 
      message, 
      category,
      priority: 5,
      duration: 4000 // Show success toasts for 4 seconds (reduced for better UX)
    });
  }
  
  showError(title: string, message?: string, category?: string): string {
    return this.showToast({ 
      type: 'error', 
      title, 
      message, 
      category,
      priority: 9, // High priority for errors
      duration: 8000 
    });
  }
  
  showWarning(title: string, message?: string, category?: string): string {
    return this.showToast({ 
      type: 'warning', 
      title, 
      message, 
      category,
      priority: 7,
      duration: 5000 // Show warning toasts for 5 seconds
    });
  }
  
  showInfo(title: string, message?: string, category?: string): string {
    return this.showToast({ 
      type: 'info', 
      title, 
      message, 
      category,
      priority: 3,
      duration: 4000 // Show info toasts for 4 seconds
    });
  }
  
  // API-specific convenience methods
  showApiConnectionTesting(category = 'api-connection'): string {
    return this.showToast({
      type: 'info',
      title: 'Testing Connection',
      message: 'Testing connection to Govee API...',
      category,
      priority: 6,
      persistent: false
    });
  }
  
  showApiConnectionSuccess(message?: string, category = 'api-connection'): string {
    return this.showToast({
      type: 'success',
      title: 'Connection Successful',
      message: message || 'API key validated successfully!',
      category,
      priority: 5,
      duration: 5000 // Show API success for 5 seconds
    });
  }
  
  showApiConnectionError(message?: string, category = 'api-connection'): string {
    return this.showToast({
      type: 'error',
      title: 'Connection Failed',
      message: message || 'Failed to connect to the Govee API',
      category,
      priority: 9,
      duration: 8000
    });
  }
  
  // Private helper methods
  private cleanupRecentToasts(): void {
    const now = Date.now();
    for (const [key, record] of this.recentToasts.entries()) {
      if ((now - record.lastShown) > this.groupingWindow * 2) {
        this.recentToasts.delete(key);
      }
    }
  }
  
  // Configuration methods
  setGroupingWindow(windowMs: number): void {
    this.groupingWindow = Math.max(1000, windowMs); // Minimum 1 second
  }
  
  getGroupingWindow(): number {
    return this.groupingWindow;
  }
  
  // Cleanup
  stop(): void {
    this.actor.stop();
    this.callbacks.clear();
    this.recentToasts.clear();
  }
}

// Global instance
export const toastService = new ToastService();
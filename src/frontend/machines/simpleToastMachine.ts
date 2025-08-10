// Simple toast state machine without XState dependencies
export type ToastType = 'success' | 'error' | 'warning' | 'info';

// Toast context
export interface ToastContext {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  persistent?: boolean;
  category?: string;
  priority?: number;
  createdAt: number;
}

// Queue item
export interface QueuedToast extends ToastContext {
  queuedAt: number;
}

// State machine states
type ToastMachineState = 'idle' | 'displaying' | 'queuing';

// Events
export type ToastEvent =
  | { type: 'SHOW'; toast: Omit<ToastContext, 'id' | 'createdAt'> }
  | { type: 'UPDATE'; id: string; updates: Partial<ToastContext> }
  | { type: 'DISMISS'; id: string }
  | { type: 'DISMISS_CATEGORY'; category: string }
  | { type: 'CLEAR_ALL' }
  | { type: 'PROCESS_QUEUE' };

// Machine context
export interface ToastMachineContext {
  activeToasts: Map<string, ToastContext>;
  queue: QueuedToast[];
  maxActive: number;
  defaultDuration: number;
  categoryLimits: Map<string, number>;
  priorityThreshold: number;
}

// Simple event emitter
class EventEmitter {
  private listeners = new Map<string, Function[]>();

  on(event: string, listener: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);

    return () => {
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        const index = eventListeners.indexOf(listener);
        if (index > -1) {
          eventListeners.splice(index, 1);
        }
      }
    };
  }

  emit(event: string, ...args: any[]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => listener(...args));
    }
  }
}

// Simple state machine implementation
export class SimpleToastMachine extends EventEmitter {
  private state: ToastMachineState = 'idle';
  private context: ToastMachineContext;
  private processingTimer: NodeJS.Timeout | null = null;

  constructor() {
    super();
    
    this.context = {
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
    };

    // Auto-process queue periodically
    this.startProcessingTimer();
  }

  // Public API
  send(event: ToastEvent): void {
    const previousState = this.state;
    
    switch (event.type) {
      case 'SHOW':
        this.handleShow(event);
        break;
      case 'UPDATE':
        this.handleUpdate(event);
        break;
      case 'DISMISS':
        this.handleDismiss(event);
        break;
      case 'DISMISS_CATEGORY':
        this.handleDismissCategory(event);
        break;
      case 'CLEAR_ALL':
        this.handleClearAll();
        break;
      case 'PROCESS_QUEUE':
        this.handleProcessQueue();
        break;
    }

    // Update state based on context
    this.updateState();

    // Emit state change if state changed
    if (this.state !== previousState) {
      this.emit('stateChange', {
        state: this.state,
        context: { ...this.context }
      });
    }

    // Always emit context update for reactive systems
    this.emit('contextUpdate', { ...this.context });
  }

  // Getters
  getState(): ToastMachineState {
    return this.state;
  }

  getContext(): ToastMachineContext {
    return { ...this.context };
  }

  getActiveToasts(): ToastContext[] {
    return Array.from(this.context.activeToasts.values());
  }

  getQueueLength(): number {
    return this.context.queue.length;
  }

  // Event handlers
  private handleShow(event: { type: 'SHOW'; toast: Omit<ToastContext, 'id' | 'createdAt'> }): void {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const toast: ToastContext = {
      ...event.toast,
      id,
      createdAt: Date.now(),
      duration: event.toast.duration ?? this.context.defaultDuration,
      priority: event.toast.priority ?? 5
    };

    if (this.canShowToast(toast)) {
      this.addActiveToast(toast);
    } else {
      this.addToQueue(toast);
    }
  }

  private handleUpdate(event: { type: 'UPDATE'; id: string; updates: Partial<ToastContext> }): void {
    const existingToast = this.context.activeToasts.get(event.id);
    if (existingToast) {
      const updatedToast = { ...existingToast, ...event.updates };
      this.context.activeToasts.set(event.id, updatedToast);
    }
  }

  private handleDismiss(event: { type: 'DISMISS'; id: string }): void {
    this.context.activeToasts.delete(event.id);
    this.processQueue();
  }

  private handleDismissCategory(event: { type: 'DISMISS_CATEGORY'; category: string }): void {
    // Remove from active toasts
    Array.from(this.context.activeToasts.entries()).forEach(([id, toast]) => {
      if (toast.category === event.category) {
        this.context.activeToasts.delete(id);
      }
    });

    // Remove from queue
    this.context.queue = this.context.queue.filter(
      toast => toast.category !== event.category
    );

    this.processQueue();
  }

  private handleClearAll(): void {
    this.context.activeToasts.clear();
    this.context.queue = [];
  }

  private handleProcessQueue(): void {
    this.processQueue();
  }

  // Helper methods
  private canShowToast(toast: ToastContext): boolean {
    const currentCount = this.context.activeToasts.size;

    // Check if we're at max capacity
    if (currentCount >= this.context.maxActive) {
      // If toast has high priority, allow it to replace lower priority ones
      if (toast.priority && toast.priority >= this.context.priorityThreshold) {
        return true;
      }
      return false;
    }

    // Check category limits
    if (toast.category) {
      const categoryLimit = this.context.categoryLimits.get(toast.category) || Infinity;
      const categoryCount = Array.from(this.context.activeToasts.values())
        .filter(t => t.category === toast.category).length;

      if (categoryCount >= categoryLimit) {
        // If same category, replace the oldest one
        return true;
      }
    }

    return true;
  }

  private addActiveToast(toast: ToastContext): void {
    // If we need to replace an existing toast
    if (toast.category && this.shouldReplaceExistingToast(toast)) {
      const existingInCategory = Array.from(this.context.activeToasts.entries())
        .filter(([_, t]) => t.category === toast.category)
        .sort(([_, a], [__, b]) => (a.priority || 0) - (b.priority || 0)); // Sort by priority, lowest first

      if (existingInCategory.length > 0) {
        const [oldId] = existingInCategory[0];
        this.context.activeToasts.delete(oldId);
      }
    }
    // If we're at capacity, remove lowest priority toast
    else if (this.context.activeToasts.size >= this.context.maxActive && 
             toast.priority && toast.priority >= this.context.priorityThreshold) {
      const lowestPriority = Array.from(this.context.activeToasts.entries())
        .sort(([_, a], [__, b]) => (a.priority || 0) - (b.priority || 0));

      if (lowestPriority.length > 0) {
        const [oldId] = lowestPriority[0];
        this.context.activeToasts.delete(oldId);
      }
    }

    this.context.activeToasts.set(toast.id, toast);
  }

  private shouldReplaceExistingToast(toast: ToastContext): boolean {
    if (toast.category) {
      const existingInCategory = Array.from(this.context.activeToasts.entries())
        .filter(([_, t]) => t.category === toast.category);

      return existingInCategory.length > 0;
    }

    return false;
  }

  private addToQueue(toast: ToastContext): void {
    const queuedToast: QueuedToast = {
      ...toast,
      queuedAt: Date.now()
    };

    // Insert in priority order (highest first)
    this.context.queue.push(queuedToast);
    this.context.queue.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  private processQueue(): void {
    while (this.context.activeToasts.size < this.context.maxActive && 
           this.context.queue.length > 0) {
      const nextToast = this.context.queue.shift()!;

      // Check category limits again
      if (nextToast.category) {
        const categoryLimit = this.context.categoryLimits.get(nextToast.category) || Infinity;
        const categoryCount = Array.from(this.context.activeToasts.values())
          .filter(t => t.category === nextToast.category).length;

        if (categoryCount >= categoryLimit) {
          continue; // Skip this toast, try next
        }
      }

      // Add to active toasts
      this.addActiveToast(nextToast);
      break; // Process one at a time
    }
  }

  private updateState(): void {
    const activeCount = this.context.activeToasts.size;
    const queueCount = this.context.queue.length;

    if (activeCount === 0 && queueCount === 0) {
      this.state = 'idle';
    } else if (activeCount > 0 && queueCount === 0) {
      this.state = 'displaying';
    } else {
      this.state = 'queuing';
    }
  }

  private startProcessingTimer(): void {
    this.processingTimer = setInterval(() => {
      if (this.context.queue.length > 0 && 
          this.context.activeToasts.size < this.context.maxActive) {
        this.send({ type: 'PROCESS_QUEUE' });
      }
    }, 500);
  }

  // Cleanup
  destroy(): void {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
      this.processingTimer = null;
    }
    // Clear all listeners (access private property through any cast)
    (this as any).listeners.clear();
  }
}

// Service class to manage the state machine
export class ToastService {
  private machine: SimpleToastMachine;
  private callbacks: Map<string, Function> = new Map();

  constructor() {
    this.machine = new SimpleToastMachine();

    // Set up state change listeners
    this.machine.on('stateChange', (state: any) => {
      this.callbacks.forEach(callback => callback(state));
    });

    this.machine.on('contextUpdate', (context: any) => {
      // Trigger callbacks for reactive updates
      this.callbacks.forEach(callback => callback({
        state: this.machine.getState(),
        context
      }));
    });
  }

  // Public API
  showToast(toast: Omit<ToastContext, 'id' | 'createdAt'>): string {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const toastWithId = { ...toast, id, createdAt: Date.now() };
    this.machine.send({ type: 'SHOW', toast: toastWithId });
    return id;
  }

  updateToast(id: string, updates: Partial<ToastContext>): void {
    this.machine.send({ type: 'UPDATE', id, updates });
  }

  dismissToast(id: string): void {
    this.machine.send({ type: 'DISMISS', id });
  }

  dismissCategory(category: string): void {
    this.machine.send({ type: 'DISMISS_CATEGORY', category });
  }

  clearAll(): void {
    this.machine.send({ type: 'CLEAR_ALL' });
  }

  // Get current state
  getActiveToasts(): ToastContext[] {
    return this.machine.getActiveToasts();
  }

  getQueueLength(): number {
    return this.machine.getQueueLength();
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
      priority: 5 
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
      priority: 7 
    });
  }

  showInfo(title: string, message?: string, category?: string): string {
    return this.showToast({ 
      type: 'info', 
      title, 
      message, 
      category,
      priority: 3 
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
      priority: 5
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

  // Cleanup
  destroy(): void {
    this.machine.destroy();
    this.callbacks.clear();
  }
}

// Global instance
export const toastService = new ToastService();
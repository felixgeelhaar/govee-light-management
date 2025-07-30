/**
 * Advanced caching service for performance optimization
 * Implements intelligent caching with TTL, LRU eviction, and memory management
 */

export interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
  accessCount: number
  lastAccessed: number
}

export interface CacheOptions {
  ttl?: number // Time to live in milliseconds
  maxSize?: number // Maximum number of entries
  maxMemory?: number // Maximum memory usage in bytes (approximate)
}

export interface CacheStats {
  entries: number
  hitRate: number
  missRate: number
  memoryUsage: number
  oldestEntry: number
  newestEntry: number
}

/**
 * High-performance cache service with LRU eviction and TTL support
 */
export class CacheService {
  private cache = new Map<string, CacheEntry<any>>()
  private accessQueue: string[] = [] // For LRU tracking
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalRequests: 0
  }

  // Default options
  private options: Required<CacheOptions> = {
    ttl: 5 * 60 * 1000, // 5 minutes default TTL
    maxSize: 100, // Max 100 entries
    maxMemory: 10 * 1024 * 1024 // 10MB approximation
  }

  constructor(options?: CacheOptions) {
    if (options) {
      this.options = { ...this.options, ...options }
    }

    // Periodic cleanup every 2 minutes
    setInterval(() => this.cleanup(), 2 * 60 * 1000)
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    this.stats.totalRequests++

    const entry = this.cache.get(key)
    
    if (!entry) {
      this.stats.misses++
      return null
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.cache.delete(key)
      this.removeFromQueue(key)
      this.stats.misses++
      return null
    }

    // Update access tracking
    entry.accessCount++
    entry.lastAccessed = Date.now()
    this.updateAccessQueue(key)
    this.stats.hits++

    return entry.data as T
  }

  /**
   * Set value in cache
   */
  set<T>(key: string, value: T, customTtl?: number): void {
    const ttl = customTtl || this.options.ttl
    const now = Date.now()

    const entry: CacheEntry<T> = {
      data: value,
      timestamp: now,
      ttl,
      accessCount: 1,
      lastAccessed: now
    }

    // Check if we need to evict entries
    this.evictIfNeeded()

    this.cache.set(key, entry)
    this.updateAccessQueue(key)
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)
    return entry !== undefined && !this.isExpired(entry)
  }

  /**
   * Delete specific key
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key)
    if (deleted) {
      this.removeFromQueue(key)
    }
    return deleted
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
    this.accessQueue = []
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entries = this.cache.size
    const hitRate = this.stats.totalRequests > 0 
      ? (this.stats.hits / this.stats.totalRequests) * 100 
      : 0
    const missRate = 100 - hitRate

    let oldestEntry = Date.now()
    let newestEntry = 0
    let memoryUsage = 0

    this.cache.forEach(entry => {
      oldestEntry = Math.min(oldestEntry, entry.timestamp)
      newestEntry = Math.max(newestEntry, entry.timestamp)
      // Rough memory estimation
      memoryUsage += JSON.stringify(entry.data).length * 2 // UTF-16 chars
    })

    return {
      entries,
      hitRate: Number(hitRate.toFixed(2)),
      missRate: Number(missRate.toFixed(2)),
      memoryUsage,
      oldestEntry,
      newestEntry
    }
  }

  /**
   * Get or set with fallback function
   */
  async getOrSet<T>(
    key: string, 
    fallbackFn: () => Promise<T>, 
    customTtl?: number
  ): Promise<T> {
    // Try to get from cache first
    const cached = this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    // Execute fallback function
    try {
      const value = await fallbackFn()
      this.set(key, value, customTtl)
      return value
    } catch (error) {
      // Don't cache errors, just throw
      throw error
    }
  }

  /**
   * Invalidate entries matching pattern
   */
  invalidatePattern(pattern: string | RegExp): number {
    const regex = typeof pattern === 'string' 
      ? new RegExp(pattern.replace(/\*/g, '.*'))
      : pattern

    let invalidated = 0
    const keysToDelete: string[] = []

    this.cache.forEach((_, key) => {
      if (regex.test(key)) {
        keysToDelete.push(key)
      }
    })

    keysToDelete.forEach(key => {
      if (this.delete(key)) {
        invalidated++
      }
    })

    return invalidated
  }

  /**
   * Update TTL for existing entry
   */
  touch(key: string, newTtl?: number): boolean {
    const entry = this.cache.get(key)
    if (!entry || this.isExpired(entry)) {
      return false
    }

    entry.ttl = newTtl || this.options.ttl
    entry.timestamp = Date.now() // Reset timestamp
    entry.lastAccessed = Date.now()
    this.updateAccessQueue(key)

    return true
  }

  /**
   * Get all keys (excluding expired ones)
   */
  keys(): string[] {
    const validKeys: string[] = []
    
    this.cache.forEach((entry, key) => {
      if (!this.isExpired(entry)) {
        validKeys.push(key)
      }
    })

    return validKeys
  }

  /**
   * Get cache size in entries
   */
  size(): number {
    return this.cache.size
  }

  /**
   * Check if cache is approaching limits
   */
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical'
    sizeUsage: number
    memoryUsage: number
    hitRate: number
    size: number
    recommendations: string[]
  } {
    const stats = this.getStats()
    const sizeUsage = (stats.entries / this.options.maxSize) * 100
    const memoryUsage = (stats.memoryUsage / this.options.maxMemory) * 100
    
    const recommendations: string[] = []
    let status: 'healthy' | 'warning' | 'critical' = 'healthy'

    if (sizeUsage > 90) {
      status = 'critical'
      recommendations.push('Cache size critical - consider increasing maxSize or reducing TTL')
    } else if (sizeUsage > 75) {
      status = 'warning'
      recommendations.push('Cache size approaching limit')
    }

    if (memoryUsage > 90) {
      status = 'critical'
      recommendations.push('Memory usage critical - consider reducing cache size')
    } else if (memoryUsage > 75) {
      status = 'warning'
      recommendations.push('Memory usage high')
    }

    if (stats.hitRate < 50 && this.stats.totalRequests > 100) {
      recommendations.push('Low hit rate - consider adjusting TTL or cache strategy')
    }

    return {
      status,
      sizeUsage: Number(sizeUsage.toFixed(2)),
      memoryUsage: Number(memoryUsage.toFixed(2)),
      hitRate: Number(stats.hitRate.toFixed(2)),
      size: stats.entries,
      recommendations
    }
  }

  /**
   * Private helper methods
   */
  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl
  }

  private updateAccessQueue(key: string): void {
    // Remove from current position
    this.removeFromQueue(key)
    // Add to end (most recently used)
    this.accessQueue.push(key)
  }

  private removeFromQueue(key: string): void {
    const index = this.accessQueue.indexOf(key)
    if (index !== -1) {
      this.accessQueue.splice(index, 1)
    }
  }

  private evictIfNeeded(): void {
    // Check size limit
    while (this.cache.size >= this.options.maxSize && this.accessQueue.length > 0) {
      const lruKey = this.accessQueue.shift()
      if (lruKey) {
        this.cache.delete(lruKey)
        this.stats.evictions++
      }
    }

    // Check memory limit (approximate)
    const stats = this.getStats()
    while (stats.memoryUsage > this.options.maxMemory && this.accessQueue.length > 0) {
      const lruKey = this.accessQueue.shift()
      if (lruKey) {
        this.cache.delete(lruKey)
        this.stats.evictions++
      }
    }
  }

  private cleanup(): void {
    const keysToDelete: string[] = []
    
    this.cache.forEach((entry, key) => {
      if (this.isExpired(entry)) {
        keysToDelete.push(key)
      }
    })

    keysToDelete.forEach(key => {
      this.cache.delete(key)
      this.removeFromQueue(key)
    })

    if (keysToDelete.length > 0) {
      console.log(`Cache cleanup: removed ${keysToDelete.length} expired entries`)
    }
  }
}

/**
 * Specialized cache for API responses
 */
export class ApiCacheService extends CacheService {
  constructor() {
    super({
      ttl: 2 * 60 * 1000, // 2 minutes for API responses
      maxSize: 50,
      maxMemory: 5 * 1024 * 1024 // 5MB
    })
  }

  /**
   * Cache API key validation results
   */
  cacheApiKeyValidation(apiKey: string, isValid: boolean): void {
    const keyHash = this.hashApiKey(apiKey)
    this.set(`apikey:${keyHash}`, isValid, 10 * 60 * 1000) // 10 minutes
  }

  /**
   * Get cached API key validation
   */
  getCachedApiKeyValidation(apiKey: string): boolean | null {
    const keyHash = this.hashApiKey(apiKey)
    return this.get<boolean>(`apikey:${keyHash}`)
  }

  /**
   * Cache lights for an API key
   */
  cacheLights(apiKey: string, lights: any[]): void {
    const keyHash = this.hashApiKey(apiKey)
    this.set(`lights:${keyHash}`, lights, 5 * 60 * 1000) // 5 minutes
  }

  /**
   * Get cached lights
   */
  getCachedLights(apiKey: string): any[] | null {
    const keyHash = this.hashApiKey(apiKey)
    return this.get<any[]>(`lights:${keyHash}`)
  }

  /**
   * Cache groups for an API key
   */
  cacheGroups(apiKey: string, groups: any[]): void {
    const keyHash = this.hashApiKey(apiKey)
    this.set(`groups:${keyHash}`, groups, 3 * 60 * 1000) // 3 minutes
  }

  /**
   * Get cached groups
   */
  getCachedGroups(apiKey: string): any[] | null {
    const keyHash = this.hashApiKey(apiKey)
    return this.get<any[]>(`groups:${keyHash}`)
  }

  /**
   * Invalidate all cache entries for an API key
   */
  invalidateApiKey(apiKey: string): void {
    const keyHash = this.hashApiKey(apiKey)
    this.invalidatePattern(`*:${keyHash}`)
  }

  /**
   * Simple hash function for API keys (for cache keys only, not security)
   */
  private hashApiKey(apiKey: string): string {
    let hash = 0
    for (let i = 0; i < apiKey.length; i++) {
      const char = apiKey.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
  }
}

/**
 * Singleton instances
 */
export const cacheService = new CacheService()
export const apiCacheService = new ApiCacheService()
/**
 * AURORA Shared Memory Service
 * Manages short-term conversational context, task trace logs, and long-term organizational memory.
 */
class SharedMemoryService {
  private shortTermMemory: Map<string, any> = new Map()
  private longTermLogs: Array<{ timestamp: string; tag: string; data: any }> = []

  public setContext(key: string, value: any) {
    this.shortTermMemory.set(key, value)
  }

  public getContext(key: string): any {
    return this.shortTermMemory.get(key)
  }

  public logEvent(tag: string, data: any) {
    this.longTermLogs.push({
      timestamp: new Date().toISOString(),
      tag,
      data,
    })
    if (this.longTermLogs.length > 1000) this.longTermLogs.shift()
  }

  public getLogs(limit = 50) {
    return this.longTermLogs.slice(-limit).reverse()
  }
}

export const sharedMemoryService = new SharedMemoryService()

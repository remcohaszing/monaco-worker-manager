import { type editor, type IDisposable, type Uri } from 'monaco-editor'

/**
 * Change each callback of the type param to a promisified version.
 */
export type PromisifiedWorker<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<Awaited<R>>
    : never
}

/**
 * A function for getting the worker client proxy with synchronized resources.
 *
 * @param args
 *   The resource uris to synchronize.
 * @returns
 *   The worker client proxy.
 */
export type WorkerGetter<T> = (...args: Uri[]) => Promise<PromisifiedWorker<T>>

export interface WorkerManagerOptions<C> {
  /**
   * The data to send over when creating the worker.
   */
  createData?: C

  /**
   * How often to check if a worker is idle in milliseconds.
   *
   * @default 30_000 // 30 seconds
   */
  interval?: number

  /**
   * A label to be used to identify the web worker.
   */
  label: string

  /**
   * The module to be used to identify the web worker.
   */
  moduleId: string

  /**
   * The worker is stopped after this time has passed in milliseconds.
   *
   * Set to Infinity to never stop the worker.
   *
   * @default 120_000 // 2 minutes
   */
  stopWhenIdleFor?: number
}

export interface WorkerManager<T, C = unknown> extends IDisposable {
  /**
   * A function for getting the worker client proxy with synchronized resources.
   *
   * @param args
   *   The resource uris to synchronize.
   * @returns
   *   The worker client proxy.
   */
  getWorker: WorkerGetter<T>

  /**
   * Reload the worker with new create data.
   */
  updateCreateData: (createData: C) => unknown
}

/**
 * Create a worker manager.
 *
 * A worker manager is an object which deals with Monaco based web workers, such as cleanups and
 * idle timeouts.
 *
 * @param monaco
 *   The Monaco editor module.
 * @param options
 *   The options of the worker manager.
 * @returns
 *   The worker manager.
 */
export function createWorkerManager<T, C = unknown>(
  monaco: Pick<typeof import('monaco-editor'), 'editor'>,
  options: WorkerManagerOptions<C>
): WorkerManager<T, C> {
  let { createData, interval = 30_000, label, moduleId, stopWhenIdleFor = 120_000 } = options
  let worker: editor.MonacoWebWorker<PromisifiedWorker<T>> | undefined
  let lastUsedTime = 0
  let disposed = false

  const stopWorker = (): undefined => {
    if (worker) {
      worker.dispose()
      worker = undefined
    }
  }

  const intervalId = setInterval(() => {
    if (!worker) {
      return
    }

    const timePassedSinceLastUsed = Date.now() - lastUsedTime
    if (timePassedSinceLastUsed > stopWhenIdleFor) {
      stopWorker()
    }
  }, interval)

  return {
    dispose() {
      disposed = true
      clearInterval(intervalId)
      stopWorker()
    },

    getWorker(...resources) {
      if (disposed) {
        throw new Error('Worker manager has been disposed')
      }
      lastUsedTime = Date.now()

      worker ||= monaco.editor.createWebWorker<PromisifiedWorker<T>>({
        createData,
        label,
        moduleId
      })

      return worker.withSyncedResources(resources)
    },

    updateCreateData(newCreateData) {
      createData = newCreateData
      stopWorker()
    }
  }
}

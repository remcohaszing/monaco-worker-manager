import { type worker } from 'monaco-editor'
import { initialize as initializeWorker } from 'monaco-editor/esm/vs/editor/editor.worker.js'

/**
 * Change each callback of the type param to a promisified version.
 */
export type WorkerImplementation<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => Awaited<R> | PromiseLike<Awaited<R>>
    : never
}

/**
 * A function for initializing a web worker.
 */
export type WebWorkerInitializeFunction<T, C = unknown> = (
  ctx: worker.IWorkerContext,
  createData: C
) => WorkerImplementation<T>

/**
 * Create a web worker proxy.
 *
 * @param fn
 *   The function that creates the web worker.
 */
export function initialize<T, C = unknown>(fn: WebWorkerInitializeFunction<T, C>): undefined {
  globalThis.onmessage = () => {
    initializeWorker<C>((ctx, createData) => Object.create(fn(ctx, createData)))
  }
}

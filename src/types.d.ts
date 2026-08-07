declare module 'monaco-editor/editor/editor.worker.js' {
  import type { worker } from 'monaco-editor'

  export function initialize<C>(fn: (ctx: worker.IWorkerContext, createData: C) => unknown): unknown
}

declare module 'monaco-editor/esm/vs/editor/editor.worker.js' {
  import { type worker } from 'monaco-editor/esm/vs/editor/editor.api.js'

  export function initialize<C>(fn: (ctx: worker.IWorkerContext, createData: C) => unknown): unknown
}

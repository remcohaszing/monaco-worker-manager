import { initialize } from 'monaco-worker-manager/worker'

export interface CreateData {
  data: string
}

export interface TestWorker {
  getCreateData: () => CreateData
  getValue: (uri: string) => string | undefined
  greet: (name: string) => string
}

initialize<TestWorker, CreateData>((ctx, options) => ({
  getCreateData: () => options,
  getValue(uri) {
    for (const model of ctx.getMirrorModels()) {
      if (uri === String(model.uri)) {
        return model.getValue()
      }
    }
  },
  greet: (name) => `Hello, ${name}`
}))

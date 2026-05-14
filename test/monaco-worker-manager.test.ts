import type { Mock } from 'vitest'

import type { CreateData, TestWorker } from './test.worker.js'

import * as monaco from 'monaco-editor'
import { createWorkerManager } from 'monaco-worker-manager'
import { afterEach, expect, test, vi } from 'vitest'

// eslint-disable-next-line unicorn/prefer-global-this
window.MonacoEnvironment = {
  getWorker(workerId, label) {
    switch (label) {
      case 'editorWorker':
        return new Worker(new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url))
      case 'test':
        return new Worker(new URL('test.worker.ts', import.meta.url), { type: 'module' })
      default:
        throw new Error(`Unknown worker label: ${label}`)
    }
  }
}

afterEach(() => {
  vi.useRealTimers()
})

test('call worker', async (context) => {
  const workerManager = createWorkerManager<TestWorker>(monaco, {
    label: 'test',
    moduleId: 'test/test'
  })
  context.onTestFinished(() => workerManager.dispose())

  const worker = await workerManager.getWorker()
  const greeting = await worker.greet('client')
  expect(greeting).toBe('Hello, client')
})

test('synchronize resources', async (context) => {
  const workerManager = createWorkerManager<TestWorker>(monaco, {
    label: 'test',
    moduleId: 'test/test'
  })
  context.onTestFinished(() => workerManager.dispose())

  const uri = monaco.Uri.parse('test://synchronized')
  const model = monaco.editor.createModel('Model content', undefined, uri)
  context.onTestFinished(() => model.dispose())

  const worker = await workerManager.getWorker(uri)
  const greeting = await worker.getValue(String(uri))
  expect(greeting).toBe('Model content')
})

test('initial create data', async (context) => {
  const workerManager = createWorkerManager<TestWorker, CreateData>(monaco, {
    label: 'test',
    moduleId: 'test/test',
    createData: { data: 'test' }
  })
  context.onTestFinished(() => workerManager.dispose())

  const worker = await workerManager.getWorker()
  const data = await worker.getCreateData()
  expect(data).toStrictEqual({ data: 'test' })
})

test('update create data', async (context) => {
  const workerManager = createWorkerManager<TestWorker, CreateData>(monaco, {
    label: 'test',
    moduleId: 'test/test',
    createData: { data: 'old' }
  })
  context.onTestFinished(() => workerManager.dispose())

  workerManager.updateCreateData({ data: 'new' })
  const worker = await workerManager.getWorker()
  const data = await worker.getCreateData()
  expect(data).toStrictEqual({ data: 'new' })
})

test('get worker after disposed', () => {
  const workerManager = createWorkerManager<TestWorker>(monaco, {
    label: 'test',
    moduleId: 'test/test'
  })
  workerManager.dispose()

  expect(() => workerManager.getWorker()).toThrow(new Error('Worker manager has been disposed'))
})

test('dispose idle worker', async (context) => {
  vi.useFakeTimers()
  const { createWebWorker } = monaco.editor
  let disposeWorker: Mock<() => void> | undefined
  let callCount = 0
  vi.spyOn(monaco.editor, 'createWebWorker').mockImplementation((options) => {
    const worker = createWebWorker(options)
    if (options.label === 'test') {
      callCount += 1
      disposeWorker = vi.spyOn(worker, 'dispose')
    }
    return worker
  })

  const workerManager = createWorkerManager<TestWorker>(monaco, {
    label: 'test',
    moduleId: 'test/test'
  })
  context.onTestFinished(() => workerManager.dispose())

  expect(callCount).toBe(0)
  await workerManager.getWorker()
  expect(callCount).toBe(1)

  expect(disposeWorker).not.toHaveBeenCalled()
  vi.advanceTimersByTime(60_000)
  expect(disposeWorker).not.toHaveBeenCalled()
  vi.advanceTimersByTime(120_000)
  expect(disposeWorker).toHaveBeenCalled()

  await workerManager.getWorker()
  expect(callCount).toBe(2)
})

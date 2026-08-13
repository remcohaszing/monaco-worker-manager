import type { Mock } from 'vitest'

import type { CreateData, TestWorker } from './test.worker.js'

import * as monaco from 'monaco-editor'
import { createWorkerManager } from 'monaco-worker-manager'
import { d } from 'proxy-disposable'
import { afterEach, expect, test, vi } from 'vitest'

globalThis.MonacoEnvironment = {
  getWorker(workerId, label) {
    switch (label) {
      case 'editorWorker':
        return new Worker(new URL('monaco-editor/editor/editor.worker.js', import.meta.url))
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

test('call worker', async () => {
  using workerManager = d(
    createWorkerManager<TestWorker>(monaco, {
      label: 'test',
      moduleId: 'test/test'
    })
  )

  const worker = await workerManager.getWorker()
  const greeting = await worker.greet('client')
  expect(greeting).toBe('Hello, client')
})

test('synchronize resources', async () => {
  using workerManager = d(
    createWorkerManager<TestWorker>(monaco, {
      label: 'test',
      moduleId: 'test/test'
    })
  )

  const uri = monaco.Uri.parse('test://synchronized')
  using model = d(monaco.editor.createModel('Model content', undefined, uri))

  const worker = await workerManager.getWorker(uri)
  const greeting = await worker.getValue(String(uri))
  expect(greeting).toBe('Model content')
})

test('initial create data', async () => {
  using workerManager = d(
    createWorkerManager<TestWorker, CreateData>(monaco, {
      label: 'test',
      moduleId: 'test/test',
      createData: { data: 'test' }
    })
  )

  const worker = await workerManager.getWorker()
  const data = await worker.getCreateData()
  expect(data).toStrictEqual({ data: 'test' })
})

test('update create data', async () => {
  using workerManager = d(
    createWorkerManager<TestWorker, CreateData>(monaco, {
      label: 'test',
      moduleId: 'test/test',
      createData: { data: 'old' }
    })
  )

  workerManager.updateCreateData({ data: 'new' })
  const worker = await workerManager.getWorker()
  const data = await worker.getCreateData()
  expect(data).toStrictEqual({ data: 'new' })
})

test('missing MonacoEnvironment.getWorker', () => {
  const { MonacoEnvironment } = globalThis
  globalThis.MonacoEnvironment = {}

  try {
    using workerManager = d(
      createWorkerManager<TestWorker>(monaco, {
        label: 'test',
        moduleId: 'test/test'
      })
    )

    expect(() => workerManager.getWorker()).toThrow(
      new Error('You must define a function MonacoEnvironment.getWorker')
    )
  } finally {
    globalThis.MonacoEnvironment = MonacoEnvironment
  }
})

test('get worker after disposed', () => {
  const workerManager = createWorkerManager<TestWorker>(monaco, {
    label: 'test',
    moduleId: 'test/test'
  })
  workerManager.dispose()

  expect(() => workerManager.getWorker()).toThrow(new Error('Worker manager has been disposed'))
})

test('dispose idle worker', async () => {
  vi.useFakeTimers()
  const { createWebWorker } = monaco.editor
  let disposeWorker: Mock<() => void> | undefined
  let callCount = 0
  vi.spyOn(monaco.editor, 'createWebWorker').mockImplementation((options) => {
    const worker = createWebWorker(options)
    callCount += 1
    disposeWorker = vi.spyOn(worker, 'dispose')
    return worker
  })

  using workerManager = d(
    createWorkerManager<TestWorker>(monaco, {
      label: 'test',
      moduleId: 'test/test'
    })
  )

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

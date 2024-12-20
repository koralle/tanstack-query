import { describe, expect, test } from 'vitest'
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  signal,
} from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { setFixtureSignalInputs } from '../../test-utils'
import { lazyInit } from '../../../util/lazy-init/lazy-init'
import type { WritableSignal } from '@angular/core'

describe('lazyInit', () => {
  test('should init lazily in next tick when not accessing manually', async () => {
    const mockFn = vi.fn()

    TestBed.runInInjectionContext(() => {
      lazyInit(() => {
        mockFn()
        return {
          data: signal(true),
        }
      })
    })

    expect(mockFn).not.toHaveBeenCalled()

    await new Promise(setImmediate)

    expect(mockFn).toHaveBeenCalled()
  })

  test('should init eagerly accessing manually', async () => {
    const mockFn = vi.fn()

    TestBed.runInInjectionContext(() => {
      const lazySignal = lazyInit(() => {
        mockFn()
        return {
          data: signal(true),
        }
      })

      lazySignal.data()
    })

    expect(mockFn).toHaveBeenCalled()
  })

  test('should init lazily and only once', async () => {
    const initCallFn = vi.fn()
    const registerDataValue = vi.fn<(arg: number) => any>()

    let value!: { data: WritableSignal<number> }
    const outerSignal = signal(0)

    TestBed.runInInjectionContext(() => {
      value = lazyInit(() => {
        initCallFn()

        void outerSignal()

        return { data: signal(0) }
      })

      effect(() => registerDataValue(value.data()))
    })

    value.data()

    expect(outerSignal).toBeDefined()

    expect(initCallFn).toHaveBeenCalledTimes(1)

    outerSignal.set(1)

    TestBed.flushEffects()

    outerSignal.set(2)
    value.data.set(4)
    TestBed.flushEffects()

    expect(initCallFn).toHaveBeenCalledTimes(1)
    expect(registerDataValue).toHaveBeenCalledTimes(2)
  })

  test('should support required signal input', async () => {
    @Component({
      standalone: true,
      template: `{{ call }} - {{ lazySignal.data() }}`,
      changeDetection: ChangeDetectionStrategy.OnPush,
    })
    class Test {
      readonly title = input.required<string>()
      call = 0

      lazySignal = lazyInit(() => {
        this.call++
        return {
          data: computed(() => this.title()),
        }
      })
    }

    const fixture = TestBed.createComponent(Test)

    setFixtureSignalInputs(fixture, { title: 'newValue' })
    expect(fixture.debugElement.nativeElement.textContent).toBe('0 - newValue')

    setFixtureSignalInputs(fixture, { title: 'updatedValue' })
    expect(fixture.debugElement.nativeElement.textContent).toBe(
      '1 - updatedValue',
    )

    setFixtureSignalInputs(fixture, { title: 'newUpdatedValue' })
    expect(fixture.debugElement.nativeElement.textContent).toBe(
      '1 - newUpdatedValue',
    )
  })
})

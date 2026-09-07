import { setImmediate } from 'node:timers/promises';
import { VitestTestRunner } from 'vitest/runners';

// Vitest installs its RPC delegate after constructing the runner. Install our
// observer at the public file hook, not in the constructor or original update
// hook (neither receives the actual acknowledgement promise).
export default class CooperativeVitestRunner extends VitestTestRunner {
  #installed = false;
  #pending = new Set();
  #cancelled = false;

  onBeforeRunFiles(...args) {
    if (!this.#installed) {
      const delegate = this.onTaskUpdate;
      if (typeof delegate !== 'function') {
        throw new Error('Vitest task-update delegate is not installed');
      }
      const pending = this.#pending;
      this.onTaskUpdate = function (...updateArgs) {
        const acknowledgement = delegate.apply(this, updateArgs);
        pending.add(acknowledgement);
        // Retain rejected promises: neither later attempts nor the final drain
        // may silently turn a failed acknowledgement into success. The rejection
        // handler avoids manufacturing an extra unhandled child promise.
        acknowledgement.then(
          () => { pending.delete(acknowledgement); },
          () => {},
        );
        return acknowledgement;
      };
      this.#installed = true;
    }
    return super.onBeforeRunFiles?.(...args);
  }

  async onBeforeTryTask(task, ...args) {
    // Native scheduling survives fake clocks; settlement, not this single
    // yield, is the barrier. Drain updates that arrive during another ACK too.
    await setImmediate();
    while (this.#pending.size > 0) {
      await Promise.all([...this.#pending]);
    }
    // Vitest already checked cancellation before this async boundary. Use its
    // public skip mechanism if cancellation arrived while we were waiting.
    if (this.#cancelled) task.context.skip('Run cancelled while awaiting task updates');
    return super.onBeforeTryTask(task, ...args);
  }

  cancel(...args) {
    this.#cancelled = true;
    return super.cancel(...args);
  }

  async onAfterRunTask(task) {
    await super.onAfterRunTask(task);
    await setImmediate();
  }
}

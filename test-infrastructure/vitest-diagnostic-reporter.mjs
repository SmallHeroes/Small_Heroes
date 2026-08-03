import { writeSync } from 'node:fs';

import {
  classifyVitestDiagnostic,
  VITEST_DIAGNOSTIC_SCHEMA,
} from './vitest-diagnostics.mjs';

const REPORTER_SCHEMA = 'small-heroes-vitest-reporter-diagnostic/v1';
const MAX_ERRORS_PER_EVENT = 1_024;
const MAX_TASK_UPDATE_CALLS = 1_000_000;

function defaultWriter(line) {
  const fd = Number.parseInt(
    process.env.SMALL_HEROES_VITEST_DIAGNOSTIC_FD ?? '',
    10,
  );
  if (fd !== 3) {
    throw new Error('Vitest diagnostic fd is not configured');
  }
  writeSync(fd, line);
}

function defaultPhase() {
  const phase = process.env.SMALL_HEROES_VITEST_PHASE;
  if (phase !== 'ordinary' && phase !== 'resource_intensive') {
    throw new Error('Vitest diagnostic phase is not configured');
  }
  return phase;
}

export class SanitizedVitestDiagnosticReporter {
  constructor(options = {}) {
    this.phase = options.phase ?? defaultPhase();
    this.write = options.write ?? defaultWriter;
    this.classes = new Set();
    this.taskUpdateCalls = 0;
    this.processTimeout = false;
  }

  observe(value) {
    for (const classId of classifyVitestDiagnostic(value)) {
      this.classes.add(classId);
    }
  }

  observeErrors(errors) {
    if (!Array.isArray(errors)) {
      return;
    }
    const limit = Math.min(errors.length, MAX_ERRORS_PER_EVENT);
    for (let index = 0; index < limit; index += 1) {
      this.observe(errors[index]);
    }
    if (errors.length > MAX_ERRORS_PER_EVENT) {
      this.classes.add('diagnostic_protocol_failure');
    }
  }

  onTaskUpdate(packs) {
    this.taskUpdateCalls = Math.min(
      MAX_TASK_UPDATE_CALLS,
      this.taskUpdateCalls + 1,
    );
    if (!Array.isArray(packs)) {
      this.classes.add('diagnostic_protocol_failure');
      return;
    }
    for (const pack of packs.slice(0, MAX_ERRORS_PER_EVENT)) {
      const result = Array.isArray(pack) ? pack[1] : undefined;
      this.observeErrors(result?.errors);
    }
    if (packs.length > MAX_ERRORS_PER_EVENT) {
      this.classes.add('diagnostic_protocol_failure');
    }
  }

  onTestRunEnd(_testModules, unhandledErrors, reason) {
    this.observeErrors(unhandledErrors);
    this.emit('run_end', reason);
  }

  onProcessTimeout() {
    this.processTimeout = true;
    this.classes.add('teardown_or_termination_failure');
    this.emit('process_timeout', 'interrupted');
  }

  emit(event, reason) {
    const evidence = {
      schemaVersion: REPORTER_SCHEMA,
      taxonomyVersion: VITEST_DIAGNOSTIC_SCHEMA,
      event,
      phase: this.phase,
      runReason:
        reason === 'passed' || reason === 'failed' || reason === 'interrupted'
          ? reason
          : 'unknown',
      taskUpdateCalls: this.taskUpdateCalls,
      processTimeout: this.processTimeout,
      classes: [...this.classes].sort(),
    };
    this.write(`${JSON.stringify(evidence)}\n`);
  }
}

export default SanitizedVitestDiagnosticReporter;

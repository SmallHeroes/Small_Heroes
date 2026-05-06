type LogLevel = 'info' | 'warn' | 'error';

type LogFields = Record<string, unknown>;

type LoggerContext = {
  subsystem: string;
  route?: string;
};

function serializeError(error: unknown): LogFields {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
    };
  }
  return { errorMessage: String(error) };
}

function emit(level: LogLevel, message: string, context: LoggerContext, fields: LogFields = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    subsystem: context.subsystem,
    route: context.route,
    message,
    ...fields,
  };
  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.log(line);
}

export function createLogger(context: LoggerContext) {
  return {
    info(message: string, fields: LogFields = {}) {
      emit('info', message, context, fields);
    },
    warn(message: string, fields: LogFields = {}) {
      emit('warn', message, context, fields);
    },
    error(message: string, error?: unknown, fields: LogFields = {}) {
      emit('error', message, context, {
        ...fields,
        ...(error === undefined ? {} : serializeError(error)),
      });
    },
  };
}

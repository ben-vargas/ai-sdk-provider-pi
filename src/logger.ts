import type { Logger } from './types.js';

const NOOP = () => {
  // Intentionally empty logger for silent mode.
};

function bindLogger(logger: Logger): Logger {
  return {
    debug: logger.debug.bind(logger),
    info: logger.info.bind(logger),
    warn: logger.warn.bind(logger),
    error: logger.error.bind(logger),
  };
}

export function getLogger(logger?: Logger | false): Logger {
  if (logger === false) {
    return {
      debug: NOOP,
      info: NOOP,
      warn: NOOP,
      error: NOOP,
    };
  }

  if (logger == null) {
    return {
      debug: console.debug.bind(console),
      info: console.info.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
    };
  }

  return bindLogger(logger);
}

export function createVerboseLogger(logger: Logger, verbose: boolean): Logger {
  if (verbose) {
    return logger;
  }

  return {
    debug: NOOP,
    info: NOOP,
    warn: logger.warn.bind(logger),
    error: logger.error.bind(logger),
  };
}

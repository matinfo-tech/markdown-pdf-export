/**
 * @fileoverview Tiny terminal colours, no dependency. On only for a TTY;
 * NO_COLOR turns it off, FORCE_COLOR (≠ "0") turns it on. See no-color.org.
 */

/**
 * @param {{stream?: {isTTY?: boolean}, env?: NodeJS.ProcessEnv}} [opts]
 */
export function makeStyle({ stream = process.stdout, env = process.env } = {}) {
  const enabled = env.FORCE_COLOR
    ? env.FORCE_COLOR !== "0"
    : !env.NO_COLOR && Boolean(stream.isTTY) && env.TERM !== "dumb";
  const wrap = (open, close) => (text) =>
    enabled ? `\x1b[${open}m${text}\x1b[${close}m` : String(text);
  return {
    enabled,
    bold: wrap(1, 22),
    dim: wrap(2, 22),
    red: wrap(31, 39),
    green: wrap(32, 39),
    yellow: wrap(33, 39),
    cyan: wrap(36, 39),
  };
}

/** No colours: for tests, JSON, logs. */
export const plain = makeStyle({ stream: {}, env: { NO_COLOR: "1" } });

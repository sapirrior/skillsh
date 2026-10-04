const isColorSupported =
  !("NO_COLOR" in process.env) &&
  (process.stdout.isTTY || process.env.FORCE_COLOR === "1" || process.env.COLORTERM !== undefined);

function code(open: number, close: number) {
  return (str: string) =>
    isColorSupported ? `\x1b[${open}m${str}\x1b[${close}m` : str;
}

export const c = {
  reset: isColorSupported ? "\x1b[0m" : "",
  bold: code(1, 22),
  dim: code(2, 22),
  italic: code(3, 23),
  underline: code(4, 24),
  red: code(31, 39),
  green: code(32, 39),
  yellow: code(33, 39),
  blue: code(34, 39),
  magenta: code(35, 39),
  cyan: code(36, 39),
  gray: code(90, 39),
  brightCyan: code(96, 39),
  brightMagenta: code(95, 39),
  brightGreen: code(92, 39),
  brightRed: code(91, 39),
};

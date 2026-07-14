/**
 * Logger — Journalisation simple avec niveaux.
 */
export class Logger {
  #prefix;
  constructor(prefix = 'DagoSpeak') {
    this.#prefix = prefix;
  }
  info(...args)  { console.log(`[${this.#prefix}]`, ...args); }
  warn(...args)  { console.warn(`[${this.#prefix}]`, ...args); }
  error(...args) { console.error(`[${this.#prefix}]`, ...args); }
  debug(...args) { if (location.hostname === 'localhost') console.debug(`[${this.#prefix}]`, ...args); }
}
/**
 * Registers the .ts extension resolver hook (see _ts-resolve.mjs) so the
 * Telegram generation scripts run under `node --experimental-strip-types`.
 *
 * Usage:
 *   node --experimental-strip-types --import ./scripts/_register.mjs scripts/telegram-machines-html.mjs
 */
import { register } from "node:module";

register(new URL("./_ts-resolve.mjs", import.meta.url));

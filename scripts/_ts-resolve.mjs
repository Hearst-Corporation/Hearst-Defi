/**
 * Tiny ESM resolver hook so plain `node --experimental-strip-types` can run the
 * Telegram scripts, which import project modules WITHOUT a file extension
 * (e.g. `./model-catalog`). Maps an extensionless relative import to its `.ts`
 * sibling. Used via: node --import ./scripts/_register.mjs <script>.
 */
export async function resolve(specifier, context, next) {
  if (specifier.startsWith(".") && !/\.[mc]?[jt]s$/.test(specifier)) {
    try {
      return await next(specifier + ".ts", context);
    } catch {
      /* fall through to default resolution */
    }
  }
  return next(specifier, context);
}

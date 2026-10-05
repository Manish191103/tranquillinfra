/**
 * Serialize a value for embedding in an inline `<script>` element.
 *
 * `JSON.stringify` does not escape `<`, so a string containing `</script>`
 * would terminate the script element when the output is passed through
 * `set:html`. Escaping `<` as `\u003c` keeps the payload valid JSON (parsers
 * decode it back to `<`) and makes breakout impossible.
 */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

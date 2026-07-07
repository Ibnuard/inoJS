/**
 * @param {number} value
 * @returns {string}
 */
export function statusLabel(value) {
  if (value > 700) {
    return "HOT";
  }

  return "OK";
}

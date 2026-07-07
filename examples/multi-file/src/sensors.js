/**
 * @param {number} samples
 * @param {number} sensorValue
 * @returns {number}
 */
export function readAverage(samples, sensorValue) {
  let total = 0;
  for (let i = 0; i < samples; i++) {
    total = total + sensorValue;
  }
  return total / samples;
}

/**
 * @param {number} value
 * @returns {boolean}
 */
export function isHot(value) {
  return value > 700;
}

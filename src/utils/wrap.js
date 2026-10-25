/**
 * True when a looped audio element jumped from near its end back to near its start.
 * Manual seeks must be suppressed by the caller before asking this.
 *
 * @param {number} prev previous currentTime
 * @param {number} now current currentTime
 * @param {number} duration media duration
 * @returns {boolean}
 */
export function isNaturalWrap(prev, now, duration) {
  return Number.isFinite(duration) &&
    duration > 0 &&
    Number.isFinite(prev) &&
    Number.isFinite(now) &&
    prev > duration - 2 &&
    now < prev - 1;
}

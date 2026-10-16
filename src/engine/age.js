/**
 * Central age store.
 * A single value `age` (0 to 1) is the only source of truth.
 * Shared mutable object { value } plus a setter function.
 */

export const age = {
  value: 0
};

export function setAge(nextAge) {
  const clamped = Math.max(0, Math.min(1, Number(nextAge) || 0));
  if (age.value !== clamped) {
    age.value = clamped;
  }
  return clamped;
}

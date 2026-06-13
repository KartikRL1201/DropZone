/**
 * lockKeys.js
 * 
 * Provides deterministic Redis key generators for the Redlock manager.
 * Keeping keys centralized prevents typos and accidental lock collisions.
 */

export const LockKeys = {
  /**
   * Lock a specific crisis zone.
   * Used when running the global rebalancing engine for a crisis.
   */
  crisis: (crisisId) => `lock:crisis:${crisisId}`,

  /**
   * Lock a specific supply item.
   * Used during the manual or automated allocation of a single resource type
   * to ensure inventory numbers don't drop below zero due to race conditions.
   */
  supplyItem: (supplyItemId) => `lock:supply:${supplyItemId}`,

  /**
   * Lock a volunteer request.
   * Prevents two admins from accidentally approving the same request at the exact same time.
   */
  volunteerRequest: (requestId) => `lock:request:${requestId}`,
};

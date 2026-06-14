import { CrisisSeverity, UrgencyLevel } from '@dropzone/shared-domain';

/**
 * Maps Crisis Severity enum to a numerical multiplier.
 */
const getCrisisMultiplier = (severity) => {
  switch (severity) {
    case CrisisSeverity.CRITICAL: return 2.0;
    case CrisisSeverity.HIGH: return 1.5;
    case CrisisSeverity.MODERATE: return 1.0;
    case CrisisSeverity.LOW: return 0.5;
    default: return 1.0;
  }
};

/**
 * Maps Volunteer Request Urgency enum to a base score.
 */
const getUrgencyBaseScore = (urgency) => {
  switch (urgency) {
    case UrgencyLevel.CRITICAL: return 100;
    case UrgencyLevel.HIGH: return 75;
    case UrgencyLevel.MEDIUM: return 50;
    case UrgencyLevel.LOW: return 25;
    default: return 25;
  }
};

/**
 * Calculates a dynamic priority score for a volunteer request.
 * Higher score = higher priority for allocation.
 * 
 * Score Formula:
 * (BaseUrgencyScore * CrisisSeverityMultiplier) + WaitingTimeBonus + PeopleServedBonus
 * 
 * @param {Object} params
 * @param {string} params.crisisSeverity - CrisisSeverity enum value
 * @param {string} params.requestUrgency - UrgencyLevel enum value
 * @param {Date} params.submittedAt - When the request was created
 * @param {number} params.peopleCount - How many people this request serves
 * @returns {number} The calculated priority score (0-1000+)
 */
export const calculatePriorityScore = ({
  crisisSeverity,
  requestUrgency,
  submittedAt,
  peopleCount,
}) => {
  const baseScore = getUrgencyBaseScore(requestUrgency);
  const crisisMultiplier = getCrisisMultiplier(crisisSeverity);

  // Time bonus: +1 point for every hour waiting (up to 72 hours max to prevent runaway scores)
  const hoursWaiting = Math.max(0, (new Date() - new Date(submittedAt)) / (1000 * 60 * 60));
  const timeBonus = Math.min(hoursWaiting, 72) * 1.0; 

  // People bonus: +0.5 points per person (max 50 points to prevent massive shelters from starving small families)
  const peopleBonus = Math.min(peopleCount * 0.5, 50);

  const finalScore = Math.round((baseScore * crisisMultiplier) + timeBonus + peopleBonus);
  
  return finalScore;
};

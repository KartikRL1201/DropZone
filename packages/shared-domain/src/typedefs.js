/**
 * JSDoc definitions for core domain models.
 * Import these into your JS files for rich IDE autocompletion.
 * 
 * @typedef {Object} GeoPoint
 * @property {'Point'} type - Always "Point"
 * @property {[number, number]} coordinates - [longitude, latitude]
 * 
 * @typedef {Object} Crisis
 * @property {string} _id
 * @property {string} name - Human-readable crisis name
 * @property {string} description
 * @property {import('./enums.js').CrisisStatus} status
 * @property {import('./enums.js').CrisisSeverity} severity
 * @property {GeoPoint} epicenter
 * @property {number} radiusKm
 * @property {Date} declaredAt
 * @property {Date|null} resolvedAt
 * 
 * @typedef {Object} SupplyItem
 * @property {string} _id
 * @property {string} crisisId
 * @property {string} name
 * @property {import('./enums.js').SupplyCategory} category
 * @property {number} totalQuantity
 * @property {number} allocatedQuantity
 * @property {import('./enums.js').SupplyUnit} unit
 * @property {GeoPoint} warehouseLocation
 * 
 * @typedef {Object} RequestedItem
 * @property {import('./enums.js').SupplyCategory} category
 * @property {string} description
 * @property {number} quantityNeeded
 * @property {number} quantityFulfilled
 * 
 * @typedef {Object} VolunteerRequest
 * @property {string} _id
 * @property {string} crisisId
 * @property {string} requesterName
 * @property {string} contactPhone
 * @property {GeoPoint} location
 * @property {import('./enums.js').UrgencyLevel} urgency
 * @property {import('./enums.js').RequestStatus} status
 * @property {RequestedItem[]} items
 * @property {string} idempotencyKey
 * 
 * @typedef {Object} Allocation
 * @property {string} _id
 * @property {string} crisisId
 * @property {string} supplyItemId
 * @property {string} volunteerRequestId
 * @property {string|null} driverRouteId
 * @property {number} quantity
 * @property {import('./enums.js').AllocationStatus} status
 * @property {number} priorityScore
 * 
 * @typedef {Object} Waypoint
 * @property {string} allocationId
 * @property {GeoPoint} location
 * @property {string} address
 * @property {number} sequenceOrder
 * @property {boolean} completed
 * 
 * @typedef {Object} DriverRoute
 * @property {string} _id
 * @property {string} driverId
 * @property {string} crisisId
 * @property {string[]} allocationIds
 * @property {import('./enums.js').RouteStatus} status
 * @property {Waypoint[]} waypoints
 * @property {GeoPoint|null} currentPosition
 * 
 * @typedef {Object} User
 * @property {string} _id
 * @property {string} email
 * @property {import('./enums.js').UserRole} role
 * @property {string} name
 * @property {boolean} isActive
 */

export default {};

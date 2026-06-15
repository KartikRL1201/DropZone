/**
 * Centralized Enums (Constants) for the domain.
 * Equivalent to TypeScript enums but in pure JS.
 */

export const CrisisStatus = Object.freeze({
  ACTIVE: 'ACTIVE',
  MONITORING: 'MONITORING',
  RESOLVED: 'RESOLVED',
});

export const CrisisSeverity = Object.freeze({
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MODERATE: 'MODERATE',
  LOW: 'LOW',
});

export const SupplyCategory = Object.freeze({
  FOOD: 'FOOD',
  WATER: 'WATER',
  MEDICAL: 'MEDICAL',
  SHELTER: 'SHELTER',
  CLOTHING: 'CLOTHING',
  HYGIENE: 'HYGIENE',
  TOOLS: 'TOOLS',
  COMMUNICATION: 'COMMUNICATION',
  BLANKETS: 'BLANKETS',
});

export const SupplyUnit = Object.freeze({
  UNITS: 'units',
  LITERS: 'liters',
  KILOGRAMS: 'kg',
  BOXES: 'boxes',
  PALLETS: 'pallets',
  PACKETS: 'packets',
});

export const UrgencyLevel = Object.freeze({
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MODERATE: 'MODERATE',
  LOW: 'LOW',
});

export const RequestStatus = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  ALLOCATED: 'ALLOCATED',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
});

export const AllocationStatus = Object.freeze({
  PENDING: 'PENDING',
  ASSIGNED: 'ASSIGNED',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  RETURNED: 'RETURNED',
});

export const RouteStatus = Object.freeze({
  QUEUED: 'QUEUED',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});

export const UserRole = Object.freeze({
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  COORDINATOR: 'COORDINATOR',
  DRIVER: 'DRIVER',
  VOLUNTEER: 'VOLUNTEER',
});

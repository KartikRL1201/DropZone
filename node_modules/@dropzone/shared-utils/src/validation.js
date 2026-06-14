import { z } from 'zod';
import { CrisisSeverity, SupplyCategory, UrgencyLevel, SupplyUnit } from '@dropzone/shared-domain';

// --- Shared Constants ---
export const AppConstants = {
  MAX_CRISIS_RADIUS_KM: 500,
  MIN_PASSWORD_LENGTH: 8,
  MAX_ITEMS_PER_REQUEST: 15,
};

// --- Reusable Zod Primitives ---
export const GeoPointSchema = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([
    z.number().min(-180).max(180), // Longitude
    z.number().min(-90).max(90),   // Latitude
  ]),
});

// --- API Request Validation Schemas ---

export const CreateCrisisSchema = z.object({
  name: z.string().min(5).max(100),
  description: z.string().min(10).max(1000),
  severity: z.nativeEnum(CrisisSeverity),
  epicenter: GeoPointSchema,
  radiusKm: z.number().positive().max(AppConstants.MAX_CRISIS_RADIUS_KM),
  estimatedAffected: z.number().nonnegative(),
  tags: z.array(z.string().trim().toLowerCase()).max(10).optional(),
});

export const CreateVolunteerRequestSchema = z.object({
  crisisId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ID'),
  requesterName: z.string().min(2).max(100),
  contactPhone: z.string().min(10).max(20),
  contactEmail: z.string().email().optional(),
  location: GeoPointSchema,
  locationAddress: z.string().min(5).max(250),
  urgency: z.nativeEnum(UrgencyLevel),
  peopleCount: z.number().positive(),
  notes: z.string().max(1000).optional(),
  idempotencyKey: z.string().uuid(),
  items: z.array(z.object({
    category: z.nativeEnum(SupplyCategory),
    description: z.string().min(3).max(100),
    quantityNeeded: z.number().positive(),
  })).min(1).max(AppConstants.MAX_ITEMS_PER_REQUEST),
});

export const CreateSupplySchema = z.object({
  crisisId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ID'),
  name: z.string().min(3).max(100),
  category: z.nativeEnum(SupplyCategory),
  totalQuantity: z.number().positive(),
  unit: z.nativeEnum(SupplyUnit),
  warehouseLocation: GeoPointSchema,
  lowStockThreshold: z.number().nonnegative().optional(),
  batchId: z.string().optional(),
  expiresAt: z.string().datetime().optional(), // ISO string date
});

// For updates, we can't change the category or unit easily without messing up math.
// So we limit what can be updated.
export const UpdateSupplySchema = z.object({
  totalQuantity: z.number().positive().optional(),
  lowStockThreshold: z.number().nonnegative().optional(),
  warehouseLocation: GeoPointSchema.optional(),
});

export const UpdateLocationSchema = z.object({
  coordinates: z.tuple([
    z.number().min(-180).max(180), // Longitude
    z.number().min(-90).max(90),   // Latitude
  ]),
});

export const CompleteWaypointSchema = z.object({
  allocationId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ID'),
});

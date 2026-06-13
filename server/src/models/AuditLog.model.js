import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      trim: true, // e.g., "DECREMENT_SUPPLY", "APPROVE_REQUEST"
    },
    entityType: {
      type: String,
      enum: ['Crisis', 'SupplyItem', 'VolunteerRequest', 'Allocation', 'DriverRoute', 'User'],
      required: true,
      index: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    changes: {
      before: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
      after: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      expires: '365d', // Automatically delete logs older than 1 year to save DB space
    },
  },
  {
    // Do not add optimisticConcurrency or timestamps (createdAt is redundant with timestamp, and we never update these)
    versionKey: false,
  }
);

// Compound index for querying the history of a specific entity efficiently
auditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);

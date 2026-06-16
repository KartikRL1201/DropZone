import mongoose from 'mongoose';
import { CrisisStatus, CrisisSeverity } from '@dropzone/shared-domain';

const crisisSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 100,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(CrisisStatus),
      default: CrisisStatus.ACTIVE,
      required: true,
    },
    severity: {
      type: String,
      enum: Object.values(CrisisSeverity),
      required: true,
    },
    epicenter: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },
    radiusKm: {
      type: Number,
      required: true,
      min: 1,
    },
    estimatedAffected: {
      type: Number,
      default: 0,
      min: 0,
    },
    declaredAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    declaredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedWarehouseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Warehouse',
      default: null,
    },
    assignedDriverId: {
      type: String,
      default: null,
    },
    dispatchStatus: {
      type: String,
      enum: ['NONE', 'PENDING_DRIVER', 'IN_TRANSIT', 'RETURNING'],
      default: 'NONE',
    },
    returnRoute: {
      type: [[Number]],
      default: null,
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
  },
  {
    timestamps: true,
    optimisticConcurrency: true, // Enables __v version checking to prevent race conditions
  }
);

// Create a 2dsphere index on the epicenter for fast geospatial radius queries
crisisSchema.index({ epicenter: '2dsphere' });

// Create an index on status for fast filtering on the dashboard
crisisSchema.index({ status: 1 });

export const Crisis = mongoose.model('Crisis', crisisSchema);

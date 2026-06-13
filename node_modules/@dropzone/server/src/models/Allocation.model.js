import mongoose from 'mongoose';
import { AllocationStatus, SupplyCategory } from '@dropzone/shared-domain';

const allocationSchema = new mongoose.Schema(
  {
    crisisId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Crisis',
      required: true,
      index: true,
    },
    supplyItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SupplyItem',
      required: true,
      index: true,
    },
    volunteerRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VolunteerRequest',
      required: true,
      index: true,
    },
    driverRouteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DriverRoute',
      default: null, // Null until a driver is assigned to pick it up
      index: true,
    },
    category: {
      type: String,
      enum: Object.values(SupplyCategory),
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: Object.values(AllocationStatus),
      default: AllocationStatus.PENDING,
      required: true,
      index: true,
    },
    allocatedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    pickedUpAt: {
      type: Date,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    failureReason: {
      type: String,
      trim: true,
    },
    priorityScore: {
      type: Number,
      required: true, // Calculated by the Fair-Share engine at creation
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

// Compound index to quickly find all pending allocations for a specific crisis
// (Used by the routing engine to group nearby deliveries for drivers)
allocationSchema.index({ crisisId: 1, status: 1 });

export const Allocation = mongoose.model('Allocation', allocationSchema);

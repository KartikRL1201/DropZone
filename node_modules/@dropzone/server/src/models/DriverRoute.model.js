import mongoose from 'mongoose';
import { RouteStatus } from '@dropzone/shared-domain';

const waypointSchema = new mongoose.Schema(
  {
    allocationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Allocation',
      required: true,
    },
    location: {
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
    address: {
      type: String,
      required: true,
    },
    sequenceOrder: {
      type: Number,
      required: true,
      min: 0,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false } // No separate ID needed, they belong to the route
);

const driverRouteSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    crisisId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Crisis',
      required: true,
      index: true,
    },
    allocationIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Allocation',
      },
    ],
    status: {
      type: String,
      enum: Object.values(RouteStatus),
      default: RouteStatus.QUEUED,
      required: true,
      index: true,
    },
    waypoints: {
      type: [waypointSchema],
      required: true,
    },
    currentPosition: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number], // Driver's live GPS, updated frequently via Socket/API
      },
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    estimatedDistanceKm: {
      type: Number,
      default: null,
    },
    estimatedDurationMin: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

// 2dsphere index so admins can query "show me all active drivers near this coordinate"
driverRouteSchema.index({ currentPosition: '2dsphere' });

export const DriverRoute = mongoose.model('DriverRoute', driverRouteSchema);

import mongoose from 'mongoose';
import { UrgencyLevel, RequestStatus, SupplyCategory } from '@dropzone/shared-domain';

const requestedItemSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: Object.values(SupplyCategory),
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    quantityNeeded: {
      type: Number,
      required: true,
      min: 1,
    },
    quantityFulfilled: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false } // We don't need a separate ObjectId for sub-documents
);

const volunteerRequestSchema = new mongoose.Schema(
  {
    crisisId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Crisis',
      required: true,
      index: true,
    },
    requesterName: {
      type: String,
      required: true,
      trim: true,
    },
    contactPhone: {
      type: String,
      required: true,
      trim: true,
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
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
    locationAddress: {
      type: String,
      required: true,
      trim: true,
    },
    urgency: {
      type: String,
      enum: Object.values(UrgencyLevel),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(RequestStatus),
      default: RequestStatus.PENDING,
      required: true,
      index: true,
    },
    items: {
      type: [requestedItemSchema],
      required: true,
      validate: [
        (val) => val.length > 0,
        'A request must contain at least one item.',
      ],
    },
    peopleCount: {
      type: Number,
      required: true,
      min: 1,
    },
    notes: {
      type: String,
      trim: true,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    // Used to prevent duplicate submissions from the public portal
    idempotencyKey: {
      type: String,
      required: true,
      unique: true, // MongoDB handles the deduplication automatically!
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewNotes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

// Indexes
volunteerRequestSchema.index({ location: '2dsphere' });
volunteerRequestSchema.index({ crisisId: 1, status: 1 }); // Compound index for the admin dashboard queue

export const VolunteerRequest = mongoose.model('VolunteerRequest', volunteerRequestSchema);

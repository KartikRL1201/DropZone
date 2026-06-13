import mongoose from 'mongoose';
import { SupplyCategory, SupplyUnit } from '@dropzone/shared-domain';

const supplyItemSchema = new mongoose.Schema(
  {
    crisisId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Crisis',
      required: true,
      index: true, // Crucial for filtering supplies by crisis zone
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: Object.values(SupplyCategory),
      required: true,
      index: true,
    },
    totalQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    allocatedQuantity: {
      type: Number,
      default: 0,
      min: 0,
      // Validation: allocatedQuantity can never exceed totalQuantity
      validate: {
        validator: function (value) {
          return value <= this.totalQuantity;
        },
        message: 'Allocated quantity cannot exceed total quantity.',
      },
    },
    unit: {
      type: String,
      enum: Object.values(SupplyUnit),
      required: true,
    },
    warehouseLocation: {
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
    lowStockThreshold: {
      type: Number,
      default: 0,
      min: 0,
    },
    batchId: {
      type: String,
      trim: true,
    },
    expiresAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    optimisticConcurrency: true, // Prevents two admins from decrementing the same stock blindly
    toJSON: { virtuals: true },  // Ensure virtuals are included in JSON output
    toObject: { virtuals: true },
  }
);

// Virtual field for available quantity (calculated dynamically)
supplyItemSchema.virtual('availableQuantity').get(function () {
  return this.totalQuantity - this.allocatedQuantity;
});

// Geospatial index for warehouse location
supplyItemSchema.index({ warehouseLocation: '2dsphere' });

export const SupplyItem = mongoose.model('SupplyItem', supplyItemSchema);

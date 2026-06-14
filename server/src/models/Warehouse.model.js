import mongoose from 'mongoose';

const warehouseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
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
    trucks: {
      total: { type: Number, default: 0, min: 0 },
      available: { type: Number, default: 0, min: 0 }
    },
    inventory: [
      {
        category: {
          type: String,
          enum: ['MEDICAL', 'FOOD', 'WATER', 'BLANKETS', 'EQUIPMENT'],
          required: true,
        },
        quantity: {
          type: Number,
          default: 0,
          min: 0,
        },
        unit: {
          type: String,
          default: 'kits'
        }
      }
    ],
    status: {
      type: String,
      enum: ['OPERATIONAL', 'MAINTENANCE', 'OFFLINE'],
      default: 'OPERATIONAL'
    }
  },
  {
    timestamps: true,
    optimisticConcurrency: true,
  }
);

warehouseSchema.index({ location: '2dsphere' });

export const Warehouse = mongoose.model('Warehouse', warehouseSchema);

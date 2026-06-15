import { Warehouse } from '../models/Warehouse.model.js';

export const seedWarehouses = async () => {
  try {
    // Only seed if there are no warehouses yet (prevents resetting data on server restarts)
    const count = await Warehouse.countDocuments();
    if (count > 0) {
      console.log(`⏩ Skipping warehouse seed (${count} already exist)`);
      return;
    }
    console.log('🌱 Seeding Warehouses...');

    const initialHubs = [
        { name: 'Central Command HQ (Ejipura)', code: 'hq', location: [77.6254, 12.9344], type: 'hq' },
        { name: 'Peenya Hub (NW)', code: 'w1', location: [77.5197, 13.0285], type: 'warehouse' },
        { name: 'Whitefield Hub (E)', code: 'w2', location: [77.7499, 12.9698], type: 'warehouse' },
        { name: 'Electronic City Hub (S)', code: 'w3', location: [77.6602, 12.8452], type: 'warehouse' },
        { name: 'Yelahanka Hub (N)', code: 'w4', location: [77.5963, 13.1007], type: 'warehouse' },
        { name: 'Kengeri Hub (SW)', code: 'w5', location: [77.4838, 12.9177], type: 'warehouse' },
        { name: 'KR Puram Hub (NE)', code: 'w6', location: [77.6959, 13.0084], type: 'warehouse' },
        { name: 'Bannerghatta Hub (Deep S)', code: 'w7', location: [77.5844, 12.8158], type: 'warehouse' }
    ];

    const defaultInventory = [
        { category: 'MEDICAL', quantity: 500, unit: 'kits' },
        { category: 'FOOD', quantity: 1000, unit: 'rations' },
        { category: 'WATER', quantity: 2000, unit: 'liters' },
        { category: 'BLANKETS', quantity: 500, unit: 'packs' }
    ];

    const warehousesToInsert = initialHubs.map(hub => ({
        name: hub.name,
        code: hub.code,
        location: {
            type: 'Point',
            coordinates: hub.location
        },
        trucks: {
            total: hub.type === 'hq' ? 20 : 10,
            available: hub.type === 'hq' ? 20 : 10
        },
        inventory: defaultInventory,
        status: 'OPERATIONAL'
    }));

    await Warehouse.insertMany(warehousesToInsert);
    console.log('✅ Successfully seeded 8 Warehouses!');
  } catch (error) {
    console.error('❌ Failed to seed warehouses:', error);
  }
};

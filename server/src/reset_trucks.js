import mongoose from 'mongoose';
import { Warehouse } from './models/Warehouse.model.js';

async function run() {
  await mongoose.connect('mongodb://Admin:Kartik12@ac-mqm4rda-shard-00-00.z94sspy.mongodb.net:27017,ac-mqm4rda-shard-00-01.z94sspy.mongodb.net:27017,ac-mqm4rda-shard-00-02.z94sspy.mongodb.net:27017/dropzone?replicaSet=atlas-ucndwu-shard-0&ssl=true&authSource=admin');
  const warehouses = await Warehouse.find({});
  for (const w of warehouses) {
    if (w.trucks.available < w.trucks.total) {
      console.log(`Resetting ${w.name}: ${w.trucks.available} -> ${w.trucks.total}`);
      w.trucks.available = w.trucks.total;
      await w.save();
    }
  }
  process.exit(0);
}
run();

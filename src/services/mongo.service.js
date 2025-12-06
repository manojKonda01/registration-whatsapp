import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();
let client;

const URI = process.env.MONGO_URI;
const DB = process.env.DB;

// Function to connect mongo
export const connectToMongoDB = async ()=> {
  try {
    client = new MongoClient(URI);
    await client.connect();
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
  }
}
// Save new registration
export const saveRegistrationToMongo = async (data) => {
  await connectToMongoDB();
  const db = client.db(DB)
  const collection = db.collection("registrations");

  const result = await collection.insertOne(data);
  return result.insertedId;
};

// Check if phone already registered
export const findByPhone = async (phone) => {
  await connectToMongoDB();
  const db = client.db(DB)
  const collection = db.collection("registrations");

  return await collection.findOne({ phone });
};

// Update user registration (optional future feature)
export const updateRegistration = async (phone, data) => {
  await connectToMongoDB();
  const db = client.db(DB)
  const collection = db.collection("registrations");

  await collection.updateOne({ phone }, { $set: data });
};

export const getClient =  () => client
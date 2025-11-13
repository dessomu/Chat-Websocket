const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB with Mongoose");
  } catch (err) {
    console.error("❌ DB Connection Error:", err);
  }
}

module.exports = connectDB;

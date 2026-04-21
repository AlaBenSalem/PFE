const { connectAllMongo } = require("./mongodbConnections");

/**
 * Backward-compatible entry: same as server startup (primary + optional local).
 */
const connectDB = async () => {
  try {
    await connectAllMongo();
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

module.exports = connectDB;

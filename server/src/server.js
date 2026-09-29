// Server entry point — loads env, connects to DB, starts Express
import "./config/env.js";
import { PORT } from "./config/env.js";

import app from "./app.js";
import connectDB from "./config/db.js";


const startServer = async () => {
  try {
    await connectDB();

    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`ArchMind server running on port ${PORT} (http://localhost:${PORT})`);
    });

    // Ensure socket timeouts do not prematurely disconnect large upload streams
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
};

startServer();

// Server entry point — loads env, connects to DB, starts Express
import "./config/env.js";
import { PORT } from "./config/env.js";

import app from "./app.js";
import connectDB from "./config/db.js";

// Process-level crash diagnostics
process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught Exception:", err.message, err.stack);
});
process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] Unhandled Promise Rejection:", reason);
});

const startServer = async () => {
  try {
    await connectDB();

    // Listen on dual-stack (::) by default so both IPv4 (127.0.0.1) and IPv6 (::1) localhost connections work
    const host = process.env.HOST || undefined;
    const server = host
      ? app.listen(PORT, host, () => {
          console.log(`ArchMind server running on port ${PORT} (http://${host}:${PORT})`);
        })
      : app.listen(PORT, () => {
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

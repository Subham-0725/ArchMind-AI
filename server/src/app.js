// src/app.js
import express from "express";
import cors from "cors";
import clerk from "./config/clerk.js";
import userRoutes from "./routes/userRoutes.js";
import projectRoutes from "./routes/project.routes.js";

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────

const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5000",
  "http://127.0.0.1:5000",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Postman, server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      console.warn(`[CORS] Rejected origin: '${origin}'`);
      return callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
    optionsSuccessStatus: 200,
  })
);


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Clerk JWT verification — runs on every request, attaches req.auth
app.use(clerk);

// ── Routes ────────────────────────────────────────────────────────────────────

app.use("/api/users", userRoutes);
app.use("/api/projects", projectRoutes);


// Health check — no auth required
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "ArchMind API is running",
  });
});

// ── 404 Handler ───────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ success: false, error: "Route not found." });
});

// ── Global Error Handler ──────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("[app] Unhandled error:", err);
  res.status(500).json({ success: false, error: err?.message || "An unexpected error occurred." });
});

export default app;


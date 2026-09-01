import express from "express";
import cors from "cors";
import clerk from "./config/clerk.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(clerk);

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "ArchMind API is running",
  });
});

export default app;

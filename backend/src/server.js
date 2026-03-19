import express from "express";
import cors from "cors";
import { serve } from "inngest/express";
import { clerkMiddleware } from "@clerk/express";

import { ENV } from "./lib/env.js";
import { connectDB } from "./lib/db.js";
import { inngest, functions } from "./lib/inngest.js";

import chatRoutes from "./routes/chatRoutes.js";
import sessionRoutes from "./routes/sessionRoute.js";
import codeRoutes from "./routes/codeRoutes.js";

const app = express();

const allowedOrigins = (ENV.CLIENT_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// middleware
app.use(express.json());
app.use(
  cors({
    origin: (origin, callback) => {
      // In production, require explicit browser origin allowlist.
      if (ENV.NODE_ENV === "production") {
        if (!origin) return callback(new Error("Origin header required"));
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error("CORS origin not allowed"));
      }

      // Dev: allow no-origin (Postman/server calls), allow listed, and allow LAN testing.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);

      // Optional: narrow this instead of allowing all in dev.
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    optionsSuccessStatus: 204,
  }),
);

app.use(clerkMiddleware()); // this adds auth field to request object: req.auth()

app.use("/api/inngest", serve({ client: inngest, functions }));
app.use("/api/chat", chatRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/code", codeRoutes);

app.get("/", (_, res) => {
  res.status(200).send("IntBit backend is running");
});

app.get("/health", (req, res) => {
  res.status(200).json({ msg: "api is up and running" });
});

const startServer = async () => {
  try {
    await connectDB();
    app.listen(ENV.PORT, () =>
      console.log("Server is running on port:", ENV.PORT),
    );
  } catch (error) {
    console.error("Error starting the server", error);
  }
};

startServer();

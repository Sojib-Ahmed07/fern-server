import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { auth } from "./config/auth.js";
import { toNodeHandler } from "better-auth/node";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import commentRoutes from "./routes/commentRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  }),
);

// better auth
app.use("/api/auth", (req, res) => {
  toNodeHandler(auth)(req, res);
});

//base
app.get("/", (req, res) => {
  res.send({
    message: "E-Commerce backend API is running smoothly.",
  });
});
//products related
app.use("/api/products", productRoutes);
//order
app.use("/api/orders", orderRoutes);
//comments related
app.use("/api/comments", commentRoutes);
//admin
app.use("/api/admin", adminRoutes)

// server listener
app.listen(PORT, () => {
  console.log(`=============================================`);
  console.log(`🚀 Server is running on: http://localhost:${PORT}`);
  console.log(`🔐 Better Auth Endpoint: http://localhost:${PORT}/api/auth/*`);
  console.log(`=============================================`);
});

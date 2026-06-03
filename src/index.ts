import dotenv from "dotenv";
import express from "express";
import { auth } from "./config/auth.js";
import { toNodeHandler } from "better-auth/node";
import productRoutes from "./routes/productRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// better auth
app.use("/api/auth", (req, res) => {
  toNodeHandler(auth)(req, res);
});

// middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//base
app.get("/", (req, res) => {
  res.send({
    message: "E-Commerce backend API is running smoothly.",
  });
});
//products related
app.use("/api/products", productRoutes);

// server listener
app.listen(PORT, () => {
  console.log(`=============================================`);
  console.log(`🚀 Server is running on: http://localhost:${PORT}`);
  console.log(`🔐 Better Auth Endpoint: http://localhost:${PORT}/api/auth/*`);
  console.log(`=============================================`);
});

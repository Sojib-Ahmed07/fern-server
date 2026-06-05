// import dotenv from "dotenv";
// import express from "express";
// import cors from "cors";
// import { auth } from "./config/auth.js";
// import { toNodeHandler } from "better-auth/node";
// import productRoutes from "./routes/productRoutes.js";
// import orderRoutes from "./routes/orderRoutes.js";
// import commentRoutes from "./routes/commentRoutes.js";
// import adminRoutes from "./routes/adminRoutes.js";
// import userRoutes from "./routes/userRoutes.js"
// import dashboardRoutes from "./routes/dashboardRoutes.js"
// dotenv.config();
// const app = express();
// const PORT = process.env.PORT || 5000;
// // middlewares
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// app.use(
//   cors({
//     origin: "http://localhost:3000",
//     credentials: true,
//     methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
//   }),
// );
// // better auth
// app.use("/api/auth", (req, res) => {
//   toNodeHandler(auth)(req, res);
// });
// //base
// app.get("/", (req, res) => {
//   res.send({
//     message: "E-Commerce backend API is running smoothly.",
//   });
// });
// //products related
// app.use("/api/products", productRoutes);
// //order
// app.use("/api/orders", orderRoutes);
// //comments related
// app.use("/api/comments", commentRoutes);
// //admin
// app.use("/api/admin", adminRoutes)
// //user management
// app.use("/api", userRoutes)
// //dashboard
// app.use("/api", dashboardRoutes)
// // server listener
// app.listen(PORT, () => {
//   console.log(`=============================================`);
//   console.log(`🚀 Server is running on: http://localhost:${PORT}`);
//   console.log(`🔐 Better Auth Endpoint: http://localhost:${PORT}/api/auth/*`);
//   console.log(`=============================================`);
// });
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { auth } from "./config/auth.js";
import { toNodeHandler } from "better-auth/node";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import commentRoutes from "./routes/commentRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;
// middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
}));
// 🔐 Better Auth - কোনো ওয়াইল্ডকার্ড ক্যারেক্টার ছাড়া এক্সপ্রেসের স্ট্যান্ডার্ড ক্যাচ-অল
app.use("/api/auth", toNodeHandler(auth));
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
app.use("/api/admin", adminRoutes);
//user management
app.use("/api", userRoutes);
//dashboard
app.use("/api", dashboardRoutes);
// server listener
app.listen(PORT, () => {
    console.log(`=============================================`);
    console.log(`🚀 Server is running on: http://localhost:${PORT}`);
    console.log(`🔐 Better Auth Endpoint: http://localhost:${PORT}/api/auth/*`);
    console.log(`=============================================`);
});

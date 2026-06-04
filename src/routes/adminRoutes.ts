import { Router } from "express";
import { getAllOrdersForAdmin, adminUpdateOrderStatus } from "../controllers/adminController.js";
import { isAuthenticated } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/adminMiddleware.js";

const router = Router();

// 🔒 নিচের সবকটি রাউট শুধুমাত্র লগইন করা অ্যাডমিনদের জন্য প্রটেক্টেড
router.use(isAuthenticated as any, isAdmin as any);

// অর্ডারের রাউটসমূহ
router.get("/orders", getAllOrdersForAdmin);
router.patch("/orders/:id/status", adminUpdateOrderStatus);

export default router;
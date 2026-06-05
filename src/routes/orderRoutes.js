import { Router } from "express";
import { createOrder, getMyOrders, getOrderDetails, updateOrderStatus, handlePaymentSuccess, handlePaymentFail, handlePaymentCancel, } from "../controllers/orderController.js";
import { isAuthenticated } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/adminMiddleware.js";
const router = Router();
// 🛒 কোর চেকআউট এবং অর্ডার রাউটস (ইউজার প্রটেক্টেড)
router.post("/checkout", isAuthenticated, createOrder);
router.get("/my-orders", isAuthenticated, getMyOrders);
router.get("/:id", isAuthenticated, getOrderDetails);
// 💳 SSLCommerz পাবলিক কলব্যাক রাউটস (এগুলোতে মিডলওয়্যার দেওয়া যাবে না)
router.post("/payment/success/:tranId", handlePaymentSuccess);
router.get("/payment/success/:tranId", handlePaymentSuccess);
router.post("/payment/fail/:tranId", handlePaymentFail);
router.post("/payment/cancel/:tranId", handlePaymentCancel);
// 👑 অ্যাডমিন রাউটস
router.patch("/:id/status", isAuthenticated, isAdmin, updateOrderStatus);
export default router;

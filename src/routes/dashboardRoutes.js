import { Router } from "express";
import { getDashboardStats } from "../controllers/dashboardController.js";
import { isAuthenticated } from "../middlewares/authMiddleware.js";
import { isAdmin } from "@/middlewares/adminMiddleware.js";
const router = Router();
router.get("/admin/dashboard-stats", isAuthenticated, isAdmin, getDashboardStats);
export default router;

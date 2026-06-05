import { Router } from "express";
import {
  getAllUsers,
  updateUserRole,
  deleteUser,
} from "../controllers/userController.js";
import { isAuthenticated } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/adminMiddleware.js"; // 🎯 ফিক্সড: @/ এর বদলে সঠিক রিলেটিভ পাথ দেওয়া হয়েছে

const router = Router();

router.get("/users", isAuthenticated, isAdmin, getAllUsers);
router.patch("/users/:id/role", isAuthenticated, isAdmin, updateUserRole);
router.delete("/users/:id", isAuthenticated, isAdmin, deleteUser);

export default router;

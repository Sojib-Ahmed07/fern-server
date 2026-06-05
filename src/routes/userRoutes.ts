import { Router } from "express";
import { getAllUsers, updateUserRole, deleteUser } from "../controllers/userController.js";
import { isAuthenticated } from "../middlewares/authMiddleware.js";
import { isAdmin } from "@/middlewares/adminMiddleware.js";

const router = Router();

router.get("/users", isAuthenticated, isAdmin, getAllUsers);
router.patch("/users/:id/role", isAuthenticated, isAdmin, updateUserRole);
router.delete("/users/:id", isAuthenticated, isAdmin, deleteUser);

export default router;
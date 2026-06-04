import { Router } from "express";
import { addComment, deleteComment } from "../controllers/commentController.js";
import { isAuthenticated } from "../middlewares/authMiddleware.js";

const router = Router();

router.post("/", isAuthenticated, addComment);
router.delete("/:id", isAuthenticated, deleteComment);

export default router;
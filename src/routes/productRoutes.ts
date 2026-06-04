import { Router } from "express";
import {
  getAllProducts,
  getSingleProduct,
  getProductDetails,
  createProduct,
} from "../controllers/productController.js";
import { isAuthenticated } from "../middlewares/authMiddleware.js";
import { isAdmin } from "../middlewares/adminMiddleware.js";
import { upload } from "@/config/cloudinary.js";

const router = Router();

router.get("/", getAllProducts);
router.get("/:id", getSingleProduct);
router.get("/:id/details", getProductDetails);

//admin routes
router.post("/", isAuthenticated, isAdmin, upload.single("image"), createProduct);

export default router;

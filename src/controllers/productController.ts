import { Request, Response } from "express";
import prisma from "../db.js";
import { AuthenticatedRequest } from "@/middlewares/authMiddleware.js";
import { uploadToCloudinary } from "../config/cloudinary.js"; // ✨ ১. ক্লাউডিনারি ইউটিলিটি ইম্পোর্ট করুন

export const getAllProducts = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { page = 1, limit = 10, search, category } = req.query;

    const pageNumber = parseInt(page as string);
    const limitNumber = parseInt(limit as string);
    const skip = (pageNumber - 1) * limitNumber;

    const whereCondition: any = {};

    if (search) {
      whereCondition.OR = [
        { name: { contains: search as string, mode: "insensitive" } },
        { description: { contains: search as string, mode: "insensitive" } },
      ];
    }

    if (category) {
      whereCondition.category = category as string;
    }

    const [products, totalProducts] = await prisma.$transaction([
      prisma.product.findMany({
        where: whereCondition,
        skip: skip,
        take: limitNumber,
        orderBy: { createdAt: "desc" },
      }),
      prisma.product.count({ where: whereCondition }),
    ]);

    res.status(200).json({
      success: true,
      meta: {
        totalProducts,
        currentPage: pageNumber,
        totalPages: Math.ceil(totalProducts / limitNumber),
        limit: limitNumber,
      },
      products,
    });
  } catch (error) {
    console.error("❌ GetAllProducts Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const getSingleProduct = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    if (typeof id !== "string") {
      res
        .status(400)
        .json({ success: false, message: "Invalid Product ID format" });
      return;
    }

    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      res.status(404).json({ success: false, message: "Product not found" });
      return;
    }

    res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    console.error("❌ GetSingleProduct Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const getProductDetails = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    if (typeof id !== "string") {
      res
        .status(400)
        .json({ success: false, message: "Invalid Product ID format" });
      return;
    }

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        comments: {
          include: {
            user: {
              select: { name: true, image: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!product) {
      res
        .status(404)
        .json({ success: false, message: "Product details not found" });
      return;
    }

    res.status(200).json({
      success: true,
      details: product,
    });
  } catch (error) {
    console.error("❌ GetProductDetails Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// 🚀 আপডেট হওয়া মেথড (Multer + Cloudinary ইন্টিগ্রেশন সহ)
export const createProduct = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const { name, description, price, category, stock } = req.body;

    // ১. টেক্সট ফিল্ড ভ্যালিডেশন চেক
    if (!name || !description || price === undefined || !category) {
      res
        .status(400)
        .json({ success: false, message: "Missing required text fields" });
      return;
    }

    // ২. ফাইল আপলোড হয়েছে কি না চেক
    if (!req.file) {
      res
        .status(400)
        .json({ success: false, message: "Product image file is required" });
      return;
    }

    // ৩. ডাটাবেজে পুশ করার আগে নিরাপদ টাইপ কনভার্সন
    const finalPrice =
      typeof price === "string" ? parseFloat(price) : Number(price);
    const finalStock =
      stock !== undefined
        ? typeof stock === "string"
          ? parseInt(stock)
          : Number(stock)
        : 0;

    if (isNaN(finalPrice) || isNaN(finalStock)) {
      res.status(400).json({
        success: false,
        message: "Price and Stock must be valid numbers.",
      });
      return;
    }

    // 🚀 ৪. Multer বাফার ডাটা সরাসরি ক্লাউডিনারিতে আপলোড করা হচ্ছে
    const uploadedImageUrl = await uploadToCloudinary(req.file.buffer);

    if (!uploadedImageUrl) {
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to upload image to Cloudinary",
        });
      return;
    }

    // 🔗 ৫. প্রিজমা দিয়ে নতুন ইমেজ ইউআরএল সহ প্রোডাক্ট ক্রিয়েট
    const newProduct = await prisma.product.create({
      data: {
        name,
        description,
        price: finalPrice,
        images: [uploadedImageUrl], // ক্লাউডিনারির জেনারেট হওয়া লাইভ লিংক এখানে সেভ হবে
        category,
        stock: finalStock,
      },
    });

    res.status(201).json({
      success: true,
      message: "Product created successfully! 🎉",
      product: newProduct,
    });
  } catch (error) {
    console.error("❌ CreateProduct Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

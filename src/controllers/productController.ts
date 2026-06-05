import { Request, Response } from "express";
import prisma from "../db.js";
import { AuthenticatedRequest } from "@/middlewares/authMiddleware.js";
import { uploadToCloudinary } from "../config/cloudinary.js";

// 🛍️ ১. সকল প্রোডাক্ট আনা এবং সার্চ ও ক্যাটাগরি ফিল্টারিং হ্যান্ডেল করা
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

    // গ্লোবাল সার্চ লজিক (ইনসেনসিটিভ)
    if (search) {
      whereCondition.OR = [
        { name: { contains: search as string, mode: "insensitive" } },
        { description: { contains: search as string, mode: "insensitive" } },
      ];
    }

    // 🎯 ফ্রন্টঅ্যান্ড ফিল্টারিং ট্র্যাকিং সিঙ্ক (All বাদে নির্দিষ্ট ক্যাটাগরি থাকলে ফিল্টার হবে)
    if (category && category !== "All") {
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

// 🔍 ২. শুধু প্রোডাক্ট অবজেক্টের বেসিক ডাটা রেডি করা
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

// 💬 ৩. কমেন্ট এবং ইউজার প্রোফাইল সহ ডিপ ডিটেইলস ফেচ (প্রোডাক্ট পেজের জন্য)
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

// 🚀 𝟜. নতুন প্রোডাক্ট ক্রিয়েট (Multer + Cloudinary)
export const createProduct = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const { name, description, price, category, stock } = req.body;

    if (!name || !description || price === undefined || !category) {
      res
        .status(400)
        .json({ success: false, message: "Missing required text fields" });
      return;
    }

    if (!req.file) {
      res
        .status(400)
        .json({ success: false, message: "Product image file is required" });
      return;
    }

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

    const uploadedImageUrl = await uploadToCloudinary(req.file.buffer);

    if (!uploadedImageUrl) {
      res.status(500).json({
        success: false,
        message: "Failed to upload image to Cloudinary",
      });
      return;
    }

    const newProduct = await prisma.product.create({
      data: {
        name,
        description,
        price: finalPrice,
        images: [uploadedImageUrl],
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

// 🔄 ৫. প্রোডাক্ট আপডেট করা
export const updateProduct = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    if (Array.isArray(id) || !id) {
      res
        .status(400)
        .json({ success: false, message: "Invalid ID configuration" });
      return;
    }

    const { name, description, price, category, stock } = req.body;

    const existingProduct = await prisma.product.findUnique({ where: { id } });
    if (!existingProduct) {
      res.status(404).json({ success: false, message: "Product not found" });
      return;
    }

    let updatedImages = existingProduct.images;

    if (req.file) {
      const uploadedImageUrl = await uploadToCloudinary(req.file.buffer);
      if (uploadedImageUrl) {
        updatedImages = [uploadedImageUrl];
      }
    }

    const finalPrice =
      price !== undefined
        ? typeof price === "string"
          ? parseFloat(price)
          : Number(price)
        : existingProduct.price;
    const finalStock =
      stock !== undefined
        ? typeof stock === "string"
          ? parseInt(stock)
          : Number(stock)
        : existingProduct.stock;

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        name: name || existingProduct.name,
        description: description || existingProduct.description,
        price: finalPrice,
        category: category || existingProduct.category,
        stock: finalStock,
        images: updatedImages,
      },
    });

    res.status(200).json({
      success: true,
      message: "Product updated successfully! 🔄",
      product: updatedProduct,
    });
  } catch (error) {
    console.error("❌ UpdateProduct Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// 🗑️ ৬. প্রোডাক্ট ডিলিট করা (Cascade-Safe & Super Clean)
export const deleteProduct = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    const existingProduct = await prisma.product.findUnique({
      where: { id: id as string },
    });
    if (!existingProduct) {
      res.status(404).json({ success: false, message: "Product not found" });
      return;
    }

    // ✨ ম্যাজিক: ডাটাবেজে Cascade থাকার কারণে এখন শুধু একটি সিঙ্গেল ডিলিট স্টেটমেন্টই যথেষ্ট!
    await prisma.product.delete({
      where: { id: id as string },
    });

    res.status(200).json({
      success: true,
      message: "Product and its all associated data deleted successfully! 🗑️🎉",
    });
  } catch (error) {
    console.error("❌ DeleteProduct Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

import { Request, Response } from "express";
import prisma from "../db.js";

export const getAllProducts = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      success: true,
      count: products.length,
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

export const createProduct = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { name, description, price, images, category, stock } = req.body;

    if (!name || !description || !price || !category) {
      res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
      return;
    }

    const newProduct = await prisma.product.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        images: images || [],
        category,
        stock: stock ? parseInt(stock) : 0,
      },
    });

    res.status(201).json({
      success: true,
      message: "Product created successfully!",
      product: newProduct,
    });
  } catch (error) {
    console.error("❌ CreateProduct Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

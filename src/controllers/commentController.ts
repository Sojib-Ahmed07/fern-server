import { Response } from "express";
import prisma from "../db.js";
import { AuthenticatedRequest } from "../middlewares/authMiddleware.js";

export const addComment = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const currentUser = req.user;
    const { productId, content, rating } = req.body;

    if (!productId || !content) {
      res.status(400).json({
        success: false,
        message: "Product ID and content are required.",
      });
      return;
    }

    const numericRating = rating ? parseInt(rating) : 5;
    if (numericRating < 1 || numericRating > 5) {
      res
        .status(400)
        .json({ success: false, message: "Rating must be between 1 and 5." });
      return;
    }

    const productExists = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!productExists) {
      res.status(404).json({ success: false, message: "Product not found." });
      return;
    }

    const newComment = await prisma.comment.create({
      data: {
        productId,
        userId: currentUser.id,
        content,
        rating: numericRating,
      },
      include: {
        user: {
          select: { name: true, image: true },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: "Review added successfully!",
      comment: newComment,
    });
  } catch (error) {
    console.error("❌ AddComment Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const deleteComment = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    if (typeof id !== "string") {
      res
        .status(400)
        .json({ success: false, message: "Invalid Comment ID format" });
      return;
    }

    const comment = await prisma.comment.findUnique({ where: { id } });

    if (!comment) {
      res.status(404).json({ success: false, message: "Comment not found." });
      return;
    }

    if (comment.userId !== currentUser.id && currentUser.role !== "ADMIN") {
      res
        .status(403)
        .json({
          success: false,
          message: "Unauthorized to delete this comment.",
        });
      return;
    }

    await prisma.comment.delete({ where: { id } });

    res.status(200).json({
      success: true,
      message: "Comment successfully deleted.",
    });
  } catch (error) {
    console.error("❌ DeleteComment Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

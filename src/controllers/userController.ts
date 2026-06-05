import { Request, Response } from "express";
import prisma from "../db.js";
import { AuthenticatedRequest } from "@/middlewares/authMiddleware.js";

// 👥 ১. সকল ইউজারের লিস্ট দেখা (Pagination ও Search সহ)
export const getAllUsers = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const pageNumber = parseInt(page as string);
    const limitNumber = parseInt(limit as string);
    const skip = (pageNumber - 1) * limitNumber;

    const whereCondition: any = {};
    if (search) {
      whereCondition.OR = [
        { name: { contains: search as string, mode: "insensitive" } },
        { email: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const [users, totalUsers] = await prisma.$transaction([
      prisma.user.findMany({
        where: whereCondition,
        skip,
        take: limitNumber,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          image: true,
        }, // পাসওয়ার্ড বাদে বাকি ডাটা নিচ্ছি সিকিউরিটির জন্য
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where: whereCondition }),
    ]);

    res.status(200).json({
      success: true,
      meta: {
        totalUsers,
        currentPage: pageNumber,
        totalPages: Math.ceil(totalUsers / limitNumber),
      },
      users,
    });
  } catch (error) {
    console.error("❌ GetAllUsers Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// 🔄 ২. ইউজারের রোল পরিবর্তন করা (USER <-> ADMIN)
export const updateUserRole = async (
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

    const { role } = req.body; // "USER" অথবা "ADMIN" আসবে

    if (role !== "USER" && role !== "ADMIN") {
      res.status(400).json({ success: false, message: "Invalid role type" });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, name: true, email: true, role: true },
    });

    res.status(200).json({
      success: true,
      message: "User role updated! 🔄",
      user: updatedUser,
    });
  } catch (error) {
    console.error("❌ UpdateUserRole Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// 🗑️ ৩. কোনো ইউজার ডিলিট করা
export const deleteUser = async (
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

    if (req.user?.id === id) {
      res.status(400).json({
        success: false,
        message: "You cannot delete your own admin account!",
      });
      return;
    }

    await prisma.user.delete({ where: { id } });
    res
      .status(200)
      .json({ success: true, message: "User deleted successfully! 🗑️" });
  } catch (error) {
    console.error("❌ DeleteUser Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

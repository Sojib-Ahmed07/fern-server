import { Request, Response } from "express";
import prisma from "../db.js";

// 📋 ১. সমস্ত কাস্টমারের অর্ডার লিস্ট দেখা (অ্যাডমিনের জন্য)
export const getAllOrdersForAdmin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            product: {
              select: { name: true, price: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" }, // লেটেস্ট অর্ডার সবার আগে থাকবে
    });

    res.status(200).json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    console.error("❌ GetAllOrdersForAdmin Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// 🔄 ২. অ্যাডমিন কর্তৃক অর্ডারের স্ট্যাটাস পরিবর্তন (যেমন: PENDING -> SHIPPED)
export const adminUpdateOrderStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["PENDING", "SHIPPED", "DELIVERED", "CANCELLED"];
    if (!status || !validStatuses.includes(status)) {
      res
        .status(400)
        .json({ success: false, message: "Invalid order status." });
      return;
    }

    const existingOrder = await prisma.order.findUnique({
      where: { id: String(id) },
    });

    if (!existingOrder) {
      res.status(404).json({ success: false, message: "Order not found." });
      return;
    }

    // স্ট্যাটাস আপডেট
    const updatedOrder = await prisma.order.update({
      where: { id: String(id) },
      data: { status },
    });

    res.status(200).json({
      success: true,
      message: `Order status successfully changed to ${status}`,
      order: updatedOrder,
    });
  } catch (error) {
    console.error("❌ AdminUpdateOrderStatus Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

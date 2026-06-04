import { Request, Response } from "express";
import axios from "axios";
import prisma from "../db.js";
import { AuthenticatedRequest } from "../middlewares/authMiddleware.js";

// 🔒 SSLCommerz কনফিগারেশন ক্রেডেনশিয়ালস
const STORE_ID = process.env.STORE_ID;
const STORE_PASSWORD = process.env.STORE_PASSWORD;
const isLive = process.env.IS_LIVE === "true";

const SSL_API = isLive
  ? "https://securepay.sslcommerz.com/gwprocess/v4/api.php"
  : "https://sandbox.sslcommerz.com/gwprocess/v4/api.php";

export const createOrder = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const currentUser = req.user;
    const { items, shippingInfo } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      res
        .status(400)
        .json({ success: false, message: "Cart items are required." });
      return;
    }

    if (!shippingInfo || !shippingInfo.address || !shippingInfo.phone) {
      res
        .status(400)
        .json({ success: false, message: "Shipping details are required." });
      return;
    }

    let totalAmount = 0;
    const orderItemsToCreate: {
      productId: string;
      quantity: number;
      price: number;
    }[] = [];

    for (const item of items) {
      const { productId, quantity } = item;
      const product = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        res
          .status(404)
          .json({ success: false, message: `Product ${productId} not found.` });
        return;
      }

      if (product.stock < quantity) {
        res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}.`,
        });
        return;
      }

      totalAmount += product.price * quantity;
      orderItemsToCreate.push({
        productId: product.id,
        quantity,
        price: product.price,
      });
    }

    const tran_id = `TXN-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const result = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          userId: currentUser.id,
          totalAmount: totalAmount,
          status: "PENDING",
          transactionId: tran_id,
          paymentStatus: "UNPAID",
          shippingAddress: JSON.stringify(shippingInfo),
          items: { create: orderItemsToCreate },
        },
        include: { items: true },
      });

      for (const item of orderItemsToCreate) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }
      return newOrder;
    });

    const formData = new URLSearchParams();
    formData.append("store_id", STORE_ID || "");
    formData.append("store_passwd", STORE_PASSWORD || "");
    formData.append("total_amount", totalAmount.toFixed(2));
    formData.append("currency", "BDT");
    formData.append("tran_id", tran_id);

    const backendBase = process.env.BACKEND_URL || "http://localhost:5000";
    formData.append(
      "success_url",
      `${backendBase}/api/orders/payment/success/${tran_id}`,
    );
    formData.append(
      "fail_url",
      `${backendBase}/api/orders/payment/fail/${tran_id}`,
    );
    formData.append(
      "cancel_url",
      `${backendBase}/api/orders/payment/cancel/${tran_id}`,
    );

    formData.append("shipping_method", "Courier");
    formData.append("product_name", "E-Commerce Items");
    formData.append("product_category", "Retail");
    formData.append("product_profile", "general");

    const customerName = shippingInfo.name || currentUser.name || "Customer";
    const customerEmail =
      shippingInfo.email || currentUser.email || "customer@mail.com";

    formData.append("cus_name", customerName);
    formData.append("cus_email", customerEmail);
    formData.append("cus_phone", shippingInfo.phone);
    formData.append("cus_add1", shippingInfo.address);
    formData.append("cus_city", "Dhaka");
    formData.append("cus_state", "Dhaka");
    formData.append("cus_postcode", "1000");
    formData.append("cus_country", "Bangladesh");
    formData.append("ship_name", customerName);
    formData.append("ship_add1", shippingInfo.address);
    formData.append("ship_city", "Dhaka");
    formData.append("ship_state", "Dhaka");
    formData.append("ship_postcode", "1000");
    formData.append("ship_country", "Bangladesh");

    const sslResponse = await fetch(SSL_API, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });

    const sslData = (await sslResponse.json()) as any;

    if (sslData?.status === "SUCCESS" && sslData?.GatewayPageURL) {
      res.status(201).json({
        success: true,
        message: "Redirecting to payment gateway...",
        GatewayPageURL: sslData.GatewayPageURL,
        order: result,
      });
    } else {
      // ✨ ফিক্স ১: update এর বদলে updateMany ব্যবহার করা হয়েছে সেইফ কুয়েরির জন্য
      await prisma.$transaction(async (tx) => {
        await tx.order.updateMany({
          where: { transactionId: tran_id },
          data: { status: "CANCELLED", paymentStatus: "FAILED" },
        });
        for (const item of orderItemsToCreate) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
      });

      console.error("❌ SSLCommerz Initialization Failed:", sslData);
      res.status(400).json({
        success: false,
        message: `SSLCommerz Failed: ${sslData?.failedreason || "Check server logs"}`,
      });
    }
  } catch (error) {
    console.error("❌ CreateOrder Global Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const handlePaymentSuccess = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { tranId } = req.params;
  const transactionIdString = Array.isArray(tranId)
    ? tranId[0]
    : (tranId as string);

  // ✨ ১. SSLCommerz কখনো কুয়েরি (GET) আবার কখনো বডি (POST) তে val_id পাঠায়
  const val_id = req.query.val_id || req.body.val_id;

  try {
    const validationUrl =
      process.env.IS_LIVE === "true"
        ? "https://securepay.sslcommerz.com/validator/api/validationserverAPI.php"
        : "https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php";

    // ✨ ২. ভ্যালিডেশন প্যারামিটার অবজেক্ট তৈরি
    const validationParams: any = {
      store_id: process.env.STORE_ID,
      store_passwd: process.env.STORE_PASSWORD,
      tran_id: transactionIdString,
      format: "json",
    };

    // যদি val_id পাওয়া যায়, তবে সেটি দিয়ে ভ্যালিডেশন করা সবচেয়ে নিরাপদ
    if (val_id) {
      validationParams.val_id = val_id;
    }

    console.log(
      "🔄 Validating payment with SSLCommerz for TXN:",
      transactionIdString,
    );

    const validationResponse = await axios({
      method: "GET",
      url: validationUrl,
      params: validationParams,
    });

    const resData = validationResponse.data;

    // ✨ ৩. স্যান্ডবক্স এনভায়রনমেন্টে সেফটি চেক (VALID, VALIDATED বা সরাসরি ট্রানজেকশন আইডি ম্যাচ করলে)
    if (
      resData.status === "VALID" ||
      resData.status === "VALIDATED" ||
      (resData.tran_id === transactionIdString && resData.amount > 0)
    ) {
      // পেমেন্ট স্ট্যাটাস PAID এবং অর্ডার স্ট্যাটাস PENDING করা
      await prisma.order.updateMany({
        where: { transactionId: transactionIdString },
        data: { paymentStatus: "PAID", status: "PENDING" },
      });

      console.log(
        "✅ Payment Verified Successfully for TXN:",
        transactionIdString,
      );
      res.redirect(
        `${process.env.FRONTEND_URL}/checkout/success?txn=${transactionIdString}`,
      );
    } else {
      // গেটওয়ে থেকে কী রেসপন্স আসলো তা কনসোলে দেখা (ডিবাগিংয়ের জন্য)
      console.error(
        "❌ SSLCommerz Validation Denied. Gateway Response:",
        resData,
      );
      throw new Error(
        `Gateway returned status: ${resData?.status || "UNKNOWN"}`,
      );
    }
  } catch (error) {
    console.error("❌ Payment Success Validation Error:", error);
    // ফেইল হলে ফ্রন্টঅ্যান্ডে রিডাইরেক্ট করা
    res.redirect(`${process.env.FRONTEND_URL}/checkout/fail`);
  }
};

export const handlePaymentFail = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { tranId } = req.params;
  const transactionIdString = Array.isArray(tranId)
    ? tranId[0]
    : (tranId as string);
  try {
    // ✨ ফিক্স ২: findUnique এর বদলে findFirst ব্যবহার করা হয়েছে ক্র্যাশ এড়াতে
    const existingOrder = await prisma.order.findFirst({
      where: { transactionId: transactionIdString },
      include: { items: true },
    });

    if (existingOrder && existingOrder.status !== "CANCELLED") {
      await prisma.$transaction(async (tx) => {
        await tx.order.updateMany({
          where: { transactionId: transactionIdString },
          data: { paymentStatus: "FAILED", status: "CANCELLED" },
        });

        for (const item of existingOrder.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
      });
    }
    res.redirect(`${process.env.FRONTEND_URL}/checkout/fail`);
  } catch (error) {
    console.error("❌ Payment Fail Handler Error:", error);
    res.redirect(`${process.env.FRONTEND_URL}/checkout/fail`);
  }
};

export const handlePaymentCancel = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { tranId } = req.params;
  const transactionIdString = Array.isArray(tranId)
    ? tranId[0]
    : (tranId as string);
  try {
    // ✨ ফিক্স ৩: findUnique এর বদলে findFirst ব্যবহার করা হয়েছে
    const existingOrder = await prisma.order.findFirst({
      where: { transactionId: transactionIdString },
      include: { items: true },
    });

    if (existingOrder && existingOrder.status !== "CANCELLED") {
      await prisma.$transaction(async (tx) => {
        await tx.order.updateMany({
          where: { transactionId: transactionIdString },
          data: { paymentStatus: "CANCELLED", status: "CANCELLED" },
        });

        for (const item of existingOrder.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }
      });
    }
    res.redirect(`${process.env.FRONTEND_URL}/checkout/fail`);
  } catch (error) {
    console.error("❌ Payment Cancel Handler Error:", error);
    res.redirect(`${process.env.FRONTEND_URL}/checkout/fail`);
  }
};

export const getMyOrders = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const currentUser = req.user;
    const orders = await prisma.order.findMany({
      where: {
        userId: currentUser.id,
        status: { not: "CANCELLED" },
      },
      include: {
        items: {
          include: {
            product: { select: { name: true, price: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({ success: true, count: orders.length, orders });
  } catch (error) {
    console.error("❌ GetMyOrders Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const getOrderDetails = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    const order = await prisma.order.findUnique({
      where: { id: String(id) },
      include: {
        items: {
          include: {
            product: { select: { name: true, images: true } },
          },
        },
      },
    });

    if (!order) {
      res.status(404).json({ success: false, message: "Order not found." });
      return;
    }

    if (order.userId !== currentUser.id && currentUser.role !== "ADMIN") {
      res
        .status(403)
        .json({ success: false, message: "Unauthorized to view this order." });
      return;
    }

    res.status(200).json({ success: true, order });
  } catch (error) {
    console.error("❌ GetOrderDetails Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const updateOrderStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const existingOrder = await prisma.order.findUnique({
      where: { id: String(id) },
      include: { items: true },
    });

    if (!existingOrder) {
      res.status(404).json({ success: false, message: "Order not found." });
      return;
    }

    if (
      existingOrder.status === "SHIPPED" ||
      existingOrder.status === "DELIVERED"
    ) {
      res.status(400).json({
        success: false,
        message: `Cannot cancel this order because it is already ${existingOrder.status}.`,
      });
      return;
    }

    if (status === "CANCELLED") {
      const updatedOrder = await prisma.$transaction(async (tx) => {
        for (const item of existingOrder.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }

        return await tx.order.update({
          where: { id: String(id) },
          data: { status: "CANCELLED", paymentStatus: "CANCELLED" },
        });
      });

      res.status(200).json({
        success: true,
        message: "Order successfully cancelled.",
        order: updatedOrder,
      });
      return;
    }

    const updatedOrder = await prisma.order.update({
      where: { id: String(id) },
      data: { status },
    });

    res.status(200).json({
      success: true,
      message: `Order status updated to ${status}!`,
      order: updatedOrder,
    });
  } catch (error) {
    console.error("❌ UpdateOrderStatus Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

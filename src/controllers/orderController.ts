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
      if (!productId || !quantity || quantity <= 0) {
        res
          .status(400)
          .json({ success: false, message: "Invalid product ID or quantity." });
        return;
      }

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

    const tran_id = `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

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

    // 💡 SSLCommerz-এর অল-ইন-ওয়ান ফুল ভ্যালিডেটেড রিকোয়েস্ট অবজেক্ট
    const params = new URLSearchParams();
    params.append("store_id", STORE_ID);
    params.append("store_passwd", STORE_PASSWORD);
    params.append("total_amount", totalAmount.toFixed(2));
    params.append("currency", "BDT");
    params.append("tran_id", tran_id);

    // ইউআরএল রুটস
    params.append(
      "success_url",
      `${process.env.BACKEND_URL}/api/orders/payment/success/${tran_id}`,
    );
    params.append(
      "fail_url",
      `${process.env.BACKEND_URL}/api/orders/payment/fail/${tran_id}`,
    );
    params.append(
      "cancel_url",
      `${process.env.BACKEND_URL}/api/orders/payment/cancel/${tran_id}`,
    );

    // প্রোডাক্ট ও শিপিং মেথড
    params.append("shipping_method", "Courier");
    params.append("product_name", "E-Commerce Items");
    params.append("product_category", "Electronic");
    params.append("product_profile", "general");

    // কাস্টমার ডিটেইলস (বাধ্যতামূলক)
    const customerName = shippingInfo.name || currentUser.name || "Customer";
    const customerEmail =
      shippingInfo.email || currentUser.email || "customer@mail.com";
    params.append("cus_name", customerName);
    params.append("cus_email", customerEmail);
    params.append("cus_phone", shippingInfo.phone);
    params.append("cus_add1", shippingInfo.address);
    params.append("cus_city", "Dhaka");
    params.append("cus_state", "Dhaka");
    params.append("cus_postcode", "1000");
    params.append("cus_country", "Bangladesh");

    // শিপিং ডিটেইলস (বাধ্যতামূলক)
    params.append("ship_name", customerName);
    params.append("ship_add1", shippingInfo.address);
    params.append("ship_city", "Dhaka");
    params.append("ship_state", "Dhaka");
    params.append("ship_postcode", "1000");
    params.append("ship_country", "Bangladesh");

    // 🔄 নেটওয়ার্ক রিকোয়েস্ট (Native Node Fetch)
    const sslResponse = await fetch(SSL_API, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(), // 👈 এটি প্রপারলি এনকোডেড কোয়েরি স্ট্রিং তৈরি করবে
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
      // সেশন ইনিশিয়েট ফেইল হলে ডাটাবেজ অর্ডার ক্যানসেল ও স্টক রিভার্সাল
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
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

      console.error("❌ SSLCommerz Failed. Full Response Data:", sslData);

      res.status(400).json({
        success: false,
        message: `SSLCommerz Error: ${sslData?.failedreason || "Failed to initiate session."}`,
        error: sslData,
      });
    }
  } catch (error) {
    console.error("❌ CreateOrder Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// 💳 ৫. পেমেন্ট সাকসেস হ্যান্ডলার (পাবলিক)
export const handlePaymentSuccess = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { tranId } = req.params;
  const transactionIdString = Array.isArray(tranId)
    ? tranId[0]
    : (tranId as string);

  try {
    // ১. SSLCommerz-কে ভ্যালিডেশনের জন্য রিকোয়েস্ট পাঠানো (Validation API)
    // এটি নিশ্চিত করে যে পেমেন্টটি জেনুইন।
    const validationUrl =
      process.env.IS_LIVE === "true"
        ? "https://securepay.sslcommerz.com/validator/api/validationserverAPI.php"
        : "https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php";

    const validationResponse = await axios({
      method: "GET",
      url: validationUrl,
      params: {
        val_id: req.body.val_id, // SSLCommerz এই POST রিকোয়েস্টের সাথে ভ্যালিডেশন আইডি পাঠায়
        store_id: process.env.STORE_ID,
        store_passwd: process.env.STORE_PASSWORD,
        format: "json",
      },
    });

    // ২. ভ্যালিডেশন চেক করা
    if (validationResponse.data.status === "VALID") {
      // ৩. পেমেন্ট ভ্যালিড হলে ডাটাবেজ আপডেট করা
      await prisma.order.updateMany({
        where: { transactionId: transactionIdString },
        data: { paymentStatus: "PAID", status: "PENDING" },
      });

      res.redirect(
        `${process.env.FRONTEND_URL}/checkout/success?txn=${transactionIdString}`,
      );
    } else {
      // ভ্যালিডেশন ফেইল হলে
      throw new Error("Payment validation failed!");
    }
  } catch (error) {
    console.error("❌ Payment Success Validation Error:", error);
    res.redirect(`${process.env.FRONTEND_URL}/checkout/fail`);
  }
};

// ❌ ৬. পেমেন্ট ফেইল হ্যান্ডলার (পাবলিক)
export const handlePaymentFail = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { tranId } = req.params;
  const transactionIdString = Array.isArray(tranId)
    ? tranId[0]
    : (tranId as string);
  try {
    const existingOrder = await prisma.order.findUnique({
      where: { transactionId: transactionIdString },
      include: { items: true },
    });

    if (existingOrder && existingOrder.status !== "CANCELLED") {
      // ট্রানজেকশন ফেইল হলে অর্ডার ক্যানসেল করা এবং স্টক ফিরিয়ে দেওয়া
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
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
    res.redirect(`${process.env.FRONTEND_URL}/checkout/fail`);
  }
};

// 🛑 ৭. পেমেন্ট ক্যান্সেল হ্যান্ডলার (পাবলিক)
export const handlePaymentCancel = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { tranId } = req.params;
  const transactionIdString = Array.isArray(tranId)
    ? tranId[0]
    : (tranId as string);
  try {
    const existingOrder = await prisma.order.findUnique({
      where: { transactionId: transactionIdString },
      include: { items: true },
    });

    if (existingOrder && existingOrder.status !== "CANCELLED") {
      await prisma.$transaction(async (tx) => {
        await tx.order.update({
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
    res.redirect(`${process.env.FRONTEND_URL}/checkout/fail`);
  }
};

// 📃 বাকি এক্সিস্টিং কোডসমূহ (যেমন ছিল তেমনই রাখা হয়েছে)
export const getMyOrders = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const currentUser = req.user;

    const orders = await prisma.order.findMany({
      where: { userId: currentUser.id },
      include: {
        _count: { select: { items: true } },
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

    if (typeof id !== "string") {
      res
        .status(400)
        .json({ success: false, message: "Invalid Order ID format" });
      return;
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              select: { name: true, images: true },
            },
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

    if (typeof id !== "string") {
      res
        .status(400)
        .json({ success: false, message: "Invalid Order ID format" });
      return;
    }

    const validStatuses = ["PENDING", "SHIPPED", "DELIVERED", "CANCELLED"];
    if (!status || !validStatuses.includes(status)) {
      res
        .status(400)
        .json({ success: false, message: "Invalid or missing order status." });
      return;
    }

    const existingOrder = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existingOrder) {
      res.status(404).json({ success: false, message: "Order not found." });
      return;
    }

    if (
      existingOrder.status === "CANCELLED" ||
      existingOrder.status === "DELIVERED"
    ) {
      res.status(400).json({
        success: false,
        message: `Cannot change status of a ${existingOrder.status} order.`,
      });
      return;
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.update({
        where: { id },
        data: { status },
      });

      if (status === "CANCELLED") {
        for (const item of existingOrder.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: {
                increment: item.quantity,
              },
            },
          });
        }
      }

      return order;
    });

    res.status(200).json({
      success: true,
      message: `Order status updated to ${status}! Inflow inventory adjusted.`,
      order: updatedOrder,
    });
  } catch (error) {
    console.error("❌ UpdateOrderStatus Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

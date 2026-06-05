import prisma from "../db.js";
export const getDashboardStats = async (req, res) => {
    try {
        // 📊 ১. প্রিজমা ট্রানজেকশন দিয়ে প্যারালালি সব কাউন্ট ও সামারি নিয়ে আসা
        const [productCount, userCount, orderCount, recentOrders] = await prisma.$transaction([
            prisma.product.count(),
            prisma.user.count(),
            prisma.order.count(),
            prisma.order.findMany({
                take: 5,
                orderBy: { createdAt: "desc" },
                include: {
                    user: { select: { name: true, email: true } },
                },
            }),
        ]);
        // 💰 ২. মোট রেভিনিউ বা সেলস ক্যালকুলেট করা (DELIVERED বা সফল অর্ডারগুলোর মোট অ্যামাউন্ট)
        const salesData = await prisma.order.aggregate({
            where: {
                status: "DELIVERED", // শুধু ডেলিভারড অর্ডারগুলোর টাকা যোগ হবে
            },
            _sum: {
                totalAmount: true,
            },
        });
        const totalSales = salesData._sum.totalAmount || 0;
        res.status(200).json({
            success: true,
            stats: {
                totalSales,
                totalOrders: orderCount,
                totalProducts: productCount,
                totalUsers: userCount,
            },
            recentOrders,
        });
    }
    catch (error) {
        console.error("❌ Dashboard Stats Error:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

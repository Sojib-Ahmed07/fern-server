export const isAdmin = async (req, res, next) => {
    try {
        const currentUser = req.user;
        if (!currentUser) {
            res.status(401).json({
                success: false,
                message: "Unauthorized. Please login first.",
            });
            return;
        }
        if (currentUser.role !== "ADMIN") {
            res.status(403).json({
                success: false,
                message: "Forbidden. Access denied. Admin rights required.",
            });
            return;
        }
        next();
    }
    catch (error) {
        console.error("🔒 Admin Middleware Error:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

import { auth } from "../config/auth.js";
export const isAuthenticated = async (req, res, next) => {
    try {
        const session = await auth.api.getSession({
            headers: {
                cookie: req.headers.cookie,
                authorization: req.headers.authorization,
            },
        });
        if (!session) {
            res.status(401).json({
                error: "UNAUTHORIZED",
                message: "You must be logged in to access this resource.",
            });
            return;
        }
        if (!session.user.emailVerified) {
            res.status(403).json({
                error: "EMAIL_NOT_VERIFIED",
                message: "Access denied. Please verify your email address first.",
                user: {
                    email: session.user.email,
                    name: session.user.name,
                    emailVerified: false,
                },
            });
            return;
        }
        req.user = session.user;
        req.session = session.session;
        next();
    }
    catch (error) {
        console.error("🔒 Auth Middleware Error:", error);
        res.status(500).json({
            error: "INTERNAL_SERVER_ERROR",
            message: "Something went wrong.",
        });
    }
};

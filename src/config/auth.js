// import { betterAuth } from "better-auth";
// import { prismaAdapter } from "better-auth/adapters/prisma";
// import prisma from "../db.js";
// import { sendEmail } from "./mail.js";
// export const auth = betterAuth({
//   database: prismaAdapter(prisma as any, {
//     provider: "postgresql",
//   }),
//   emailAndPassword: {
//     enabled: true,
//     // 🔑 পাসওয়ার্ড রিসেট ইমেইল পাঠানোর হুক
//     sendResetPassword: async ({ user, url }) => {
//       await sendEmail({
//         to: user.email,
//         name: user.name,
//         subject: "Reset your Password - FERN_SHOP",
//         html: `
//           <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; border-radius: 8px;">
//             <h2 style="color: #18181b; text-align: center;">Reset Your Password</h2>
//             <p style="color: #71717a; font-size: 16px;">Hi ${user.name || "there"},</p>
//             <p style="color: #71717a; font-size: 16px;">We received a request to reset the password for your account. Click the button below to set up a new password:</p>
//             <div style="text-align: center; margin: 30px 0;">
//               <a href="${url}" style="background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block;">Reset Password</a>
//             </div>
//             <p style="color: #71717a; font-size: 14px; text-align: center; margin-bottom: 20px;">This password reset link will expire shortly for security purposes.</p>
//             <p style="color: #a1a1aa; font-size: 12px; text-align: center;">If the button doesn't work, copy and paste this link into your browser:<br><a href="${url}">${url}</a></p>
//             <hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 20px 0;">
//             <p style="color: #71717a; font-size: 14px; text-align: center;">If you didn't request a password reset, you can safely ignore this email and your password will remain unchanged.</p>
//           </div>
//         `,
//       });
//     },
//   },
//   socialProviders: {
//     google: {
//       clientId: process.env.GOOGLE_CLIENT_ID as string,
//       clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
//     },
//   },
//   emailVerification: {
//     sendOnSignUp: true,
//     sendVerificationEmail: async ({ user, url, token }) => {
//       await sendEmail({
//         to: user.email,
//         name: user.name,
//         subject: "Verify your Email Address - E-Commerce",
//         html: `
//           <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; border-radius: 8px;">
//             <h2 style="color: #18181b; text-align: center;">Welcome to our E-Commerce Store!</h2>
//             <p style="color: #71717a; font-size: 16px;">Hi ${user.name || "there"},</p>
//             <p style="color: #71717a; font-size: 16px;">Thank you for signing up. Please click the button below to verify your email address and activate your account:</p>
//             <div style="text-align: center; margin: 30px 0;">
//               <a href="${url}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block;">Verify Email Address</a>
//             </div>
//             <p style="color: #a1a1aa; font-size: 12px; text-align: center;">If the button doesn't work, copy and paste this link into your browser:<br><a href="${url}">${url}</a></p>
//             <hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 20px 0;">
//             <p style="color: #71717a; font-size: 14px; text-align: center;">If you didn't create this account, you can safely ignore this email.</p>
//           </div>
//         `,
//       });
//     },
//   },
//   // 🔗 বিশ্বস্ত সোর্স হিসেবে ফ্রন্টঅ্যান্ড ইউআরএল
//   trustedOrigins: ["http://localhost:3000", "http://localhost:5000"],
//   user: {
//     additionalFields: {
//       role: {
//         type: "string",
//         defaultValue: "USER",
//       },
//     },
//   },
// });
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "../db.js";
import { sendEmail } from "./mail.js";
export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    // 🎯 ফিক্স ১: Better Auth-কে তার নিজস্ব রুট এপিআই পাথ চেনানোর জন্য baseURL আবশ্যিক
    // এটি না থাকলে Better Auth এক্সপ্রেসের পাঠানো সাব-পাথগুলোকে (যেমন /forget-password) চিনতে না পেরে ৪MD দেয়।
    baseURL: "http://localhost:5000/api/auth",
    emailAndPassword: {
        enabled: true,
        // 💡 সেইফ প্র্যাকটিস: রিসেটের সময় কোনো অটো সাইন-ইন ট্রিম হবে না
        autoSignIn: false,
        // 🔑 পাসওয়ার্ড রিসেট ইমেইল পাঠানোর হুক
        sendResetPassword: async ({ user, url }) => {
            await sendEmail({
                to: user.email,
                name: user.name,
                subject: "Reset your Password - FERN_SHOP",
                html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; border-radius: 8px;">
            <h2 style="color: #18181b; text-align: center;">Reset Your Password</h2>
            <p style="color: #71717a; font-size: 16px;">Hi ${user.name || "there"},</p>
            <p style="color: #71717a; font-size: 16px;">We received a request to reset the password for your account. Click the button below to set up a new password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${url}" style="background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block;">Reset Password</a>
            </div>
            <p style="color: #71717a; font-size: 14px; text-align: center; margin-bottom: 20px;">This password reset link will expire shortly for security purposes.</p>
            <p style="color: #a1a1aa; font-size: 12px; text-align: center;">If the button doesn't work, copy and paste this link into your browser:<br><a href="${url}">${url}</a></p>
            <hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 20px 0;">
            <p style="color: #71717a; font-size: 14px; text-align: center;">If you didn't request a password reset, you can safely ignore this email and your password will remain unchanged.</p>
          </div>
        `,
            });
        },
    },
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
    },
    emailVerification: {
        sendOnSignUp: true,
        sendVerificationEmail: async ({ user, url, token }) => {
            await sendEmail({
                to: user.email,
                name: user.name,
                subject: "Verify your Email Address - E-Commerce",
                html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; border-radius: 8px;">
            <h2 style="color: #18181b; text-align: center;">Welcome to our E-Commerce Store!</h2>
            <p style="color: #71717a; font-size: 16px;">Hi ${user.name || "there"},</p>
            <p style="color: #71717a; font-size: 16px;">Thank you for signing up. Please click the button below to verify your email address and activate your account:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${url}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block;">Verify Email Address</a>
            </div>
            <p style="color: #a1a1aa; font-size: 12px; text-align: center;">If the button doesn't work, copy and paste this link into your browser:<br><a href="${url}">${url}</a></p>
            <hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 20px 0;">
            <p style="color: #71717a; font-size: 14px; text-align: center;">If you didn't create this account, you can safely ignore this email.</p>
          </div>
        `,
            });
        },
    },
    // 🔗 বিশ্বস্ত সোর্স হিসেবে ফ্রন্টঅ্যান্ড ইউআরএল
    trustedOrigins: ["http://localhost:3000", "http://localhost:5000"],
    user: {
        additionalFields: {
            role: {
                type: "string",
                defaultValue: "USER",
            },
        },
    },
});

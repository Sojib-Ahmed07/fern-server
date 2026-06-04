import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "../db.js";
import { sendEmail } from "./mail.js";

export const auth = betterAuth({
  database: prismaAdapter(prisma as any, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,
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

import "dotenv/config";
export const sendEmail = async ({ to, name, subject, html, }) => {
    try {
        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
                accept: "application/json",
                "content-type": "application/json",
                "api-key": process.env.BREVO_API_KEY || "",
            },
            body: JSON.stringify({
                sender: {
                    name: "E-Commerce Store",
                    email: process.env.SMTP_USER || "noreply@yourdomain.com",
                },
                to: [{ email: to, name: name || "User" }],
                subject: subject,
                htmlContent: html,
            }),
        });
        if (response.ok) {
            console.log(`📧 Brevo API: Email successfully sent to ${to}`);
            return true;
        }
        else {
            const errorData = await response.json();
            console.error("❌ Brevo API Response Error:", errorData);
            return false;
        }
    }
    catch (error) {
        console.error("❌ Failed to send email via Brevo API:", error);
        return false;
    }
};

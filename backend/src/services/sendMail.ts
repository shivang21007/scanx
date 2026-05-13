import nodemailer from 'nodemailer';
import { env } from '../env/env';
import { systemLog } from '../logger/logger';

const SMTP_HOST = env.SMTP_HOST || "localhost";
const SMTP_PORT = env.SMTP_PORT ? parseInt(env.SMTP_PORT, 10) : 1025;
const FROM_EMAIL = env.SMTP_FROM;
const SECURE = env.SMTP_SECURE === 'true' || env.SMTP_SECURE === '1';


export const sendForgotPasswordOTPMail = async (to: string, otp: string) => {
    try {
        const transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SECURE,
            tls: { rejectUnauthorized: false },
        });

        const info = await transporter.sendMail({
            from: FROM_EMAIL,
            to: to,
            subject: "ScanX Forgot Password OTP",
            html: `
        <h3 style="color: #000000;">Your ScanX Forgot Password OTP is <span style="color: #000000; font-weight: bold;">${otp}</span>.</h3>
        <p style="color: #000000;">Please use this OTP to reset your password.</p>
        <p style="color: #000000;">If you did not request this OTP, please ignore this email.</p>
        <p style="color: #000000;">This OTP will expire in 10 minutes.</p>
        <p style="color: #000000;">Thank you for using ScanX.</p>
        <h3 style="color: #000000; font-weight: bold;">Best regards,</h3>
        <h3 style="color: #000000; font-weight: bold;">ScanX</h3>
        `,
        });

        systemLog.info('email_forgot_password_sent', { to, response: info.response || String(info) });
        return info;
    } catch (err: any) {
        systemLog.error('email_forgot_password_failed', { to, error: String(err) });
        throw err;
    }
}


export const sendRegistrationWelcomeMail = async (to: string, name: string) => {
    try {
        const transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SECURE,
            tls: { rejectUnauthorized: false },
        });
        const info = await transporter.sendMail({
            from: FROM_EMAIL,
            to: to,
            subject: "Welcome to ScanX",
            html: `
        <h3 style="color: #000000;">Welcome to ScanX, ${name}.</h3>
        <p style="color: #000000;">Thank you for registering with ScanX.</p>
        <p style="color: #000000;">Please login to your account to continue.</p>
        <p style="color: #000000;">If you have any questions, please contact us at <a href="mailto:shivang.gupta@octrotalk.com">shivang.gupta@octrotalk.com</a>.</p>
        <h3 style="color: #000000; font-weight: bold;">Best regards,</h3>
        <h3 style="color: #000000; font-weight: bold;">ScanX</h3>
        `,
        });
        systemLog.info('email_welcome_sent', { to, response: info.response || String(info) });
        return info;
    } catch (err: any) {
        systemLog.error('email_welcome_failed', { to, error: String(err) });
        throw err;
    }
}
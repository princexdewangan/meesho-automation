import nodemailer from 'nodemailer';
import { fetchSettings, logEvent } from './api.js';

export async function sendEmailAlertDirect(subject: string, htmlContent: string) {
  try {
    const settings = await fetchSettings();

    // Check if configuration placeholders are still default
    if (
      !settings.smtpUser ||
      settings.smtpUser.includes('your-') ||
      (settings.smtpHost === 'smtp.mailtrap.io' && settings.smtpUser === 'your-smtp-user')
    ) {
      console.warn(
        'SMTP settings are default/placeholder. Skipping sending alert email. Logging message to console:'
      );
      console.log(`[WORKER ALERT EMAIL] Subject: ${subject}\nBody: ${htmlContent}`);
      return;
    }

    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: Number(settings.smtpPort),
      secure: Number(settings.smtpPort) === 465,
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPass,
      },
    });

    await transporter.sendMail({
      from: settings.smtpFrom,
      to: settings.adminEmail,
      subject: `[Affiliate Auto Alert] ${subject}`,
      html: htmlContent,
    });

    console.log(`Successfully sent email alert from worker: ${subject}`);
  } catch (error: any) {
    console.error('Worker failed to send email alert:', error);
    await logEvent('ERROR', `Worker failed to send email alert: ${subject}`, error.stack);
  }
}

import nodemailer from 'nodemailer';
import { prisma } from './prisma';

const DEFAULT_SETTINGS = {
  adminEmail: 'admin@example.com',
  smtpHost: 'smtp.mailtrap.io',
  smtpPort: '2525',
  smtpUser: 'your-smtp-user',
  smtpPass: 'your-smtp-pass',
  smtpFrom: 'alerts@affiliateautomation.com',
};

async function getEmailConfig() {
  const dbSettings = await prisma.setting.findMany();
  const settingsMap = { ...DEFAULT_SETTINGS };
  for (const s of dbSettings) {
    if (s.key in DEFAULT_SETTINGS) {
      settingsMap[s.key as keyof typeof DEFAULT_SETTINGS] = s.value;
    }
  }
  return settingsMap;
}

export async function sendEmailAlert(subject: string, htmlContent: string) {
  try {
    const config = await getEmailConfig();

    // Skip if placeholders are not updated
    if (
      config.smtpUser.includes('your-') ||
      (config.smtpHost === 'smtp.mailtrap.io' && config.smtpUser === 'your-smtp-user')
    ) {
      console.warn(
        'SMTP settings are default/placeholder. Skipping sending alert email. Logging message to console:'
      );
      console.log(`[ALERT EMAIL] Subject: ${subject}\nBody: ${htmlContent}`);
      return;
    }

    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: Number(config.smtpPort),
      secure: Number(config.smtpPort) === 465,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
    });

    await transporter.sendMail({
      from: config.smtpFrom,
      to: config.adminEmail,
      subject: `[Affiliate Auto Alert] ${subject}`,
      html: htmlContent,
    });

    console.log(`Successfully sent email alert: ${subject}`);
  } catch (error) {
    console.error('Failed to send email alert:', error);
    // Write log to DB
    await prisma.log.create({
      data: {
        level: 'ERROR',
        message: `Failed to send email alert: ${subject}`,
        details: error instanceof Error ? error.stack : String(error),
      },
    });
  }
}

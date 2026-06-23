import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const DEFAULT_SETTINGS = {
  // Wishlink link generator page selectors (adjust if UI changes)
  wishlinkUrlInput: "input[placeholder*='paste any link']",
  wishlinkGenerateBtn: "button.generate-btn, button:has-text('Generate')",
  wishlinkShortlinkText: "a[href*='wishlink.com'], input[readonly]",
  
  // Notification configurations
  adminEmail: "admin@example.com",
  smtpHost: "smtp.mailtrap.io",
  smtpPort: "2525",
  smtpUser: "your-smtp-user",
  smtpPass: "your-smtp-pass",
  smtpFrom: "alerts@affiliateautomation.com",
  
  // Duplicate check settings
  duplicateCheckDays: "7",
  whatsappStatus: "DISCONNECTED",
  whatsappQrCode: ""
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}

export async function GET() {
  try {
    const dbSettings = await prisma.setting.findMany();
    
    // Merge database settings with default values
    const settingsMap: Record<string, string> = { ...DEFAULT_SETTINGS };
    for (const setting of dbSettings) {
      settingsMap[setting.key] = setting.value;
    }
    
    return NextResponse.json({ success: true, settings: settingsMap });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as Partial<{ key: string; value: string }>;
    const { key, value } = body;
    
    if (!key || value === undefined) {
      return NextResponse.json(
        { success: false, error: 'Key and value are required' },
        { status: 400 }
      );
    }
    
    const setting = await prisma.setting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) }
    });
    
    return NextResponse.json({ success: true, setting });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

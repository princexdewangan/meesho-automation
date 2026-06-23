import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { chromium } from 'playwright';
import { config } from '../config.js';
import { logEvent } from './api.js';

let client: any = null;
let whatsappStatus: 'CONNECTED' | 'DISCONNECTED' | 'INITIALIZING' = 'DISCONNECTED';

// Exposed API to update status in the Dashboard DB
async function updateWhatsappStatus(status: typeof whatsappStatus, qrCode?: string) {
  whatsappStatus = status;
  try {
    const res = await fetch(`${config.dashboardUrl}/api/worker/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'whatsappStatus', value: status }),
    });

    if (qrCode !== undefined) {
      await fetch(`${config.dashboardUrl}/api/worker/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'whatsappQrCode', value: qrCode }),
      });
    }
  } catch (error) {
    console.error('Failed to report WhatsApp status to dashboard', error);
  }
}

export async function initWhatsApp() {
  if (client) return client;

  console.log('Initializing WhatsApp Web client...');
  await updateWhatsappStatus('INITIALIZING', '');

  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: config.whatsappSessionPath,
    }),
    puppeteer: {
      headless: true,
      executablePath: config.browserExecutablePath || chromium.executablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  client.on('qr', async (qr: string) => {
    console.log('WhatsApp QR Code generated. Scan to authenticate:');
    qrcode.generate(qr, { small: true });

    // Save QR to DB so Next.js dashboard can read and draw it
    await updateWhatsappStatus('DISCONNECTED', qr);
  });

  client.on('ready', async () => {
    console.log('WhatsApp Client is READY and CONNECTED!');
    await updateWhatsappStatus('CONNECTED', '');
    await logEvent('INFO', 'WhatsApp Web Automation client successfully connected.');
  });

  client.on('auth_failure', async (msg: string) => {
    console.error('WhatsApp Authentication failure:', msg);
    await updateWhatsappStatus('DISCONNECTED', '');
    await logEvent('ERROR', 'WhatsApp Auth Failure', msg);
  });

  client.on('disconnected', async (reason: string) => {
    console.log('WhatsApp Client was disconnected:', reason);
    await updateWhatsappStatus('DISCONNECTED', '');
    await logEvent('WARN', 'WhatsApp Client disconnected', reason);
  });

  await client.initialize();
  return client;
}

export function getWhatsAppStatus() {
  return whatsappStatus;
}

/**
 * Searches for a chat/group/community by name and sends a message to it
 */
export async function sendWhatsAppMessage(targetName: string, message: string): Promise<boolean> {
  if (!client || whatsappStatus !== 'CONNECTED') {
    throw new Error('WhatsApp client is not connected or initialized.');
  }

  try {
    console.log(`Locating WhatsApp chat named: "${targetName}"...`);
    const chats = await client.getChats();
    const chat = chats.find((c: any) => c.name.toLowerCase() === targetName.toLowerCase());

    if (!chat) {
      throw new Error(
        `WhatsApp Chat/Group/Community named "${targetName}" could not be found. Make sure the account has this chat open.`
      );
    }

    console.log(`Sending message to "${targetName}"...`);
    await chat.sendMessage(message);
    await logEvent('INFO', `Message posted to WhatsApp Chat "${targetName}" successfully.`);
    return true;
  } catch (error: any) {
    await logEvent('ERROR', `WhatsApp send message failed: ${error.message}`, error.stack);
    throw error;
  }
}

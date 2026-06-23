import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { existsSync } from 'fs';
import { chromium } from 'playwright';
import { config } from '../config.js';
import { logEvent } from './api.js';

let client: any = null;
let whatsappStatus: 'CONNECTED' | 'DISCONNECTED' | 'INITIALIZING' = 'DISCONNECTED';

function getBrowserExecutablePath() {
  const candidates = [
    config.browserExecutablePath,
    chromium.executablePath(),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean) as string[];

  const executablePath = candidates.find((candidate) => existsSync(candidate));
  if (executablePath) return executablePath;

  throw new Error(
    [
      'No Chromium/Chrome executable was found for WhatsApp Web.',
      'Install Playwright Chromium with `npm run browser:install --workspace=apps/worker`,',
      'or set CHROME_EXECUTABLE_PATH to your Chrome executable path.',
    ].join(' ')
  );
}

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
  const executablePath = getBrowserExecutablePath();
  console.log(`Using browser executable: ${executablePath}`);

  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: config.whatsappSessionPath,
    }),
    puppeteer: {
      headless: true,
      executablePath,
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

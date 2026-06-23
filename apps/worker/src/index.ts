import { initWhatsApp } from './services/whatsapp.js';
import { startQueueSchedulers, linkGenQueue, whatsappPostQueue } from './queues/dealQueue.js';
import { closeBrowser } from './services/playwright.js';
import { logEvent } from './services/api.js';

async function bootstrap() {
  console.log('-------------------------------------------');
  console.log('Meesho/Amazon Affiliate Automation Worker Starting');
  console.log('-------------------------------------------');

  try {
    // 1. Initialize WhatsApp Web Client
    await initWhatsApp();

    // 2. Start polling and queue processing schedulers
    startQueueSchedulers();

    await logEvent('INFO', 'Affiliate Automation Worker successfully started.');
    console.log('Worker is listening for jobs and DB changes...');
  } catch (error: any) {
    console.error('Failed to bootstrap worker:', error);
    await logEvent('ERROR', 'Failed to bootstrap background worker', error.stack);
    process.exit(1);
  }
}

// Graceful shutdown handling
async function shutdown() {
  console.log('\nGracefully shutting down worker...');
  try {
    await closeBrowser();
    await linkGenQueue.close();
    await whatsappPostQueue.close();
    console.log('Clean shutdown complete.');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

bootstrap();

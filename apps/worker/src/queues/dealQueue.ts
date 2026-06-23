import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config.js';
import { fetchDeals, updateDeal, logEvent, Deal } from '../services/api.js';
import { generateWishlink } from '../services/playwright.js';
import { sendWhatsAppMessage } from '../services/whatsapp.js';
import { sendEmailAlertDirect } from '../services/notifier.js';

// Setup Redis connection options
const connectionOptions = {
  host: config.redis.host,
  port: config.redis.port,
  maxRetriesPerRequest: null, // Required by BullMQ
};

// Define queues
export const linkGenQueue = new Queue('link-generation', { connection: connectionOptions });
export const whatsappPostQueue = new Queue('whatsapp-posting', { connection: connectionOptions });

/**
 * Calculates the next available schedule time slot for posting,
 * ensuring a spacing of 3 hours between posts.
 */
async function calculateNextPostSlot(): Promise<Date> {
  const now = new Date();

  // Fetch deals to inspect scheduled/posted times
  const activeDeals = await fetchDeals();

  // Filter for deals that are SCHEDULED or POSTED and have a scheduledTime
  const timedDeals = activeDeals
    .filter((d: Deal) => (d.status === 'SCHEDULED' || d.status === 'POSTED') && d.scheduledTime)
    .map((d: Deal) => new Date(d.scheduledTime!));

  if (timedDeals.length === 0) {
    // If no deals are scheduled, set schedule to now
    return now;
  }

  // Find the latest scheduled time
  const maxScheduledTime = new Date(Math.max(...timedDeals.map(d => d.getTime())));

  // If the latest scheduled slot is in the past, schedule 3 hours from now or from the last post
  if (maxScheduledTime.getTime() < now.getTime()) {
    const nextSlot = new Date(maxScheduledTime.getTime() + 3 * 60 * 60 * 1000);
    return nextSlot.getTime() > now.getTime() ? nextSlot : now;
  }

  // Otherwise, schedule 3 hours after the latest scheduled slot
  return new Date(maxScheduledTime.getTime() + 3 * 60 * 60 * 1000);
}

// 1. Worker for generating affiliate link (Playwright)
const linkGenWorker = new Worker(
  'link-generation',
  async job => {
    const { dealId } = job.data;
    console.log(`[LinkGen Worker] Processing deal ID: ${dealId}`);

    // Fetch deal
    const deals = await fetchDeals();
    const deal = deals.find(d => d.id === dealId);
    if (!deal) throw new Error(`Deal ${dealId} not found`);

    // Update status to GENERATING
    await updateDeal(dealId, { status: 'GENERATING' });

    try {
      // Run browser automation to convert URL
      const shortlink = await generateWishlink(deal.externalUrl);

      // Calculate scheduling slot (spaced by 3 hours)
      const nextSlot = await calculateNextPostSlot();

      // Update DB
      await updateDeal(dealId, {
        status: 'SCHEDULED',
        wishlinkUrl: shortlink,
        scheduledTime: nextSlot.toISOString(),
      });

      await logEvent(
        'INFO',
        `Successfully generated Wishlink and scheduled post.`,
        `Deal: ${deal.productName}\nURL: ${shortlink}\nScheduled Time: ${nextSlot.toLocaleString()}`
      );
    } catch (err: any) {
      await updateDeal(dealId, { status: 'FAILED' });
      await sendEmailAlertDirect(
        `Failed to generate Wishlink: ${deal.productName}`,
        `<p>Error converting URL for deal <b>${deal.productName}</b>.</p><p>Error message: ${err.message}</p>`
      );
      throw err;
    }
  },
  { connection: connectionOptions }
);

// 2. Worker for posting to WhatsApp Web (whatsapp-web.js)
const whatsappPostWorker = new Worker(
  'whatsapp-posting',
  async job => {
    const { dealId } = job.data;
    console.log(`[WhatsApp Worker] Posting deal ID: ${dealId}`);

    const deals = await fetchDeals();
    const deal = deals.find(d => d.id === dealId);
    if (!deal) throw new Error(`Deal ${dealId} not found`);

    try {
      // Build message format: [Product Name] + [MRP] + [Offer Price] + [Wishlink URL]
      const message =
        `🛍️ *${deal.productName}*\n\n` +
        `❌ MRP: ~₹${deal.mrp}~\n` +
        `✅ *Offer Price: ₹${deal.offerPrice}*\n\n` +
        `👉 *Buy Here:* ${deal.wishlinkUrl}`;

      // Send to WhatsApp group
      await sendWhatsAppMessage(config.whatsappCommunityName, message);

      // Update status to POSTED
      await updateDeal(dealId, { status: 'POSTED' });
    } catch (err: any) {
      await logEvent('ERROR', `WhatsApp posting failed for deal: ${deal.productName}`, err.stack);
      await sendEmailAlertDirect(
        `WhatsApp Post Failure: ${deal.productName}`,
        `<p>Failed to post <b>${deal.productName}</b> to WhatsApp group "${config.whatsappCommunityName}".</p><p>Error: ${err.message}</p>`
      );
      throw err;
    }
  },
  { connection: connectionOptions }
);

/**
 * Periodically polls the database for:
 * 1. PENDING deals to enqueue link generation.
 * 2. SCHEDULED deals whose scheduledTime has arrived to enqueue WhatsApp posting.
 */
export function startQueueSchedulers() {
  console.log('Starting polling schedulers...');

  // Poll every 30 seconds
  setInterval(async () => {
    try {
      const deals = await fetchDeals();
      const now = new Date();

      // Find PENDING deals
      const pendingDeals = deals.filter(d => d.status === 'PENDING');
      for (const deal of pendingDeals) {
        // Enqueue generation job if not already active in BullMQ
        const jobId = `gen-${deal.id}`;
        console.log(`Enqueuing link generation for: ${deal.productName}`);
        await linkGenQueue.add(
          'generate-link',
          { dealId: deal.id },
          { jobId, removeOnComplete: true }
        );
        // Set state temporarily to GENERATING to avoid double queuing in next poll
        await updateDeal(deal.id, { status: 'GENERATING' });
      }

      // Find SCHEDULED deals where scheduledTime <= now
      const dueDeals = deals.filter(d => {
        if (d.status !== 'SCHEDULED' || !d.scheduledTime) return false;
        return new Date(d.scheduledTime) <= now;
      });

      for (const deal of dueDeals) {
        const jobId = `post-${deal.id}`;
        console.log(`Enqueuing WhatsApp post for: ${deal.productName}`);
        await whatsappPostQueue.add(
          'post-whatsapp',
          { dealId: deal.id },
          { jobId, removeOnComplete: true }
        );
        // Set state to POSTING to avoid double queue
        await updateDeal(deal.id, { status: 'POSTED' }); // Temporarily advance to prevent duplicate firing
      }
    } catch (err) {
      console.error('Queue scheduler polling error:', err);
    }
  }, 30000);
}

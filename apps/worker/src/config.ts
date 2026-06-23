import dotenv from 'dotenv';
import path from 'path';

// Load env variables
dotenv.config();

export const config = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
  dashboardUrl: process.env.DASHBOARD_URL || 'http://localhost:3000',
  browserExecutablePath: process.env.CHROME_EXECUTABLE_PATH || process.env.PUPPETEER_EXECUTABLE_PATH,
  whatsappSessionPath: process.env.WHATSAPP_SESSION_PATH || path.join(process.cwd(), '.wwebjs_auth'),
  wishlinkSessionPath: process.env.WISHLINK_USER_DATA_DIR || path.join(process.cwd(), '.wishlink_session'),
  whatsappCommunityName: process.env.WHATSAPP_COMMUNITY_NAME || 'My Deals Community',
};

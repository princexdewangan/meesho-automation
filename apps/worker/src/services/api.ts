import { config } from '../config.js';

export interface Deal {
  id: string;
  externalUrl: string;
  normalizedUrl: string;
  productName: string;
  mrp: number;
  offerPrice: number;
  wishlinkUrl?: string;
  status: string;
  scheduledTime?: string;
  platform: string;
  createdAt: string;
  updatedAt: string;
}

export async function fetchSettings() {
  try {
    const res = await fetch(`${config.dashboardUrl}/api/worker/settings`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.settings;
  } catch (error) {
    console.error('API Error: fetchSettings failed', error);
    throw error;
  }
}

export async function fetchDeals(status?: string, limit?: number): Promise<Deal[]> {
  try {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (limit) params.append('limit', String(limit));

    const res = await fetch(`${config.dashboardUrl}/api/worker/deals?${params.toString()}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.deals;
  } catch (error) {
    console.error(`API Error: fetchDeals failed for status ${status}`, error);
    throw error;
  }
}

export async function updateDeal(id: string, updateData: Partial<Pick<Deal, 'status' | 'wishlinkUrl' | 'scheduledTime'>>): Promise<Deal> {
  try {
    const res = await fetch(`${config.dashboardUrl}/api/worker/deals`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updateData }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.deal;
  } catch (error) {
    console.error(`API Error: updateDeal failed for ID ${id}`, error);
    throw error;
  }
}

export async function logEvent(level: 'INFO' | 'WARN' | 'ERROR', message: string, details?: string) {
  try {
    const res = await fetch(`${config.dashboardUrl}/api/worker/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, message, details }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.log;
  } catch (error) {
    // Fallback to console if api logger is failing
    console.error(`API Error: logEvent failed [${level}] ${message}`, error);
  }
}

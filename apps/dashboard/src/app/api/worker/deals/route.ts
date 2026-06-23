import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { normalizeUrl } from '@meesho-automation/shared';
import { sendEmailAlert } from '@/lib/notifier';
import type { Prisma } from '@prisma/client';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const limit = Number(searchParams.get('limit') || '10');

    const query: Prisma.DealWhereInput = {};
    if (status) {
      query.status = status;
    }

    const deals = await prisma.deal.findMany({
      where: query,
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    return NextResponse.json({ success: true, deals });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as Partial<{
      externalUrl: string;
      productName: string;
      mrp: number | string;
      offerPrice: number | string;
      scheduledTime: string;
    }>;
    const { externalUrl, productName, mrp, offerPrice, scheduledTime } = body;

    if (!externalUrl || !productName || mrp === undefined || offerPrice === undefined) {
      return NextResponse.json(
        { success: false, error: 'Missing required deal parameters (externalUrl, productName, mrp, offerPrice)' },
        { status: 400 }
      );
    }

    const normalized = normalizeUrl(externalUrl);

    // Identify platform
    let platform = 'OTHER';
    if (normalized.includes('amazon.in')) {
      platform = 'AMAZON';
    } else if (normalized.includes('meesho.com')) {
      platform = 'MEESHO';
    }

    // Retrieve duplicate check window from settings
    const dupSetting = await prisma.setting.findUnique({
      where: { key: 'duplicateCheckDays' },
    });
    const daysWindow = Number(dupSetting?.value || '7');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysWindow);

    // Check for duplicates
    const duplicate = await prisma.deal.findFirst({
      where: {
        normalizedUrl: normalized,
        status: { notIn: ['DISCARDED'] },
        createdAt: { gte: cutoffDate },
      },
    });

    let status = 'PENDING';
    if (duplicate) {
      status = 'DUPLICATE_PENDING';
    }

    const deal = await prisma.deal.create({
      data: {
        externalUrl,
        normalizedUrl: normalized,
        productName,
        mrp: Number(mrp),
        offerPrice: Number(offerPrice),
        status,
        platform,
        scheduledTime: scheduledTime ? new Date(scheduledTime) : null,
      },
    });

    if (status === 'DUPLICATE_PENDING') {
      // Trigger notification
      const reviewUrl = `http://localhost:3000/duplicates?id=${deal.id}`;
      await sendEmailAlert(
        `Duplicate Deal Flagged: ${productName}`,
        `
        <h3>Duplicate Deal Warning</h3>
        <p>A duplicate deal was detected for <b>${productName}</b> (${platform}).</p>
        <p><b>Original Deal URL:</b> <a href="${externalUrl}">${externalUrl}</a></p>
        <p><b>MRP:</b> ₹${mrp} | <b>Offer Price:</b> ₹${offerPrice}</p>
        <p>The deal has been paused under <b>DUPLICATE_PENDING</b> state.</p>
        <p>Please review and confirm posting: <a href="${reviewUrl}">${reviewUrl}</a></p>
        `
      );
    }

    return NextResponse.json({ success: true, deal, duplicateDetected: !!duplicate });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json() as Partial<{
      id: string;
      status: string;
      wishlinkUrl: string | null;
      scheduledTime: string | null;
    }>;
    const { id, status, wishlinkUrl, scheduledTime } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Deal ID is required' }, { status: 400 });
    }

    const updateData: Prisma.DealUpdateInput = {};
    if (status) updateData.status = status;
    if (wishlinkUrl !== undefined) updateData.wishlinkUrl = wishlinkUrl;
    if (scheduledTime !== undefined) updateData.scheduledTime = scheduledTime ? new Date(scheduledTime) : null;

    const deal = await prisma.deal.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, deal });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}

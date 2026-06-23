import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get('limit') || '50');

    const logs = await prisma.log.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return NextResponse.json({ success: true, logs });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as Partial<{
      level: string;
      message: string;
      details: string;
    }>;
    const { level, message, details } = body;

    if (!level || !message) {
      return NextResponse.json(
        { success: false, error: 'Level and message are required' },
        { status: 400 }
      );
    }

    const log = await prisma.log.create({
      data: {
        level,
        message,
        details,
      },
    });

    return NextResponse.json({ success: true, log });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: getErrorMessage(error) }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { createLogger } from "@/lib/logger";

const logger = createLogger('api:cron:health');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Verify request is from Vercel Cron
  const authHeader = request.headers.get('authorization');
  const isVercelCron = request.headers.get('user-agent') === 'vercel-cron/1.0';
  
  // Allow if it's a Vercel Cron job OR if we have a matching CRON_SECRET
  if (!isVercelCron && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // In development, we might want to allow testing without headers
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const startTime = Date.now();

  try {
    // 1. Check Write
    await redis.set('system:health:ping', startTime, { ex: 900 }); // 15 min expiry

    // 2. Check Read
    const readBack = await redis.get<number>('system:health:ping');

    if (readBack === startTime) {
      // 3. Update the persistent health status key
      const healthData = {
        status: 'operational',
        last_checked: new Date().toISOString(),
        response_time: Date.now() - startTime,
        features: {
          caching: true,
          rateLimit: true
        }
      };
      
      await redis.set('system:health:status', JSON.stringify(healthData));
      
      logger.info({ responseTime: healthData.response_time }, 'Health check passed');
      
      return NextResponse.json({ success: true, data: healthData });
    } else {
      throw new Error('Read/Write mismatch');
    }
  } catch (error) {
    logger.error({ error }, 'Health check failed');
    
    // Try to record the failure if Redis is partially up, otherwise this will just fail
    try {
      await redis.set('system:health:status', JSON.stringify({
        status: 'degraded', // Or down, but if we can write this, it's degraded
        last_checked: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    } catch (e) {
      // Redis completely down, can't even write degraded status
      logger.error({ error: e }, 'Failed to write degraded status');
    }

    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Health check failed' 
    }, { status: 500 });
  }
}


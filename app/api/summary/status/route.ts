import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

// Cache the response for 60 seconds to minimize Redis hits
// This means even if 1000 users check status, we only read from Redis once per minute
export const revalidate = 60;

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function GET() {
  try {
    // Read the health status set by the cron job
    const statusData = await redis.get<string>('system:health:status');

    if (!statusData) {
      // If no data found, maybe cron hasn't ran yet or Redis was down and keys expired
      // We'll return unknown/checking state
      return NextResponse.json({
        status: 'checking',
        service: 'redis',
        timestamp: new Date().toISOString(),
        message: 'Waiting for health check'
      });
    }

    const data = typeof statusData === 'string' ? JSON.parse(statusData) : statusData;
    
    // Check if data is stale (older than 15 mins)
    // Cron runs every 10 mins, so 15 mins gives a buffer
    const lastChecked = new Date(data.last_checked).getTime();
    const now = Date.now();
    const isStale = (now - lastChecked) > (15 * 60 * 1000);

    if (isStale) {
      return NextResponse.json({
        status: 'degraded',
        service: 'redis',
        timestamp: new Date().toISOString(),
        message: 'Health check stale - system may be degraded',
        features: {
          caching: false,
          rateLimit: false
        }
      });
    }

    return NextResponse.json({
      status: data.status,
      service: 'redis',
      timestamp: data.last_checked,
      responseTime: data.response_time,
      features: data.features
    });

  } catch {
    // If we can't read from Redis, it's definitely down
    return NextResponse.json({
      status: 'down',
      service: 'redis',
      timestamp: new Date().toISOString(),
      message: 'Connection failed',
      features: {
        caching: false,
        rateLimit: false
      }
    }, { status: 503 });
  }
}


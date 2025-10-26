import { NextRequest, NextResponse } from 'next/server';
import { scrapeUsersWithoutHours, getTMetricCredentials } from '@/lib/tmetric-scraper';
import { getLastWorkdaysRange, toISODate } from '@/lib/date-utils';
import { CheckHoursResponse } from '@/lib/types';
import { sendSlackNotification } from '@/lib/slack';

/**
 * API endpoint for automated/cron checks
 * Requires API_SECRET environment variable for authentication
 */
export async function POST(request: NextRequest) {
  try {
    // Check API authentication
    const authHeader = request.headers.get('authorization');
    const apiSecret = process.env.API_SECRET;

    if (!apiSecret) {
      return NextResponse.json(
        { success: false, error: 'API_SECRET not configured on server' },
        { status: 500 }
      );
    }

    if (!authHeader || authHeader !== `Bearer ${apiSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Invalid API key' },
        { status: 401 }
      );
    }

    console.log('[API Cron] Check hours request from automated job');

    // Get TMetric credentials
    const credentials = getTMetricCredentials();

    // Calculate last 2 workdays using shared utility
    const { from, to } = getLastWorkdaysRange(2);

    console.log(`[API Cron] Checking hours for date range: ${toISODate(from)} to ${toISODate(to)}`);

    // Scrape TMetric
    const users = await scrapeUsersWithoutHours(credentials, from, to);

    const response: CheckHoursResponse = {
      success: true,
      data: {
        dateRange: {
          from: toISODate(from),
          to: toISODate(to),
        },
        usersWithoutHours: users,
        totalUsers: users.length,
        checkedAt: new Date().toISOString(),
      },
    };

    console.log(`[API Cron] Found ${users.length} users without hours`);

    // Send Slack notification (non-blocking)
    sendSlackNotification(
      users,
      {
        from: toISODate(from),
        to: toISODate(to),
      },
      false // isManual = false (automated)
    ).catch((error) => {
      console.error('[API Cron] Error sending Slack notification:', error);
      // Don't fail the request if Slack notification fails
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API Cron] Error checking hours:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido al verificar horas',
      },
      { status: 500 }
    );
  }
}

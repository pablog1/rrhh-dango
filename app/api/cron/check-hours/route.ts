import { NextRequest, NextResponse } from 'next/server';
import { scrapeUsersWithoutHours, getTMetricCredentials } from '@/lib/tmetric-scraper';
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

    // Calculate date range (last 2 workdays)
    const today = new Date();
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    // Skip weekends
    while (twoDaysAgo.getDay() === 0 || twoDaysAgo.getDay() === 6) {
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 1);
    }
    while (today.getDay() === 0 || today.getDay() === 6) {
      today.setDate(today.getDate() - 1);
    }

    const fromDate = twoDaysAgo.toISOString().split('T')[0];
    const toDate = today.toISOString().split('T')[0];

    console.log('[API Cron] Checking hours for date range:', fromDate, 'to', toDate);

    // Scrape TMetric
    const users = await scrapeUsersWithoutHours(credentials, twoDaysAgo, today);

    const response: CheckHoursResponse = {
      success: true,
      data: {
        dateRange: {
          from: fromDate,
          to: toDate,
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
        from: fromDate,
        to: toDate,
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

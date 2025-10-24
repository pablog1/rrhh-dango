import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { scrapeUsersWithoutHours, getTMetricCredentials } from '@/lib/tmetric-scraper';
import { getLastWorkdaysRange, toISODate } from '@/lib/date-utils';
import { CheckHoursResponse } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as CheckHoursResponse,
        { status: 401 }
      );
    }

    console.log('[API] Check hours request from:', session.user?.email);

    // Get TMetric credentials
    const credentials = getTMetricCredentials();

    // Calculate last 2 workdays
    const { from, to } = getLastWorkdaysRange(2);

    console.log(`[API] Checking hours for date range: ${toISODate(from)} to ${toISODate(to)}`);

    // Scrape TMetric
    const usersWithoutHours = await scrapeUsersWithoutHours(credentials, from, to);

    // Build response
    const response: CheckHoursResponse = {
      success: true,
      data: {
        dateRange: {
          from: toISODate(from),
          to: toISODate(to),
        },
        usersWithoutHours,
        totalUsers: usersWithoutHours.length,
        checkedAt: new Date().toISOString(),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API] Error checking hours:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    const response: CheckHoursResponse = {
      success: false,
      error: errorMessage,
    };

    return NextResponse.json(response, { status: 500 });
  }
}

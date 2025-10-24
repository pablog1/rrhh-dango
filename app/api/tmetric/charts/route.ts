import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { scrapeAllUsersChartData, getTMetricCredentials } from '@/lib/tmetric-scraper';
import { GetChartsResponse } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      );
    }

    console.log('[API] Get charts request from:', session.user.email);

    // Get TMetric credentials
    const credentials = getTMetricCredentials();

    // Calculate date range (last 30 days)
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 30);

    console.log('[API] Getting chart data for date range:', fromDate.toISOString().split('T')[0], 'to', toDate.toISOString().split('T')[0]);

    // Scrape all users and get their chart data
    const users = await scrapeAllUsersChartData(credentials, fromDate, toDate);

    const response: GetChartsResponse = {
      success: true,
      data: {
        dateRange: {
          from: fromDate.toISOString().split('T')[0],
          to: toDate.toISOString().split('T')[0],
        },
        users,
        totalUsers: users.length,
        checkedAt: new Date().toISOString(),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API] Error getting charts:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido al obtener datos de gráficos',
      },
      { status: 500 }
    );
  }
}

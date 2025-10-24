export interface DailyHours {
  date: string; // DD/MM/YYYY
  hours: number; // Total hours as decimal (e.g., 8.5 for 8h 30min)
}

export interface UserWithoutHours {
  id: string;
  name: string;
  email: string;
  lastEntry: string | null; // ISO date string or null
  totalHoursLast30Days?: string; // Total hours in last 30 days (e.g., "15 h 30 min")
  daysWithoutEntries?: number; // Number of days since last entry
  dailyHours?: DailyHours[]; // Daily hours for the last 30 days
}

export interface CheckHoursResponse {
  success: boolean;
  data?: {
    dateRange: {
      from: string; // ISO date
      to: string;   // ISO date
    };
    usersWithoutHours: UserWithoutHours[];
    totalUsers: number;
    checkedAt: string; // ISO timestamp
  };
  error?: string;
}

export interface TMetricCredentials {
  email: string;
  password: string;
}

export interface UserChartData {
  id: string;
  name: string;
  email: string;
  dailyHours: DailyHours[]; // Daily hours for the last 30 days
  totalHoursLast30Days: string; // Total hours in last 30 days (e.g., "15 h 30 min")
}

export interface GetChartsResponse {
  success: boolean;
  data?: {
    dateRange: {
      from: string; // ISO date
      to: string;   // ISO date
    };
    users: UserChartData[];
    totalUsers: number;
    checkedAt: string; // ISO timestamp
  };
  error?: string;
}

export interface UserWithoutHours {
  id: string;
  name: string;
  email: string;
  lastEntry: string | null; // ISO date string or null
  totalHoursLast30Days?: string; // Total hours in last 30 days (e.g., "15 h 30 min")
  daysWithoutEntries?: number; // Number of days since last entry
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

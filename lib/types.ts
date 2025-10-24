export interface UserWithoutHours {
  id: string;
  name: string;
  email: string;
  lastEntry: string | null; // ISO date string or null
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

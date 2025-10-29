import { chromium, Page, Browser } from 'playwright';
import { TMetricCredentials, UserWithoutHours, UserChartData, ProjectChartData } from './types';
import { toISODate } from './date-utils';

/**
 * Login to TMetric using Playwright
 * @param page Playwright page instance
 * @param credentials TMetric credentials
 */
async function loginToTMetric(page: Page, credentials: TMetricCredentials): Promise<void> {
  console.log('[TMetric] Navigating to login page...');
  await page.goto('https://app.tmetric.com/login', { waitUntil: 'networkidle' });

  // Take screenshot for debugging
  await page.screenshot({ path: 'debug-login-page.png' });
  console.log('[TMetric] Screenshot saved: debug-login-page.png');
  console.log('[TMetric] Current URL:', page.url());

  // Get page content for inspection
  const pageTitle = await page.title();
  console.log('[TMetric] Page title:', pageTitle);

  // Try to find all input fields
  const inputs = await page.$$eval('input', (elements) =>
    elements.map(el => ({
      type: el.getAttribute('type'),
      name: el.getAttribute('name'),
      id: el.getAttribute('id'),
      placeholder: el.getAttribute('placeholder'),
      className: el.className,
    }))
  );
  console.log('[TMetric] Found inputs:', JSON.stringify(inputs, null, 2));

  // Try to find all buttons
  const buttons = await page.$$eval('button', (elements) =>
    elements.map(el => ({
      type: el.getAttribute('type'),
      text: el.textContent?.trim(),
      className: el.className,
    }))
  );
  console.log('[TMetric] Found buttons:', JSON.stringify(buttons, null, 2));

  // Wait a bit more for the form to be fully ready
  await page.waitForTimeout(2000);

  console.log('[TMetric] Filling credentials...');

  // Fill credentials using page.evaluate to interact directly with the DOM
  const fillResult = await page.evaluate(({ email, password }) => {
    // Find username/email input
    const usernameInput = document.querySelector('input[name="Username"]') as HTMLInputElement;
    if (!usernameInput) {
      return { success: false, error: 'Username input not found' };
    }

    // Find password input
    const passwordInput = document.querySelector('input[name="Password"]') as HTMLInputElement;
    if (!passwordInput) {
      return { success: false, error: 'Password input not found' };
    }

    // Fill the inputs
    usernameInput.value = email;
    passwordInput.value = password;

    // Trigger input events to ensure validation
    usernameInput.dispatchEvent(new Event('input', { bubbles: true }));
    usernameInput.dispatchEvent(new Event('change', { bubbles: true }));
    passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
    passwordInput.dispatchEvent(new Event('change', { bubbles: true }));

    return { success: true };
  }, { email: credentials.email, password: credentials.password });

  if (!fillResult.success) {
    throw new Error(`Could not fill credentials: ${fillResult.error}`);
  }

  console.log('[TMetric] ✓ Credentials filled successfully');

  await page.screenshot({ path: 'debug-before-submit.png' });
  console.log('[TMetric] Screenshot saved: debug-before-submit.png');

  console.log('[TMetric] Clicking login button...');

  // Try different selectors for submit button
  const submitSelectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("Sign in")',
    'button:has-text("Log in")',
    'button:has-text("Login")',
    '.login-button',
    '.submit-button',
  ];

  let buttonClicked = false;
  for (const selector of submitSelectors) {
    try {
      await page.click(selector, { timeout: 2000 });
      console.log(`[TMetric] ✓ Button clicked using selector: ${selector}`);
      buttonClicked = true;
      break;
    } catch (e) {
      console.log(`[TMetric] ✗ Failed selector: ${selector}`);
    }
  }

  if (!buttonClicked) {
    throw new Error('Could not find or click submit button');
  }

  // Wait for navigation after login - try to wait for URL change or timeout
  console.log('[TMetric] Waiting for successful login...');

  try {
    // Wait for either navigation away from login page OR timeout
    await Promise.race([
      page.waitForURL(url => !url.toString().includes('id.tmetric.com'), { timeout: 30000 }),
      page.waitForLoadState('networkidle', { timeout: 30000 }),
    ]);
  } catch (error) {
    console.log('[TMetric] Navigation timeout - checking current state...');
  }

  await page.screenshot({ path: 'debug-after-login.png' });
  console.log('[TMetric] Screenshot saved: debug-after-login.png');
  const currentUrl = page.url();
  console.log('[TMetric] Current URL after login:', currentUrl);

  // Check for error messages or reCAPTCHA on the login page
  const pageInfo = await page.evaluate(() => {
    const errorEl = document.querySelector('.validation-summary-errors, .field-validation-error, .text-danger, [class*="error"]');
    const recaptcha = document.querySelector('.g-recaptcha, [class*="recaptcha"], #recaptcha');
    const bodyText = document.body.innerText;

    return {
      error: errorEl ? errorEl.textContent?.trim() : null,
      hasRecaptcha: !!recaptcha,
      bodyPreview: bodyText.substring(0, 500), // First 500 chars of page content
    };
  });

  console.log('[TMetric] Page info after login attempt:', JSON.stringify(pageInfo, null, 2));

  // Verify login was successful - should redirect away from login page
  if (currentUrl.includes('id.tmetric.com') || currentUrl.includes('/login')) {
    let errorDetails = '';
    if (pageInfo.error) {
      errorDetails = ` Error: ${pageInfo.error}`;
    } else if (pageInfo.hasRecaptcha) {
      errorDetails = ' - reCAPTCHA detected (Railway IP may be blocked)';
    }
    throw new Error(`Login failed - still on login page: ${currentUrl}${errorDetails}`);
  }

  // Should be on app.tmetric.com now
  if (!currentUrl.includes('app.tmetric.com')) {
    throw new Error(`Unexpected URL after login: ${currentUrl}`);
  }

  console.log('[TMetric] Login successful!');

  // Make sure we're on a page with workspace ID
  // Sometimes login redirects to https://app.tmetric.com/#/ without workspace
  if (!currentUrl.includes('/tracker/')) {
    console.log('[TMetric] Waiting for URL to include workspace ID...');
    try {
      await page.waitForURL(url => url.toString().includes('/tracker/'), { timeout: 10000 });
      console.log('[TMetric] URL now includes workspace ID:', page.url());
    } catch (e) {
      console.log('[TMetric] Timeout waiting for workspace ID in URL. Current URL:', page.url());
      // Try to extract workspace from page content if available
      const workspaceInfo = await page.evaluate(() => {
        // Look for workspace selector or any element that might contain workspace ID
        const workspaceDropdown = document.querySelector('.workspace-switcher, [class*="workspace"]');
        return {
          hasWorkspaceSelector: !!workspaceDropdown,
          bodyText: document.body.textContent?.substring(0, 500),
        };
      });
      console.log('[TMetric] Workspace info:', workspaceInfo);
    }
  }
}

/**
 * Navigate to reports section and extract users without hours
 * @param page Playwright page instance
 * @param fromDate Start date for checking
 * @param toDate End date for checking
 * @returns Array of users without hours logged
 */
async function getUsersWithoutHours(
  page: Page,
  fromDate: Date,
  toDate: Date
): Promise<UserWithoutHours[]> {
  console.log('[TMetric] Fetching users without hours using 30-day history strategy...');

  // Extract workspace ID from current URL
  const currentUrl = page.url();
  const workspaceMatch = currentUrl.match(/\/tracker\/(\d+)/);

  if (!workspaceMatch) {
    throw new Error('Could not extract workspace ID from URL: ' + currentUrl);
  }

  const workspaceId = workspaceMatch[1];
  console.log('[TMetric] Workspace ID:', workspaceId);

  // Format dates as YYYYMMDD
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  };

  // Calculate 30 days ago to get complete user list
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  const thirtyDayRange = `${formatDate(thirtyDaysAgo)}-${formatDate(today)}`;

  // STEP 1: Get complete list of ALL users from /staff page
  const staffUrl = `https://app.tmetric.com/#/reports/${workspaceId}/staff?range=${thirtyDayRange}`;
  console.log('[TMetric] Step 1: Navigating to staff page to get ALL users:', staffUrl);

  await page.goto(staffUrl, {
    waitUntil: 'networkidle',
    timeout: 30000,
  });

  await page.waitForTimeout(3000);

  // Extract ALL users from staff table (includes users with 0 hours)
  const allUsers = await page.evaluate(() => {
    const users: Array<{ name: string; userId: string }> = [];
    const table = document.querySelector('table.table-team-summary-report');

    if (!table) {
      console.log('[TMetric] Staff table not found');
      return users;
    }

    const rows = table.querySelectorAll('tbody tr');
    const angular = (window as any).angular;

    rows.forEach((row) => {
      try {
        // Extract user name from the name cell
        const nameCell = row.querySelector('td.col-name, td.col-name-narrow, td[ng-if*="user"]');
        if (!nameCell) return;

        let name = nameCell.getAttribute('title') || nameCell.textContent?.trim() || '';
        name = name.replace(/\s+/g, ' ').trim();

        if (!name || name === 'Unknown') return;

        // Try to extract userId from Angular scope
        let userId = '';
        if (angular) {
          try {
            const element = angular.element(row);
            const scope = element.scope();
            if (scope?.item) {
              userId = String(scope.item.userId || scope.item.userProfileId || '');
            }
          } catch (e) {
            // Scope not available
          }
        }

        users.push({ name, userId });
        console.log(`[TMetric] Found user: ${name} (ID: ${userId || 'N/A'})`);
      } catch (err) {
        console.error('[TMetric] Error processing row:', err);
      }
    });

    return users;
  });

  console.log(`[TMetric] Found ${allUsers.length} total users in workspace`);

  // STEP 2: Get 30-day detailed history with groupby=user,day
  const detailedUrl = `https://app.tmetric.com/#/reports/${workspaceId}/detailed?range=${thirtyDayRange}&groupby=user,day`;
  console.log('[TMetric] Step 2: Navigating to detailed report for 30-day history:', detailedUrl);

  await page.goto(detailedUrl, {
    waitUntil: 'networkidle',
    timeout: 30000,
  });

  await page.waitForTimeout(3000);

  // Extract daily data for users who HAVE activity
  const usersWithActivityData = await page.evaluate(() => {
    const userMap = new Map<string, {
      id: string;
      name: string;
      dailyHours: Array<{ date: string; hours: number }>;
      totalMinutes: number;
      lastEntry: string | null;
      lastEntryTimestamp: number;
    }>();

    // Find the detailed report table
    const table = document.querySelector('table.table-hover.table-report, table.table-detailed-report, table[class*="table"]');
    if (!table) {
      console.log('[TMetric] Table not found');
      return [];
    }

    const rows = table.querySelectorAll('tbody tr');
    const angular = (window as any).angular;

    if (!angular) {
      console.log('[TMetric] Angular not found');
      return [];
    }

    rows.forEach((row) => {
      const element = angular.element(row);
      const scope = element.scope();

      // Check if this row is a user group (field = "user")
      if (scope?.group && scope.group.field === 'user') {
        const userName = scope.group.value;

        // Generate a unique ID for the user
        const userId = `user-${userName.replace(/\s+/g, '-').toLowerCase()}`;

        // Extract total duration from the user group summary
        const totalDurationMs = scope.group.summary?.duration || 0;
        const totalMinutes = Math.floor(totalDurationMs / 60000);

        let lastEntry: string | null = null;
        let lastEntryTimestamp = 0;
        const dailyHours: Array<{ date: string; hours: number }> = [];

        // Extract the daily breakdown
        if (scope.group.groups && Array.isArray(scope.group.groups)) {
          scope.group.groups.forEach((dayGroup: any) => {
            if (dayGroup.field === 'day' && dayGroup.value) {
              const dateValue = dayGroup.value; // "2025-10-27T12:00:00"
              const durationMs = dayGroup.summary?.duration || 0;
              const hours = Math.floor(durationMs / 60000) / 60;

              // Convert date to DD/MM/YYYY format
              const dateObj = new Date(dateValue);
              const formattedDate = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getFullYear()}`;

              dailyHours.push({ date: formattedDate, hours });

              // Track the most recent date with hours > 0
              if (hours > 0) {
                const timestamp = dateObj.getTime();
                if (timestamp > lastEntryTimestamp) {
                  lastEntryTimestamp = timestamp;
                  lastEntry = formattedDate;
                }
              }
            }
          });
        }

        userMap.set(userName, {
          id: userId,
          name: userName,
          dailyHours,
          totalMinutes,
          lastEntry,
          lastEntryTimestamp,
        });
      }
    });

    return Array.from(userMap.values());
  });

  console.log(`[TMetric] Extracted data for ${usersWithActivityData.length} users with activity in last 30 days`);

  // STEP 3: Combine both lists - create a map with activity data
  const activityMap = new Map(usersWithActivityData.map(u => [u.name, u]));

  // Create complete user data list (all users from staff, with or without activity)
  const usersData = allUsers.map(user => {
    const activity = activityMap.get(user.name);

    if (activity) {
      // User has activity data
      return activity;
    } else {
      // User has NO activity in last 30 days
      return {
        id: `user-${user.name.replace(/\s+/g, '-').toLowerCase()}`,
        name: user.name,
        dailyHours: [],
        totalMinutes: 0,
        lastEntry: null,
        lastEntryTimestamp: 0,
      };
    }
  });

  console.log(`[TMetric] Total users to process: ${usersData.length} (${usersWithActivityData.length} with activity, ${usersData.length - usersWithActivityData.length} without)`);

  // Now filter users who have no hours in the checked period (fromDate to toDate)
  const users: UserWithoutHours[] = [];

  // Helper function to get last N business days as date strings in DD/MM/YYYY format
  const getLastBusinessDays = (n: number): string[] => {
    const businessDays: string[] = [];
    const current = new Date(today);

    while (businessDays.length < n) {
      const dayOfWeek = current.getDay();
      // 0 = Sunday, 6 = Saturday - skip weekends
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const day = String(current.getDate()).padStart(2, '0');
        const month = String(current.getMonth() + 1).padStart(2, '0');
        const year = current.getFullYear();
        businessDays.push(`${day}/${month}/${year}`);
      }
      // Move to previous day
      current.setDate(current.getDate() - 1);
    }

    return businessDays;
  };

  // Get the last 2 business days to check
  const lastTwoBusinessDays = getLastBusinessDays(2);
  console.log(`[TMetric] Checking last 2 business days: ${lastTwoBusinessDays.join(', ')}`);

  // Process the extracted data - filter users with 0 hours in the last 2 business days
  for (const userData of usersData) {
    console.log(`[TMetric] Processing ${userData.name}`);

    // Convert total minutes to readable format (for 30-day total)
    const totalHours = Math.floor(userData.totalMinutes / 60);
    const remainingMinutes = userData.totalMinutes % 60;
    const totalHoursStr = `${totalHours} h ${remainingMinutes} min`;

    // Check if user has hours in the last 2 business days specifically
    const dailyHoursMap = new Map(userData.dailyHours.map(d => [d.date, d.hours]));

    const hoursInLastTwoBusinessDays = lastTwoBusinessDays.reduce((total, date) => {
      return total + (dailyHoursMap.get(date) || 0);
    }, 0);

    const hasNoHoursInLastTwoBusinessDays = hoursInLastTwoBusinessDays === 0;

    // Calculate business days since last entry for display
    let businessDaysSinceLastEntry: number | undefined;
    if (userData.lastEntry && userData.lastEntryTimestamp > 0) {
      const lastEntryDate = new Date(userData.lastEntryTimestamp);
      let count = 0;
      const current = new Date(today);

      while (current > lastEntryDate) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          count++;
        }
        current.setDate(current.getDate() - 1);
      }
      businessDaysSinceLastEntry = count;
    }

    // Add to result if user has NO hours in the last 2 business days
    if (hasNoHoursInLastTwoBusinessDays) {
      users.push({
        id: userData.id,
        name: userData.name,
        email: '',
        lastEntry: userData.lastEntry,
        totalHoursLast30Days: totalHoursStr,
        daysWithoutEntries: businessDaysSinceLastEntry,
      });

      console.log(
        `[TMetric]   ✓ ${userData.name}: NO hours in last 2 business days (${lastTwoBusinessDays.join(', ')}). Last entry: ${userData.lastEntry || 'None'}, Total 30-day: ${totalHoursStr}, Business days without entries: ${businessDaysSinceLastEntry ?? 'N/A'}`
      );
    } else {
      console.log(
        `[TMetric]   - ${userData.name}: HAS hours in last 2 business days (${hoursInLastTwoBusinessDays.toFixed(2)} hours). Total 30-day: ${totalHoursStr}`
      );
    }
  }

  console.log(`[TMetric] Completed checking ${users.length} users`);

  return users;
}

/**
 * Fill in missing days with 0 hours to create a complete date range
 * @param dailyHours Array of daily hours from TMetric (may have gaps)
 * @param fromDate Start date of range
 * @param toDate End date of range
 * @returns Complete array with all days in range, missing days filled with 0 hours
 */
function fillMissingDays(
  dailyHours: Array<{ date: string; hours: number }>,
  fromDate: Date,
  toDate: Date
): Array<{ date: string; hours: number }> {
  // Create a map of existing data by date
  const dataMap = new Map<string, number>();
  dailyHours.forEach(entry => {
    // Parse the date string from format "DD/MM/YYYY" or "DD/MM/YYYY Day"
    const dateOnly = entry.date.split(/\s+/)[0].trim();
    dataMap.set(dateOnly, entry.hours);
  });

  // Generate all days in the range
  const result: Array<{ date: string; hours: number }> = [];
  const currentDate = new Date(fromDate);

  while (currentDate <= toDate) {
    const day = String(currentDate.getDate()).padStart(2, '0');
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const year = currentDate.getFullYear();
    const dateStr = `${day}/${month}/${year}`;

    // Use existing hours or 0 if not found
    const hours = dataMap.get(dateStr) || 0;
    result.push({ date: dateStr, hours });

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return result;
}

/**
 * Get ALL users with their 30-day chart data
 * @param page Playwright page instance
 * @param fromDate Start date
 * @param toDate End date (30 days from start)
 * @returns Array of all users with their daily hours data
 */
async function getAllUsersChartData(
  page: Page,
  fromDate: Date,
  toDate: Date
): Promise<UserChartData[]> {
  console.log('[TMetric] Navigating to detailed user reports...');

  // Extract workspace ID from current URL
  const currentUrl = page.url();
  const workspaceMatch = currentUrl.match(/\/tracker\/(\d+)/);

  if (!workspaceMatch) {
    throw new Error('Could not extract workspace ID from URL: ' + currentUrl);
  }

  const workspaceId = workspaceMatch[1];
  console.log('[TMetric] Workspace ID:', workspaceId);

  const dateRange = `${toISODate(fromDate).replace(/-/g, '')}-${toISODate(toDate).replace(/-/g, '')}`;

  // Navigate directly to detailed report with groupby=user,day to get all data in one table
  const detailedUrl = `https://app.tmetric.com/#/reports/${workspaceId}/detailed?range=${dateRange}&groupby=user,day`;
  console.log('[TMetric] Navigating to detailed report:', detailedUrl);

  await page.goto(detailedUrl, {
    waitUntil: 'networkidle',
  });

  await page.waitForTimeout(3000);

  // Close any modal/popup that might be blocking the view
  try {
    const closeButton = await page.$('button.close, [aria-label="Close"], .modal-header button');
    if (closeButton) {
      await closeButton.click();
      await page.waitForTimeout(500);
      console.log('[TMetric] Closed modal/popup');
    }
  } catch (e) {
    // No modal to close
  }

  // Take screenshot for debugging
  await page.screenshot({ path: 'debug-users-reports.png' });
  console.log('[TMetric] Screenshot saved: debug-users-reports.png');

  // Extract all users with their daily data from the single table using Angular scope
  const usersData = await page.evaluate(() => {
    const userMap = new Map<string, {
      id: string;
      name: string;
      email: string;
      dailyHours: Array<{ date: string; hours: number }>;
      totalMinutes: number;
    }>();

    console.log('[TMetric] === Extracting users from detailed table ===');

    // Find the detailed report table
    const table = document.querySelector('table.table-hover.table-report, table.table-detailed-report, table[class*="table"]');
    if (!table) {
      console.log('[TMetric] No table found on page');
      return [];
    }

    const rows = table.querySelectorAll('tbody tr');
    console.log(`[TMetric] Found ${rows.length} rows in table`);

    // Try to extract using Angular scope
    const angular = (window as any).angular;
    if (!angular) {
      console.log('[TMetric] Angular not available');
      return [];
    }

    let userGroupsFound = 0;
    let daySubgroupsProcessed = 0;

    rows.forEach((row) => {
      try {
        const element = angular.element(row);
        const scope = element.scope();

        // Check if this row is a user group (field = "user")
        if (scope?.group && scope.group.field === 'user') {
          const userName = scope.group.value;

          // Skip empty user names
          if (!userName || userName === '') {
            return;
          }

          userGroupsFound++;

          // Use user name as ID since we don't have a separate user ID in this view
          const userId = userName;

          console.log(`[TMetric] Found user group: ${userName}`);

          // Initialize user in map if not exists
          if (!userMap.has(userId)) {
            userMap.set(userId, {
              id: userId,
              name: userName,
              email: '',
              dailyHours: [],
              totalMinutes: 0,
            });
          }

          const userData = userMap.get(userId);
          if (!userData) return;

          // Extract total duration from the user group summary
          const totalDurationMs = scope.group.summary?.duration || 0;
          const totalMinutes = Math.floor(totalDurationMs / 60000);
          userData.totalMinutes = totalMinutes;

          // Now extract the daily breakdown
          if (scope.group.groups && Array.isArray(scope.group.groups)) {
            scope.group.groups.forEach((dayGroup: any) => {
              if (dayGroup.field === 'day' && dayGroup.value) {
                daySubgroupsProcessed++;

                // Parse the date (format: "2025-10-27T12:00:00")
                const dateValue = dayGroup.value;
                let formattedDate = '';

                if (typeof dateValue === 'string') {
                  const dateObj = new Date(dateValue);
                  const day = dateObj.getDate().toString().padStart(2, '0');
                  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
                  const year = dateObj.getFullYear();
                  formattedDate = `${day}/${month}/${year}`;
                }

                // Get duration from summary (in milliseconds)
                const durationMs = dayGroup.summary?.duration || 0;
                const minutes = Math.floor(durationMs / 60000); // Convert ms to minutes
                const hours = minutes / 60;

                if (formattedDate && hours > 0) {
                  userData.dailyHours.push({ date: formattedDate, hours });
                }
              }
            });
          }

          console.log(`[TMetric]   ✓ ${userName}: Extracted ${userData.dailyHours.length} days with data`);
        }
      } catch (e) {
        // Skip rows that error
      }
    });

    console.log(`[TMetric] Found ${userGroupsFound} user groups, processed ${daySubgroupsProcessed} day subgroups`);
    console.log(`[TMetric] Extracted ${userMap.size} users with daily data`);
    return Array.from(userMap.values());
  });

  console.log(`[TMetric] Found ${usersData.length} total users with data`);

  // Convert to UserChartData format
  const users: UserChartData[] = [];

  for (const userData of usersData) {
    if (userData.dailyHours.length > 0) {
      // Fill in missing days with 0 hours to show complete 30-day range
      const completeDailyHours = fillMissingDays(userData.dailyHours, fromDate, toDate);

      const totalHours = Math.floor(userData.totalMinutes / 60);
      const totalMins = userData.totalMinutes % 60;
      const totalHoursStr = `${totalHours} h ${totalMins} min`;

      users.push({
        id: userData.id,
        name: userData.name,
        email: userData.email,
        dailyHours: completeDailyHours,
        totalHoursLast30Days: totalHoursStr,
      });

      console.log(`[TMetric]   ✓ ${userData.name}: Total: ${totalHoursStr}, ${userData.dailyHours.length} days with data (${completeDailyHours.length} total days)`);
    } else {
      console.log(`[TMetric]   ✗ ${userData.name}: No hours in last 30 days, skipping`);
    }
  }

  console.log(`[TMetric] Completed processing ${users.length} users with hours`);

  return users;
}

/**
 * Main function to scrape TMetric and find users without hours
 * @param credentials TMetric login credentials
 * @param fromDate Start date for checking
 * @param toDate End date for checking
 * @returns Array of users without hours logged
 */
export async function scrapeUsersWithoutHours(
  credentials: TMetricCredentials,
  fromDate: Date,
  toDate: Date
): Promise<UserWithoutHours[]> {
  let browser: Browser | null = null;

  try {
    console.log('[TMetric] Launching browser...');
    // Use headless mode in production (Railway), headed mode in development
    const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;
    browser = await chromium.launch({
      headless: isProduction ? true : false,
      slowMo: isProduction ? 0 : 500,
      timeout: 60000,
      args: [
        '--disable-blink-features=AutomationControlled', // Hide webdriver flag
        '--disable-dev-shm-usage',
        '--no-sandbox',
      ],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      // Add more realistic browser properties
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: [],
      // Disable webdriver detection
      javaScriptEnabled: true,
    });

    const page = await context.newPage();

    // Set timeout for page operations
    page.setDefaultTimeout(30000);

    // Login to TMetric
    await loginToTMetric(page, credentials);

    // Extract users without hours
    const users = await getUsersWithoutHours(page, fromDate, toDate);

    console.log(`[TMetric] Found ${users.length} users without hours`);

    return users;
  } catch (error) {
    console.error('[TMetric] Scraping error:', error);
    throw error;
  } finally {
    if (browser) {
      console.log('[TMetric] Closing browser...');
      await browser.close();
    }
  }
}

/**
 * Main function to scrape ALL TMetric users and get their chart data
 * @param credentials TMetric login credentials
 * @param fromDate Start date for checking (30 days ago)
 * @param toDate End date for checking (today)
 * @returns Array of all users with their daily hours data
 */
export async function scrapeAllUsersChartData(
  credentials: TMetricCredentials,
  fromDate: Date,
  toDate: Date
): Promise<UserChartData[]> {
  let browser: Browser | null = null;

  try {
    console.log('[TMetric] Launching browser for chart data...');
    // Use headless mode in production (Railway), headed mode in development
    const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;
    browser = await chromium.launch({
      headless: isProduction ? true : false,
      slowMo: isProduction ? 0 : 500,
      timeout: 60000,
      args: [
        '--disable-blink-features=AutomationControlled', // Hide webdriver flag
        '--disable-dev-shm-usage',
        '--no-sandbox',
      ],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      // Add more realistic browser properties
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: [],
      // Disable webdriver detection
      javaScriptEnabled: true,
    });

    const page = await context.newPage();
    page.setDefaultTimeout(30000);

    // Login to TMetric
    await loginToTMetric(page, credentials);

    // Get all users with their chart data
    const users = await getAllUsersChartData(page, fromDate, toDate);

    console.log(`[TMetric] Found chart data for ${users.length} users`);

    return users;
  } catch (error) {
    console.error('[TMetric] Chart data scraping error:', error);
    throw error;
  } finally {
    if (browser) {
      console.log('[TMetric] Closing browser...');
      await browser.close();
    }
  }
}

/**
 * Get TMetric credentials from environment variables
 * @returns TMetric credentials object
 * @throws Error if credentials are not set
 */
export function getTMetricCredentials(): TMetricCredentials {
  const email = process.env.TMETRIC_EMAIL;
  const password = process.env.TMETRIC_PASSWORD;

  if (!email || !password) {
    throw new Error('TMetric credentials not configured. Set TMETRIC_EMAIL and TMETRIC_PASSWORD in .env.local');
  }

  return { email, password };
}

/**
 * Get all active projects with their 30-day chart data
 * Projects with at least 1 hour in the last 30 days
 * @param page Playwright page instance
 * @param fromDate Start date
 * @param toDate End date (30 days from start)
 * @returns Array of active projects with their daily hours data
 */
async function getAllProjectsChartData(
  page: Page,
  fromDate: Date,
  toDate: Date
): Promise<ProjectChartData[]> {
  console.log('[TMetric] Navigating to project reports...');

  // Extract workspace ID from current URL
  const currentUrl = page.url();
  const workspaceMatch = currentUrl.match(/\/tracker\/(\d+)/);

  if (!workspaceMatch) {
    throw new Error('Could not extract workspace ID from URL: ' + currentUrl);
  }

  const workspaceId = workspaceMatch[1];
  console.log('[TMetric] Workspace ID:', workspaceId);

  const dateRange = `${toISODate(fromDate).replace(/-/g, '')}-${toISODate(toDate).replace(/-/g, '')}`;

  // Navigate directly to detailed report with groupby=project,day to get all data in one table
  const detailedUrl = `https://app.tmetric.com/#/reports/${workspaceId}/detailed?range=${dateRange}&groupby=project,day`;
  console.log('[TMetric] Navigating to detailed report:', detailedUrl);

  await page.goto(detailedUrl, {
    waitUntil: 'networkidle',
  });

  await page.waitForTimeout(3000);
  console.log('[TMetric] Current URL after navigation:', page.url());

  // Close any modal/popup that might be blocking the view
  try {
    const closeButton = await page.$('button.close, [aria-label="Close"], .modal-header button');
    if (closeButton) {
      await closeButton.click();
      await page.waitForTimeout(500);
      console.log('[TMetric] Closed modal/popup');
    }
  } catch (e) {
    // No modal to close
  }

  // Take screenshot for debugging
  await page.screenshot({ path: 'debug-reports.png' });
  console.log('[TMetric] Screenshot saved: debug-reports.png');

  // Extract all projects with their daily data from the single table
  const projectsData = await page.evaluate(() => {
    const projectMap = new Map<string, {
      id: string;
      name: string;
      client: string;
      dailyHours: Array<{ date: string; hours: number }>;
      totalMinutes: number;
    }>();

    console.log('[TMetric] === Extracting projects from detailed table ===');

    // Find the detailed report table
    const table = document.querySelector('table.table-hover.table-report, table.table-detailed-report, table[class*="table"]');
    if (!table) {
      console.log('[TMetric] No table found on page');
      return [];
    }

    const rows = table.querySelectorAll('tbody tr');
    console.log(`[TMetric] Found ${rows.length} rows in table`);

    // Try to extract using Angular scope
    const angular = (window as any).angular;
    if (!angular) {
      console.log('[TMetric] Angular not available');
      return [];
    }

    let rowsProcessed = 0;
    let projectGroupsFound = 0;
    let daySubgroupsProcessed = 0;

    rows.forEach((row, index) => {
      rowsProcessed++;

      try {
        const element = angular.element(row);
        const scope = element.scope();

        // Check if this row is a project group (field = "project")
        if (scope?.group && scope.group.field === 'project') {
          const projectName = scope.group.value;

          // Skip empty project names (these are "No project" entries)
          if (!projectName || projectName === '') {
            return;
          }

          projectGroupsFound++;

          // Use project name as ID since we don't have a separate project ID
          const projectId = projectName;

          console.log(`[TMetric] Found project group: ${projectName}`);

          // Initialize project in map if not exists
          if (!projectMap.has(projectId)) {
            projectMap.set(projectId, {
              id: projectId,
              name: projectName,
              client: '', // Client info not available in this view
              dailyHours: [],
              totalMinutes: 0,
            });
          }

          const projectData = projectMap.get(projectId);
          if (!projectData) return;

          // Extract daily data from the day subgroups
          // Note: We use the top-level summary duration which already represents the total for the date range
          const totalDurationMs = scope.group.summary?.duration || 0;
          const totalMinutes = Math.floor(totalDurationMs / 60000);
          projectData.totalMinutes = totalMinutes;

          // Now extract the daily breakdown
          if (scope.group.groups && Array.isArray(scope.group.groups)) {
            scope.group.groups.forEach((dayGroup: any) => {
              if (dayGroup.field === 'day' && dayGroup.value) {
                daySubgroupsProcessed++;

                // Parse the date (format: "2025-10-27T12:00:00")
                const dateValue = dayGroup.value;
                let formattedDate = '';

                if (typeof dateValue === 'string') {
                  const dateObj = new Date(dateValue);
                  const day = dateObj.getDate().toString().padStart(2, '0');
                  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
                  const year = dateObj.getFullYear();
                  formattedDate = `${day}/${month}/${year}`;
                }

                // Get duration from summary (in milliseconds)
                const durationMs = dayGroup.summary?.duration || 0;
                const minutes = Math.floor(durationMs / 60000); // Convert ms to minutes
                const hours = minutes / 60;

                if (formattedDate && hours > 0) {
                  projectData.dailyHours.push({ date: formattedDate, hours });
                }
              }
            });
          }

          console.log(`[TMetric]   ✓ ${projectName}: Extracted ${projectData.dailyHours.length} days with data`);
        }
      } catch (e) {
        // Skip rows that error
        if (index < 10) {
          console.log(`[TMetric] Error processing row ${index}:`, (e as Error).message);
        }
      }
    });

    console.log(`[TMetric] Processed ${rowsProcessed} rows, found ${projectGroupsFound} project groups, ${daySubgroupsProcessed} day subgroups`);
    console.log(`[TMetric] Extracted ${projectMap.size} projects with daily data`);

    return Array.from(projectMap.values());
  });

  console.log(`[TMetric] Found ${projectsData.length} total projects with data`);

  // Convert to ProjectChartData format
  const projects: ProjectChartData[] = [];

  for (const projectData of projectsData) {
    if (projectData.dailyHours.length > 0) {
      // Fill in missing days with 0 hours to show complete 30-day range
      const completeDailyHours = fillMissingDays(projectData.dailyHours, fromDate, toDate);

      const totalHours = Math.floor(projectData.totalMinutes / 60);
      const totalMins = projectData.totalMinutes % 60;
      const totalHoursStr = `${totalHours} h ${totalMins} min`;

      projects.push({
        id: projectData.id,
        name: projectData.name,
        client: projectData.client,
        dailyHours: completeDailyHours,
        totalHoursLast30Days: totalHoursStr,
      });

      console.log(`[TMetric]   ✓ ${projectData.name}: Total: ${totalHoursStr}, ${projectData.dailyHours.length} days with data (${completeDailyHours.length} total days)`);
    } else {
      console.log(`[TMetric]   ✗ ${projectData.name}: No hours in last 30 days, skipping`);
    }
  }

  console.log(`[TMetric] Completed processing ${projects.length} projects with hours`);

  return projects;
}

/**
 * Main function to scrape all active projects and their chart data
 * @param credentials TMetric login credentials
 * @param fromDate Start date
 * @param toDate End date
 * @returns Array of active projects with their chart data
 */
export async function scrapeAllProjectsChartData(
  credentials: TMetricCredentials,
  fromDate: Date,
  toDate: Date
): Promise<ProjectChartData[]> {
  let browser: Browser | null = null;

  try {
    console.log('[TMetric] Launching browser for project chart data...');
    const isProduction = process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT;
    browser = await chromium.launch({
      headless: isProduction ? true : false,
      slowMo: isProduction ? 0 : 500,
      timeout: 60000,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
      ],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: [],
      javaScriptEnabled: true,
    });

    const page = await context.newPage();
    page.setDefaultTimeout(30000);

    // Login to TMetric
    await loginToTMetric(page, credentials);

    // Get all projects with their chart data
    const projects = await getAllProjectsChartData(page, fromDate, toDate);

    console.log(`[TMetric] Found chart data for ${projects.length} active projects`);

    return projects;
  } catch (error) {
    console.error('[TMetric] Project chart data scraping error:', error);
    throw error;
  } finally {
    if (browser) {
      console.log('[TMetric] Closing browser...');
      await browser.close();
    }
  }
}

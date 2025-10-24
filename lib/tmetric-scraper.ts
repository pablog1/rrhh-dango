import { chromium, Page, Browser } from 'playwright';
import { TMetricCredentials, UserWithoutHours, UserChartData } from './types';
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

  // Wait for navigation after login
  console.log('[TMetric] Waiting for successful login...');
  await page.waitForLoadState('networkidle', { timeout: 15000 });

  await page.screenshot({ path: 'debug-after-login.png' });
  console.log('[TMetric] Screenshot saved: debug-after-login.png');
  console.log('[TMetric] Current URL after login:', page.url());

  console.log('[TMetric] Login successful!');
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
  console.log('[TMetric] Navigating to staff reports...');

  // Extract workspace ID from current URL
  // URL format: https://app.tmetric.com/#/tracker/134559/
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

  const fromDateStr = formatDate(fromDate);
  const toDateStr = formatDate(toDate);
  const dateRange = `${fromDateStr}-${toDateStr}`;

  // Build staff reports URL
  const reportsUrl = `https://app.tmetric.com/#/reports/${workspaceId}/staff?range=${dateRange}`;
  console.log('[TMetric] Navigating to:', reportsUrl);

  // Navigate to staff reports
  await page.goto(reportsUrl, { waitUntil: 'networkidle', timeout: 30000 });

  // Wait for page to load
  await page.waitForTimeout(3000);

  // Take screenshot
  await page.screenshot({ path: 'debug-reports.png' });
  console.log('[TMetric] Screenshot saved: debug-reports.png');
  console.log('[TMetric] Current URL:', page.url());

  // Try to find staff table/list elements
  console.log('[TMetric] Inspecting page structure...');

  // Look for common table/list structures
  const pageStructure = await page.evaluate(() => {
    const tables = Array.from(document.querySelectorAll('table')).map(table => ({
      class: table.className,
      rows: table.querySelectorAll('tr').length,
    }));

    const lists = Array.from(document.querySelectorAll('ul, ol')).map(list => ({
      class: list.className,
      items: list.querySelectorAll('li').length,
    }));

    const divs = Array.from(document.querySelectorAll('div[class*="staff"], div[class*="user"], div[class*="employee"], div[class*="member"]')).map(div => ({
      class: div.className,
      text: div.textContent?.substring(0, 100),
    }));

    return { tables, lists, divs };
  });

  console.log('[TMetric] Page structure:', JSON.stringify(pageStructure, null, 2));

  // Extract data from the staff table
  console.log('[TMetric] Extracting user data from table...');

  // Listen to console messages from page.evaluate
  page.on('console', msg => console.log('[Browser Console]', msg.text()));

  const usersWithoutHours: Array<{ id: string; name: string; userId: string }> = await page.evaluate(() => {
    const results: Array<{ id: string; name: string; userId: string }> = [];

    // Find the staff table
    const table = document.querySelector('table.table-team-summary-report');
    if (!table) {
      console.log('Table not found');
      return results;
    }

    // Get all rows except header
    const rows = table.querySelectorAll('tbody tr');

    rows.forEach((row, index) => {
      try {
        // Find cells in the row
        const cells = row.querySelectorAll('td');
        if (cells.length < 4) return; // Need at least 4 cells

        // Extract person name (second column - cells[1])
        // cells[0] is empty (checkbox/expand button)
        // cells[1] contains the person name
        // cells[2] contains days worked
        // cells[3] contains total hours
        const personCell = cells[1];

        // We'll extract userId by clicking on the row later
        // For now, just mark it as empty
        let userId = '';

        // Note: TMetric's staff report doesn't have direct links to users
        // We'll need to click on each row to get the userId from the URL

        // Extract name from cell
        let name = personCell.textContent?.trim() || '';

        // If empty, try to find in specific elements
        if (!name || name === '') {
          const nameElement = personCell.querySelector('a, span, div');
          name = nameElement?.textContent?.trim() || 'Unknown';
        }

        // Clean up the name (remove extra whitespace)
        name = name.replace(/\s+/g, ' ').trim() || 'Unknown';

        // Extract time worked (fourth column - cells[3] for total hours)
        const timeWorkedCell = cells[3];
        const timeWorked = timeWorkedCell?.textContent?.trim() || '0 min';

        // Check if time is "0 min" or empty
        const hasNoHours = timeWorked === '0 min' || timeWorked === '0' || timeWorked === '';

        console.log(`[TMetric] Row ${index}: name="${name}", timeWorked="${timeWorked}", hasNoHours=${hasNoHours}, userId="${userId}"`);

        if (hasNoHours) {
          results.push({
            id: `user-${index}`,
            name: name,
            userId: userId, // May be empty string if not found
          });
        }
      } catch (err) {
        console.error('Error processing row:', err);
      }
    });

    return results;
  });

  console.log(`[TMetric] Found ${usersWithoutHours.length} users without hours`);

  // For each user without hours, check their last 30 days
  const users: UserWithoutHours[] = [];

  for (const userInfo of usersWithoutHours) {
    console.log(`[TMetric] Checking 30-day history for: ${userInfo.name}`);

    // Navigate back to staff report if needed
    if (!page.url().includes('/reports/') || !page.url().includes('/staff')) {
      await page.goto(`https://app.tmetric.com/#/reports/${workspaceId}/staff?range=${dateRange}`, {
        waitUntil: 'networkidle',
      });
      await page.waitForTimeout(2000);
    }

    // Try to extract userId from row data
    let userId = '';
    try {
      // Find the row and extract any userId info from it
      const rowData = await page.evaluate((userName) => {
        const rows = document.querySelectorAll('table.table-team-summary-report tbody tr');
        for (const row of rows) {
          const cells = row.querySelectorAll('td');
          if (cells.length > 1) {
            // cells[0] is empty (checkbox), cells[1] has the name
            const nameCell = cells[1];
            const text = nameCell.textContent?.trim() || '';
            if (text === userName) {
              // Check for any data attributes
              const rowAttrs: Record<string, string> = {};
              for (const attr of row.attributes) {
                rowAttrs[attr.name] = attr.value;
              }

              // Check for ng-repeat or other Angular directives
              const ngRepeat = row.getAttribute('ng-repeat');

              // Try to find any links in the row
              const links = row.querySelectorAll('a');
              const linkHrefs = Array.from(links).map(link => link.getAttribute('href')).filter(Boolean);

              // Try to extract userId from Angular scope using angular.element()
              let scopeData = null;
              try {
                const angular = (window as any).angular;
                if (angular) {
                  const element = angular.element(row);
                  const scope = element.scope();
                  if (scope && scope.item) {
                    scopeData = {
                      userId: scope.item.userId,
                      userProfileId: scope.item.userProfileId,
                      userName: scope.item.userName,
                    };
                  }
                }
              } catch (e) {
                // Angular not available or scope not accessible
              }

              return {
                found: true,
                attributes: rowAttrs,
                ngRepeat,
                linkHrefs,
                scopeData,
                innerHTML: row.innerHTML.substring(0, 1000), // First 1000 chars for debug
              };
            }
          }
        }
        return { found: false };
      }, userInfo.name);

      if (!rowData.found) {
        console.log(`[TMetric] Could not find row for ${userInfo.name}`);
        users.push({
          id: userInfo.id,
          name: userInfo.name,
          email: '',
          lastEntry: null,
          totalHoursLast30Days: 'N/A',
          daysWithoutEntries: undefined,
        });
        continue;
      }

      console.log(`[TMetric] Row data for ${userInfo.name}:`, JSON.stringify(rowData, null, 2));

      // Try to extract userId from Angular scope first
      if (rowData.scopeData) {
        // Try userId first, then userProfileId as fallback
        if (rowData.scopeData.userId) {
          userId = String(rowData.scopeData.userId);
          console.log(`[TMetric] Extracted userId from Angular scope: ${userId}`);
        } else if (rowData.scopeData.userProfileId) {
          userId = String(rowData.scopeData.userProfileId);
          console.log(`[TMetric] Extracted userProfileId from Angular scope: ${userId}`);
        }
      }

      // Try to extract userId from ng-repeat or other attributes
      if (!userId && rowData.ngRepeat) {
        const userIdMatch = rowData.ngRepeat.match(/userId[:\s]*(\d+)/i);
        if (userIdMatch) {
          userId = userIdMatch[1];
          console.log(`[TMetric] Extracted userId from ng-repeat: ${userId}`);
        }
      }

      // If we found a link, try to extract from there
      if (!userId && rowData.linkHrefs && rowData.linkHrefs.length > 0) {
        for (const href of rowData.linkHrefs) {
          const match = href?.match(/user=(\d+)/);
          if (match) {
            userId = match[1];
            console.log(`[TMetric] Extracted userId from link: ${userId}`);
            break;
          }
        }
      }

      if (!userId) {
        console.log(`[TMetric] Could not extract userId for ${userInfo.name}, will skip 30-day data`);
        users.push({
          id: userInfo.id,
          name: userInfo.name,
          email: '',
          lastEntry: null,
          totalHoursLast30Days: 'N/A',
          daysWithoutEntries: undefined,
        });
        continue;
      }
    } catch (error) {
      console.error(`[TMetric] Error clicking row for ${userInfo.name}:`, error);
      users.push({
        id: userInfo.id,
        name: userInfo.name,
        email: '',
        lastEntry: null,
        totalHoursLast30Days: 'N/A',
        daysWithoutEntries: undefined,
      });
      continue;
    }

    console.log(`[TMetric] Processing ${userInfo.name} (ID: ${userId})`);

    try {
      // Calculate 30 days ago from today
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);

      const formatDate = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
      };

      const range = `${formatDate(thirtyDaysAgo)}-${formatDate(today)}`;

      // Navigate to detailed report for this user
      const detailedReportUrl = `https://app.tmetric.com/#/reports/${workspaceId}/detailed?range=${range}&user=${userId}&groupby=day`;
      console.log(`[TMetric]   Navigating to: ${detailedReportUrl}`);

      await page.goto(detailedReportUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Extract data from detailed report
      const reportData = await page.evaluate((): {
        lastEntry: string | null;
        totalHours: string;
        dailyHours: Array<{ date: string; hours: number }>;
      } => {
        const table = document.querySelector('table.table-hover');
        if (!table) {
          return { lastEntry: null, totalHours: '0 h 0 min', dailyHours: [] };
        }

        const rows = table.querySelectorAll('tbody tr');
        let lastEntryDate: string | null = null;
        let lastEntryTimestamp: number = 0;
        let totalMinutes = 0;
        const dailyData: Array<{ date: string; hours: number }> = [];

        rows.forEach((row) => {
          const cells = row.querySelectorAll('td');
          if (cells.length < 2) return;

          // First cell contains the date
          const dateCell = cells[0];
          let dateText = dateCell.textContent?.trim() || '';

          // Clean up the date: remove newlines and day names
          // Format is "23/09/2025 Tuesday" or similar
          const dateMatch = dateText.match(/(\d{2}\/\d{2}\/\d{4})/);
          dateText = dateMatch ? dateMatch[1] : dateText.split(/\s+/)[0].trim();

          // DURATION column: look for cell with time pattern (h/min)
          // It's usually the last or second-to-last cell
          let timeText = '';

          // Try last cell first
          const lastCellText = cells[cells.length - 1]?.textContent?.trim() || '';
          if (lastCellText.match(/\d+\s*(h|min)/)) {
            timeText = lastCellText;
          } else if (cells.length > 1) {
            // Try second to last
            const secondLastText = cells[cells.length - 2]?.textContent?.trim() || '';
            if (secondLastText.match(/\d+\s*(h|min)/)) {
              timeText = secondLastText;
            }
          }

          // Parse time (e.g., "2 h 30 min" or "45 min" or "8 h 00 min")
          const hoursMatch = timeText.match(/(\d+)\s*h/);
          const minutesMatch = timeText.match(/(\d+)\s*min/);

          const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
          const minutes = minutesMatch ? parseInt(minutesMatch[1]) : 0;
          const rowMinutes = hours * 60 + minutes;

          // Always add to daily data (even if 0 hours)
          const hoursDecimal = rowMinutes / 60;
          dailyData.push({ date: dateText, hours: hoursDecimal });

          if (rowMinutes > 0) {
            totalMinutes += rowMinutes;

            // Parse the date to find the most recent entry
            const dateParts = dateText.split('/');
            if (dateParts.length === 3) {
              const day = parseInt(dateParts[0]);
              const month = parseInt(dateParts[1]) - 1;
              const year = parseInt(dateParts[2]);
              const entryDate = new Date(year, month, day);
              const timestamp = entryDate.getTime();

              // Keep track of the most recent date with hours
              if (timestamp > lastEntryTimestamp) {
                lastEntryTimestamp = timestamp;
                lastEntryDate = dateText;
              }
            }
          }
        });

        // Convert total minutes to readable format
        const totalHours = Math.floor(totalMinutes / 60);
        const remainingMinutes = totalMinutes % 60;
        const totalHoursStr = `${totalHours} h ${remainingMinutes} min`;

        return {
          lastEntry: lastEntryDate,
          totalHours: totalHoursStr,
          dailyHours: dailyData,
        };
      });

      // Calculate days since last entry
      let daysSinceLastEntry: number | undefined;
      if (reportData.lastEntry) {
        // Parse date in format "23/09/2025" or "DD/MM/YYYY"
        const dateParts = reportData.lastEntry.split('/');
        if (dateParts.length === 3) {
          const day = parseInt(dateParts[0]);
          const month = parseInt(dateParts[1]) - 1; // Month is 0-indexed
          const year = parseInt(dateParts[2]);
          const lastEntryDate = new Date(year, month, day);

          const diffTime = today.getTime() - lastEntryDate.getTime();
          daysSinceLastEntry = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        }
      }

      users.push({
        id: userInfo.id,
        name: userInfo.name,
        email: '',
        lastEntry: reportData.lastEntry,
        totalHoursLast30Days: reportData.totalHours,
        daysWithoutEntries: daysSinceLastEntry,
      });

      console.log(`[TMetric]   ✓ ${userInfo.name}: Last entry: ${reportData.lastEntry || 'None'}, Total: ${reportData.totalHours}`);
    } catch (err) {
      console.error(`[TMetric]   ✗ Error checking ${userInfo.name}:`, err);
      // Add user with null data if there's an error
      users.push({
        id: userInfo.id,
        name: userInfo.name,
        email: '',
        lastEntry: null,
        totalHoursLast30Days: '0 h 0 min',
      });
    }
  }

  console.log(`[TMetric] Completed checking ${users.length} users`);

  return users;
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
  console.log('[TMetric] Navigating to staff reports...');

  // Extract workspace ID from current URL
  const currentUrl = page.url();
  const workspaceMatch = currentUrl.match(/\/tracker\/(\d+)/);

  if (!workspaceMatch) {
    throw new Error('Could not extract workspace ID from URL: ' + currentUrl);
  }

  const workspaceId = workspaceMatch[1];
  console.log('[TMetric] Workspace ID:', workspaceId);

  const dateRange = `${toISODate(fromDate).replace(/-/g, '')}-${toISODate(toDate).replace(/-/g, '')}`;
  console.log('[TMetric] Navigating to:', `https://app.tmetric.com/#/reports/${workspaceId}/staff?range=${dateRange}`);

  await page.goto(`https://app.tmetric.com/#/reports/${workspaceId}/staff?range=${dateRange}`, {
    waitUntil: 'networkidle',
  });

  await page.waitForTimeout(3000);

  // Extract ALL users from the staff report table
  const allUsers = await page.evaluate(() => {
    const results: Array<{ id: string; name: string; userId: string }> = [];
    const table = document.querySelector('table.table-team-summary-report');

    if (!table) {
      console.log('[TMetric] Staff report table not found');
      return results;
    }

    const rows = table.querySelectorAll('tbody tr');

    rows.forEach((row, index) => {
      try {
        const cells = row.querySelectorAll('td');
        if (cells.length < 3) return;

        const personCell = cells[0];
        let name = personCell.textContent?.trim() || '';
        name = name.replace(/\s+/g, ' ').trim() || 'Unknown';

        if (name && name !== 'Unknown') {
          results.push({
            id: `user-${index}`,
            name: name,
            userId: '',
          });
        }
      } catch (err) {
        console.error('Error processing row:', err);
      }
    });

    return results;
  });

  console.log(`[TMetric] Found ${allUsers.length} total users`);

  // For each user, get their 30-day chart data
  const users: UserChartData[] = [];

  for (const userInfo of allUsers) {
    console.log(`[TMetric] Getting 30-day chart data for: ${userInfo.name}`);

    // Navigate back to staff report if needed
    if (!page.url().includes('/reports/') || !page.url().includes('/staff')) {
      await page.goto(`https://app.tmetric.com/#/reports/${workspaceId}/staff?range=${dateRange}`, {
        waitUntil: 'networkidle',
      });
      await page.waitForTimeout(2000);
    }

    // Wait for Angular to be ready and table to load
    await page.waitForTimeout(2000);
    await page.waitForSelector('table.table-team-summary-report', { timeout: 10000 });

    // Take screenshot for first user only (for debugging)
    if (userInfo === allUsers[0]) {
      await page.screenshot({ path: `debug-charts-staff-report-${Date.now()}.png` });
      console.log(`[TMetric]   Screenshot saved for debugging`);
    }

    // Try to extract userId from Angular scope
    let userId = '';
    try {
      const rowData = await page.evaluate((userName) => {
        const rows = document.querySelectorAll('table.table-team-summary-report tbody tr');
        const result = {
          totalRows: rows.length,
          found: false,
          scopeData: null as any,
          angularAvailable: false,
          scopeFound: false,
          itemFound: false,
        };

        for (const row of rows) {
          const cells = row.querySelectorAll('td');
          if (cells.length > 0) {
            const nameCell = cells[0];
            const text = nameCell.textContent?.trim() || '';

            if (text === userName) {
              result.found = true;
              let scopeData = null;
              try {
                const angular = (window as any).angular;
                result.angularAvailable = !!angular;

                if (angular) {
                  const element = angular.element(row);
                  const scope = element.scope();
                  result.scopeFound = !!scope;
                  result.itemFound = scope ? !!scope.item : false;

                  if (scope && scope.item) {
                    scopeData = {
                      userId: scope.item.userId,
                      userProfileId: scope.item.userProfileId,
                      userName: scope.item.userName,
                    };
                    result.scopeData = scopeData;
                  }
                }
              } catch (e) {
                // Error will be caught outside
              }

              return result;
            }
          }
        }
        return result;
      }, userInfo.name);

      console.log(`[TMetric]   Row data result:`, rowData);

      if (rowData.found && rowData.scopeData?.userProfileId) {
        userId = rowData.scopeData.userProfileId;
        console.log(`[TMetric]   ✓ Found userId: ${userId}`);
      } else {
        console.log(`[TMetric]   ✗ No userId found for ${userInfo.name}, skipping. Found: ${rowData.found}, scopeData:`, rowData.scopeData);
        continue;
      }
    } catch (err) {
      console.error(`[TMetric]   ✗ Error extracting userId for ${userInfo.name}:`, err);
      continue;
    }

    // Navigate to detailed report for this user
    try {
      const detailedUrl = `https://app.tmetric.com/#/reports/${workspaceId}/detailed?range=${dateRange}&user=${userId}&groupby=day`;
      console.log(`[TMetric]   Navigating to detailed report: ${detailedUrl}`);

      await page.goto(detailedUrl, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // Extract daily hours data
      const reportData = await page.evaluate((): {
        lastEntry: string | null;
        totalHours: string;
        dailyHours: Array<{ date: string; hours: number }>;
      } => {
        const dailyData: Array<{ date: string; hours: number }> = [];
        let totalMinutes = 0;
        let lastEntryDate: string | null = null;
        let lastEntryTimestamp = 0;

        const table = document.querySelector('table.table-detailed-report');
        if (!table) {
          return {
            lastEntry: null,
            totalHours: '0 h 0 min',
            dailyHours: [],
          };
        }

        const rows = table.querySelectorAll('tbody tr');

        rows.forEach((row) => {
          const cells = row.querySelectorAll('td');
          if (cells.length === 0) return;

          // Try last cell first for time
          let timeText = '';
          const lastCellText = cells[cells.length - 1]?.textContent?.trim() || '';
          if (lastCellText.match(/\d+\s*(h|min)/)) {
            timeText = lastCellText;
          } else if (cells.length > 1) {
            const secondLastText = cells[cells.length - 2]?.textContent?.trim() || '';
            if (secondLastText.match(/\d+\s*(h|min)/)) {
              timeText = secondLastText;
            }
          }

          // Try first cell for date
          const dateText = cells[0]?.textContent?.trim() || '';
          if (!dateText.match(/\d{1,2}\/\d{1,2}\/\d{4}/)) return;

          // Parse time
          let rowMinutes = 0;
          const hourMatch = timeText.match(/(\d+)\s*h/);
          const minMatch = timeText.match(/(\d+)\s*min/);
          if (hourMatch) rowMinutes += parseInt(hourMatch[1]) * 60;
          if (minMatch) rowMinutes += parseInt(minMatch[1]);

          if (rowMinutes > 0) {
            totalMinutes += rowMinutes;
            const dateParts = dateText.split('/');
            if (dateParts.length === 3) {
              const day = parseInt(dateParts[0]);
              const month = parseInt(dateParts[1]) - 1;
              const year = parseInt(dateParts[2]);
              const entryDate = new Date(year, month, day);
              const timestamp = entryDate.getTime();

              if (timestamp > lastEntryTimestamp) {
                lastEntryTimestamp = timestamp;
                lastEntryDate = dateText;
              }
            }

            const hoursDecimal = rowMinutes / 60;
            dailyData.push({ date: dateText, hours: hoursDecimal });
          }
        });

        const totalHours = Math.floor(totalMinutes / 60);
        const totalMins = totalMinutes % 60;
        const totalHoursStr = `${totalHours} h ${totalMins} min`;

        return {
          lastEntry: lastEntryDate,
          totalHours: totalHoursStr,
          dailyHours: dailyData,
        };
      });

      users.push({
        id: userId,
        name: userInfo.name,
        email: '',
        dailyHours: reportData.dailyHours,
        totalHoursLast30Days: reportData.totalHours,
      });

      console.log(`[TMetric]   ✓ ${userInfo.name}: Total: ${reportData.totalHours}, ${reportData.dailyHours.length} days with data`);
    } catch (err) {
      console.error(`[TMetric]   ✗ Error checking ${userInfo.name}:`, err);
    }
  }

  console.log(`[TMetric] Completed checking ${users.length} users`);

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
    browser = await chromium.launch({
      headless: false, // Always headed for debugging
      slowMo: 500, // Slow down actions for visibility
      timeout: 60000,
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
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
    browser = await chromium.launch({
      headless: false,
      slowMo: 500,
      timeout: 60000,
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
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

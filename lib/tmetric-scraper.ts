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

        // Extract person name - Find the cell with class containing 'col-name'
        // TMetric structure has the name in a td with class like "col-report ng-binding ng-scope col-name-narrow"
        const personCell = row.querySelector('td.col-name, td.col-name-narrow, td[ng-if*="user"]');

        if (!personCell) {
          return; // Skip if we can't find the name cell
        }

        // We'll extract userId by clicking on the row later
        // For now, just mark it as empty
        let userId = '';

        // Extract name from the title attribute first (most reliable)
        let name = personCell.getAttribute('title') || '';

        // If no title, try textContent but exclude nested elements
        if (!name) {
          // Clone the cell to manipulate it
          const cellClone = personCell.cloneNode(true) as HTMLElement;
          // Remove image tags
          cellClone.querySelectorAll('img').forEach(img => img.remove());
          name = cellClone.textContent?.trim() || '';
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
          // Find the name cell using the same selector as before
          const nameCell = row.querySelector('td.col-name, td.col-name-narrow, td[ng-if*="user"]');

          if (nameCell) {
            // Check both title attribute and textContent
            const titleName = nameCell.getAttribute('title') || '';
            const textName = nameCell.textContent?.trim() || '';

            if (titleName === userName || textName === userName) {
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

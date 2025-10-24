import { chromium, Page, Browser } from 'playwright';
import { TMetricCredentials, UserWithoutHours } from './types';
import { toISODate } from './date-utils';

/**
 * Login to TMetric using Playwright
 * @param page Playwright page instance
 * @param credentials TMetric credentials
 */
async function loginToTMetric(page: Page, credentials: TMetricCredentials): Promise<void> {
  console.log('[TMetric] Navigating to login page...');
  await page.goto('https://app.tmetric.com/login', { waitUntil: 'networkidle' });

  console.log('[TMetric] Filling credentials...');

  // Wait for email input and fill it
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
  await page.fill('input[type="email"], input[name="email"]', credentials.email);

  // Fill password
  await page.fill('input[type="password"], input[name="password"]', credentials.password);

  console.log('[TMetric] Clicking login button...');

  // Click login button
  await page.click('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")');

  // Wait for navigation after login
  console.log('[TMetric] Waiting for successful login...');
  await page.waitForURL('**/app.tmetric.com/**', { timeout: 15000 });

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
  console.log('[TMetric] Navigating to reports section...');

  // This is a placeholder - actual selectors will need to be determined
  // by inspecting TMetric's actual HTML structure
  // TODO: Update these selectors based on actual TMetric UI

  try {
    // Navigate to time tracking or reports page
    await page.goto('https://app.tmetric.com/tracker', { waitUntil: 'networkidle' });

    // Wait for the page to load
    await page.waitForTimeout(2000);

    console.log('[TMetric] Extracting user data...');

    // Example placeholder logic - needs to be adapted to actual TMetric structure
    const users: UserWithoutHours[] = [];

    // This is where you would:
    // 1. Navigate to the reports/team view
    // 2. Filter by date range (fromDate to toDate)
    // 3. Extract list of team members
    // 4. For each member, check if they have time entries in the date range
    // 5. Add users without entries to the array

    // Placeholder example (adapt to real structure):
    const userElements = await page.$$('[data-user-id], .user-row, .team-member');

    console.log(`[TMetric] Found ${userElements.length} user elements`);

    for (const userEl of userElements) {
      try {
        const name = await userEl.textContent() || 'Unknown';
        const userId = await userEl.getAttribute('data-user-id') || `user-${Math.random()}`;

        // Check if user has time entries (this logic needs to be adapted)
        const hasEntries = false; // Placeholder - implement actual check

        if (!hasEntries) {
          users.push({
            id: userId,
            name: name.trim(),
            email: `${userId}@example.com`, // Extract real email from UI
            lastEntry: null,
          });
        }
      } catch (err) {
        console.error('[TMetric] Error processing user element:', err);
      }
    }

    return users;
  } catch (error) {
    console.error('[TMetric] Error extracting user data:', error);
    throw new Error('Failed to extract user data from TMetric');
  }
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
      headless: process.env.NODE_ENV === 'production', // Headed in dev, headless in prod
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

import { chromium } from 'playwright';

async function testProjectNavigation() {
  console.log('Launching browser in headed mode...');
  const browser = await chromium.launch({
    headless: false,
    slowMo: 1000, // Slow down so you can see what's happening
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  // Navigate to TMetric login
  console.log('Navigate to: https://app.tmetric.com/login');
  await page.goto('https://app.tmetric.com/login');

  console.log('\n=== PLEASE LOG IN MANUALLY ===');
  console.log('Once logged in, press ENTER in this terminal to continue...\n');

  // Wait for user to press Enter
  await new Promise((resolve) => {
    process.stdin.once('data', resolve);
  });

  console.log('Continuing...');

  // Get current URL and extract workspace ID
  const currentUrl = page.url();
  console.log('Current URL:', currentUrl);

  const workspaceMatch = currentUrl.match(/\/tracker\/(\d+)/);
  if (!workspaceMatch) {
    console.error('Could not find workspace ID in URL');
    await browser.close();
    return;
  }

  const workspaceId = workspaceMatch[1];
  console.log('Workspace ID:', workspaceId);

  // Calculate date range (last 30 days)
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 30);

  const formatDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  };

  const dateRange = `${formatDate(fromDate)}-${formatDate(toDate)}`;
  console.log('Date range:', dateRange);

  // Try method 1: Click on Reports menu
  console.log('\n=== Method 1: Clicking Reports menu ===');
  try {
    await page.click('a[href*="/reports"]', { timeout: 5000 });
    console.log('✓ Clicked Reports menu');
    await page.waitForTimeout(3000);
    console.log('Current URL:', page.url());
  } catch (e) {
    console.log('✗ Could not click Reports menu');
  }

  // Try method 2: Use Angular $location service
  console.log('\n=== Method 2: Using Angular $location ===');
  const reportPath = `/reports/${workspaceId}/summary?range=${dateRange}&groupby=project`;
  console.log('Target path:', reportPath);

  const result = await page.evaluate((path) => {
    try {
      const angular = (window as any).angular;
      if (!angular) {
        return { success: false, error: 'Angular not found' };
      }

      const element = angular.element(document.body);
      const injector = element.injector();
      if (!injector) {
        return { success: false, error: 'Injector not found' };
      }

      const $location = injector.get('$location');
      const $rootScope = injector.get('$rootScope');

      if (!$location) {
        return { success: false, error: '$location not found' };
      }

      $location.url(path);
      $rootScope.$apply();

      return { success: true, newUrl: $location.url() };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }, reportPath);

  console.log('Navigation result:', result);
  await page.waitForTimeout(5000);
  console.log('Current URL:', page.url());

  // Take screenshot
  await page.screenshot({ path: 'test-navigation.png' });
  console.log('Screenshot saved: test-navigation.png');

  // Check for tables
  const tables = await page.evaluate(() => {
    const allTables = document.querySelectorAll('table');
    return Array.from(allTables).map((t, i) => ({
      index: i,
      className: t.className,
      rowCount: t.querySelectorAll('tbody tr').length
    }));
  });

  console.log('\nTables found:', tables);

  console.log('\n=== Browser will stay open. Press ENTER to close ===');
  await new Promise((resolve) => {
    process.stdin.once('data', resolve);
  });

  await browser.close();
}

testProjectNavigation().catch(console.error);

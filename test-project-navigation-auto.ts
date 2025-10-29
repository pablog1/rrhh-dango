import { chromium } from 'playwright';

async function testProjectNavigation() {
  console.log('Launching browser in headed mode...');
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  // Navigate to TMetric login
  console.log('Navigate to: https://app.tmetric.com/login');
  await page.goto('https://app.tmetric.com/login');

  console.log('Waiting for login (checking for tracker URL)...');

  // Wait for redirect to tracker after login (max 60 seconds)
  try {
    await page.waitForURL(/tracker\/\d+/, { timeout: 60000 });
    console.log('✓ Login detected!');
  } catch (e) {
    console.log('✗ Timeout waiting for login');
    await browser.close();
    return;
  }

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
    const reportsLink = await page.$('a[href*="/reports"]');
    if (reportsLink) {
      const href = await reportsLink.getAttribute('href');
      console.log('Found Reports link with href:', href);
      await reportsLink.click();
      console.log('✓ Clicked Reports menu');
      await page.waitForTimeout(3000);
      console.log('Current URL after click:', page.url());
    } else {
      console.log('✗ Reports link not found');
    }
  } catch (e: any) {
    console.log('✗ Error clicking Reports menu:', e.message);
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

      console.log('Before navigation - $location.url():', $location.url());
      $location.url(path);
      $rootScope.$apply();
      console.log('After navigation - $location.url():', $location.url());

      return { success: true, newUrl: $location.url() };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }, reportPath);

  console.log('Navigation result:', result);
  await page.waitForTimeout(5000);
  console.log('Current URL after Angular navigation:', page.url());

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

  console.log('\nTables found on page:');
  tables.forEach(t => {
    console.log(`  [${t.index}] ${t.className} (${t.rowCount} rows)`);
  });

  // Get page title
  const title = await page.title();
  console.log('\nPage title:', title);

  console.log('\n=== Waiting 30 seconds before closing (you can inspect the page) ===');
  await page.waitForTimeout(30000);

  await browser.close();
  console.log('Browser closed');
}

testProjectNavigation().catch(console.error);

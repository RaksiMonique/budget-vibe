const { test, expect } = require('@playwright/test');

test.describe('Budget Tracker E2E', () => {
  
  test.beforeEach(async ({ page }) => {
    // Load the homepage
    await page.goto('/');
    
    // Reset data to ensure clean state for each test (simulating the Reset button)
    // We handle the confirmation dialog
    page.on('dialog', dialog => dialog.accept());
    await page.evaluate(() => {
      localStorage.clear();
      location.reload();
    });
  });

  test('should load the dashboard correctly', async ({ page }) => {
    await expect(page).toHaveTitle(/Budget Tracker/);
    await expect(page.locator('.navbar-brand')).toHaveText('Budget Tracker');
  });

  test('should add a transaction and update the table', async ({ page }) => {
    // 1. Open Transaction Modal
    await page.getByRole('button', { name: 'Add Transaction' }).first().click();
    await expect(page.locator('#modalTransaction')).toBeVisible();

    // 2. Fill Form
    // Date is auto-filled by JS, but we can set it explicitly
    await page.fill('#txDate', '2026-03-15');
    
    // Select Account (Assuming seed data creates an account, or we select the first one)
    // We wait for options to populate
    await page.locator('#txAccount').selectOption({ index: 0 });

    // Select Category
    await page.selectOption('#txMajor', 'variable');
    // Wait for minor categories to repopulate based on major selection
    await page.waitForTimeout(200); 
    // Select "Groceries" (seeded by default in app.js)
    await page.locator('#txMinor').selectOption({ label: 'Groceries' });

    await page.fill('#txDesc', 'Weekly Shop');
    await page.fill('#txAmount', '150.50');

    // 3. Submit
    await page.click('#txSubmitBtn');

    // 4. Verify Modal Closed
    await expect(page.locator('#modalTransaction')).not.toBeVisible();

    // 5. Verify Transaction in Table
    const row = page.locator('#txTbody tr').first();
    await expect(row).toContainText('2026-03-15');
    await expect(row).toContainText('Weekly Shop');
    await expect(row).toContainText('$150.50');
    await expect(row).toContainText('Groceries');
  });

  test('should allow switching tabs', async ({ page }) => {
    // Click on "Bills" tab
    await page.click('#tab-bills');
    await expect(page.locator('#pane-bills')).toHaveClass(/active/);
    
    // Click on "Stocks" tab
    await page.click('#tab-stocks');
    await expect(page.locator('#pane-stocks')).toHaveClass(/active/);
  });
});
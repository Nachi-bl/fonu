const { chromium } = require('@playwright/test');
const { config } = require('dotenv');
const { existsSync, mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
config({ path: resolve(__dirname, '../.env') });
async function main() {
  const executablePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const browser = await chromium.launch({
    headless: true,
    ...(existsSync(executablePath) ? { executablePath } : {}),
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const output = resolve(__dirname, '../docs/screenshots');
  mkdirSync(output, { recursive: true });
  try {
    await page.goto('http://localhost:5173');
    await page.getByRole('heading', { name: 'QuietForm Headphones', exact: true }).waitFor();
    await page.screenshot({ path: resolve(output, 'customer-catalog.png'), fullPage: true });
    await page
      .getByRole('button', { name: 'Add Daily Notes Notebook to cart', exact: true })
      .click();
    await page.goto('http://localhost:5173/cart');
    await page.getByRole('heading', { name: 'Daily Notes Notebook', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Sign in to checkout', exact: true }).click();
    await page.getByLabel('Email address', { exact: true }).fill('customer@stockroom.local');
    await page.getByLabel('Password', { exact: true }).fill(process.env.SEED_CUSTOMER_PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('button', { name: 'Place order', exact: true }).click();
    await page
      .getByText('Your order is placed. We’ve got it from here.', { exact: true })
      .waitFor();
    await page.screenshot({ path: resolve(output, 'customer-order.png'), fullPage: true });
    await page.getByRole('button', { name: 'Cancel order', exact: true }).click();
    await page.getByText('Cancelled', { exact: true }).waitFor();
    await page.getByRole('link', { name: 'Back to orders', exact: true }).click();
    await page.getByRole('heading', { name: 'My orders', exact: true }).waitFor();
    await page.getByRole('cell', { name: 'Cancelled', exact: true }).first().waitFor();
    await page.screenshot({ path: resolve(output, 'customer-history.png'), fullPage: true });
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.goto('http://localhost:5173/login');
    await page
      .getByLabel('Email address', { exact: true })
      .fill(process.env.SEED_ADMIN_EMAIL || 'admin@stockroom.local');
    await page.getByLabel('Password', { exact: true }).fill(process.env.SEED_ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('button', { name: 'Sign out', exact: true }).waitFor();
    await page.getByRole('link', { name: 'Inventory', exact: true }).click();
    await page.getByRole('heading', { name: 'Inventory', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Edit', exact: true }).first().waitFor();
    await page.screenshot({ path: resolve(output, 'admin-inventory.png'), fullPage: true });
    await page.getByRole('button', { name: 'Add product', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
    await page.getByRole('button', { name: 'Save product', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.getByRole('link', { name: 'Incoming orders', exact: true }).click();
    await page.getByRole('heading', { name: 'Incoming orders', exact: true }).waitFor();
    await page.getByRole('cell', { name: 'Cancelled', exact: true }).first().waitFor();
    await page.screenshot({ path: resolve(output, 'admin-orders.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
    await page.getByRole('link', { name: 'Browse products', exact: true }).click();
    await page.getByRole('heading', { name: 'QuietForm Headphones', exact: true }).waitFor();
    await page.screenshot({ path: resolve(output, 'mobile-catalog.png'), fullPage: true });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    if (overflow) throw new Error('Mobile layout overflows horizontally');
    if (errors.length) throw new Error(errors.join('\n'));
    console.log(
      'Browser checks passed: catalog, cart, customer checkout/cancellation/history, admin edit/orders, mobile layout. Screenshots saved in docs/screenshots.',
    );
  } catch (error) {
    await page.screenshot({ path: resolve(output, 'browser-failure.png'), fullPage: true });
    console.error('Browser check failed at ' + page.url());
    throw error;
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

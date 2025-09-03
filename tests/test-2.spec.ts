import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://docs.temporal.io/self-hosted-guide/server-frontend-api-reference');
  await page.getByRole('link', { name: 'Safe deployments' }).click();
  await page.getByRole('link', { name: 'Workflows' }).click();
});
import { expect, test } from '@playwright/test';

test('loads the simulator and supports primary controls', async ({ page }) => {
  await page.goto('/');

  const canvas = page.locator('#world-canvas');
  await expect(canvas).toBeVisible();
  await expect(page.getByTestId('ant-count')).toHaveText('20');
  await expect(page.getByTestId('selected-ant-id')).toContainText('ant-');

  await expect
    .poll(
      async () => {
        const values = await Promise.all([
          page.getByTestId('selected-ant-goal').textContent(),
          page.getByTestId('selected-ant-action').textContent(),
          page.getByTestId('selected-ant-plan').textContent(),
        ]);
        return values.some((value) => value && value !== 'none') ? 'active' : 'idle';
      },
      { timeout: 10_000 },
    )
    .toBe('active');

  const nonBlankPixels = await canvas.evaluate((node) => {
    const canvasElement = node as HTMLCanvasElement;
    const ctx = canvasElement.getContext('2d');
    if (!ctx) {
      return 0;
    }

    const pixels = ctx.getImageData(0, 0, canvasElement.width, canvasElement.height).data;
    let nonBlank = 0;
    for (let index = 0; index < pixels.length; index += 4 * 200) {
      if (pixels[index] || pixels[index + 1] || pixels[index + 2] || pixels[index + 3]) {
        nonBlank += 1;
      }
    }
    return nonBlank;
  });
  expect(nonBlankPixels).toBeGreaterThan(0);

  await page.getByTestId('pause-button').click();
  await expect(page.getByTestId('pause-button')).toHaveText('Resume');

  await page.getByTestId('speed-select').selectOption('5');
  await page.getByTestId('spawn-ant-button').click();
  await expect(page.getByTestId('ant-count')).toHaveText('21');

  await page.getByTestId('spawn-food-button').click();
  await page.getByTestId('reset-button').click();
  await expect(page.getByTestId('ant-count')).toHaveText('20');
});

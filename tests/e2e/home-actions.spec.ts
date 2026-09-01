import { expect, test } from '@playwright/test'

test('reveals delete with a left swipe and removes the trip after confirmation', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: '새 여행', exact: true }).last().click()
  await page.getByLabel('여행 이름').fill('삭제 테스트 여행')
  await page.getByLabel('목적지').fill('제주도')
  await page.getByRole('button', { name: '여행 만들기' }).click()
  await page.getByRole('link', { name: '여행 목록' }).click()

  const row = page.locator('.trip-swipe').filter({ hasText: '삭제 테스트 여행' })
  const content = row.locator('.trip-swipe__content'); const box = await content.boundingBox()
  expect(box).not.toBeNull()
  const startX = box!.x + box!.width / 2; const y = box!.y + box!.height / 2
  await page.mouse.move(startX, y); await page.mouse.down(); await page.mouse.move(startX - 90, y, { steps: 8 }); await page.mouse.up()
  await expect(content).toHaveAttribute('style', /translateX\(-82px\)/)

  await row.getByRole('button', { name: '삭제 테스트 여행 삭제' }).click()
  const dialog = page.getByRole('dialog', { name: '여행 삭제' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: '여행 삭제' }).click()
  await expect(page.getByText('삭제 테스트 여행')).toHaveCount(0)
  await page.reload()
  await expect(page.getByText('삭제 테스트 여행')).toHaveCount(0)
})

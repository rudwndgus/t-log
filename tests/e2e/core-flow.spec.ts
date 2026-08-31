import { expect, test } from '@playwright/test'

test('creates a trip and connects note, map, and chat flows', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()

  await page.getByRole('link', { name: '새 여행', exact: true }).last().click()
  await page.getByLabel('여행 이름').fill('몬트리올 가을여행')
  await page.getByLabel('목적지').fill('Montreal')
  await page.getByRole('button', { name: '여행 만들기' }).click()

  await expect(page.getByText('여행 노트')).toBeVisible()
  await page.getByRole('button', { name: /첫 페이지 만들기/ }).click()
  await page.getByLabel('페이지 제목').fill('가고 싶은 곳')

  await page.getByRole('link', { name: '지도' }).click()
  await page.getByRole('button', { name: /첫 장소 추가/ }).click()
  await page.getByPlaceholder('장소 검색...').fill('Old Montreal')
  await page.getByRole('button', { name: /직접 추가/ }).click()
  await page.getByLabel(/시작 시간/).fill('10:30')
  await page.getByRole('button', { name: '추가', exact: true }).click()
  await page.getByRole('button', { name: /LIST/ }).click()
  await expect(page.getByText('Old Montreal')).toBeVisible()

  await page.getByRole('link', { name: '채팅' }).click()
  await page.getByPlaceholder('메시지...').fill('여기서 만나자!')
  await page.getByRole('button', { name: '전송' }).click()
  await expect(page.getByText('여기서 만나자!')).toBeVisible()
})

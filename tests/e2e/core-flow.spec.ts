import { expect, test } from '@playwright/test'

test('creates a trip and connects note, map, and chat flows', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => { localStorage.clear(); await new Promise<void>((resolve) => { const request = indexedDB.deleteDatabase('tlog-local'); request.onsuccess = () => resolve(); request.onerror = () => resolve(); request.onblocked = () => resolve() }) })
  await page.reload()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)

  await page.getByRole('link', { name: '새 여행', exact: true }).last().click()
  await page.getByLabel('여행 이름').fill('몬트리올 가을여행')
  await page.getByLabel('목적지').fill('Montreal')
  await page.getByRole('button', { name: '여행 만들기' }).click()

  await expect(page.getByLabel('페이지 제목')).toBeVisible()
  await page.getByLabel('페이지 제목').fill('가고 싶은 곳')

  await page.getByRole('link', { name: '지도' }).click()
  await page.getByRole('button', { name: /첫 장소 추가/ }).click()
  await page.getByRole('button', { name: /Google Maps 링크 붙여넣기/ }).click()
  await page.getByPlaceholder(/https:\/\/maps.app.goo.gl/).fill('https://www.google.com/maps/place/Old+Montreal/@45.5075,-73.5540,16z')
  await page.getByRole('button', { name: '위치 확인' }).click()
  await page.getByLabel(/시작 시간/).fill('10:30')
  await page.getByRole('button', { name: '추가', exact: true }).click()
  await page.getByRole('button', { name: /LIST/ }).click()
  await expect(page.getByText('Old Montreal')).toBeVisible()

  await page.getByRole('button', { name: /MAP/ }).click()
  await page.locator('.map-fab').click()
  await page.getByRole('button', { name: /지도에 직접 핀/ }).click()
  await page.locator('.maplibregl-canvas').click({ position: { x: 190, y: 300 } })
  await page.getByRole('button', { name: '이 위치 저장' }).click()
  await page.getByLabel('장소 이름').fill('강변 산책 포인트')
  await page.getByRole('button', { name: '추가', exact: true }).click()
  await page.getByRole('button', { name: /LIST/ }).click()
  await expect(page.getByText('강변 산책 포인트')).toBeVisible()

  await page.getByRole('link', { name: '채팅' }).click()
  await page.getByPlaceholder('메시지...').fill('여기서 만나자!')
  await page.getByRole('button', { name: '전송' }).click()
  await expect(page.getByText('여기서 만나자!')).toBeVisible()
})

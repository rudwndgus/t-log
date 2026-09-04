import { expect, test } from '@playwright/test'

test('keeps mobile note actions visible and continues after an attachment', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    localStorage.clear()
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase('tlog-local')
      request.onsuccess = () => resolve()
      request.onerror = () => resolve()
      request.onblocked = () => resolve()
    })
  })
  await page.reload()

  await page.getByRole('link', { name: '새 여행', exact: true }).last().click()
  await page.getByLabel('여행 이름').fill('모바일 노트 테스트')
  await page.getByLabel('목적지').fill('Toronto')
  await page.getByRole('button', { name: '여행 만들기' }).click()

  const firstInput = page.getByPlaceholder('내용 입력').first()
  await firstInput.fill('/')
  await expect(page.getByRole('option').first()).toContainText('토글')

  await firstInput.fill('/file')
  const chooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('option', { name: /파일/ }).click()
  const chooser = await chooserPromise
  await chooser.setFiles({ name: 'mobile-note.txt', mimeType: 'text/plain', buffer: Buffer.from('preview me') })

  const rootBlocks = page.locator('.notion-editor > .editor-blocks > .sortable-note-block')
  await expect(rootBlocks).toHaveCount(2)
  const continuation = rootBlocks.nth(1).getByPlaceholder('내용 입력')
  await expect(continuation).toBeFocused()

  await rootBlocks.first().locator('.media-block-options').click()
  const dialog = page.getByRole('dialog', { name: '블록 옵션' })
  await expect.poll(() => dialog.evaluate((element) => element.parentElement === document.body)).toBe(true)
  const deleteButton = dialog.getByRole('button', { name: '삭제' })
  await expect(deleteButton).toBeVisible()
  await page.waitForTimeout(300)
  const deleteBox = await deleteButton.boundingBox()
  expect(deleteBox && deleteBox.y + deleteBox.height).toBeLessThanOrEqual(844)

  await dialog.getByRole('button', { name: '아래로 이동' }).click()
  await expect(rootBlocks.nth(1).locator('.media-editable-block')).toBeVisible()

  await page.getByRole('link', { name: '채팅' }).click()
  await page.getByPlaceholder('메시지...').focus()
  await expect(page.getByRole('navigation', { name: '여행 메뉴' })).toBeHidden()
})

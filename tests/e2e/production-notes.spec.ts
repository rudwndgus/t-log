import { chromium, expect, test, webkit, type Page } from '@playwright/test'

const productionUrl = 'https://rudwndgus.github.io/t-log/'
const edgePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const password = 'TLog-note-E2E-2026!'
const unique = Date.now()
const account = { name: `Note E2E ${unique}`, email: `tlog.note.${unique}@example.com` }
const tripName = `Attachment Proof ${unique}`

async function signUp(page: Page) {
  await page.goto(`${productionUrl}?proof=${unique}#/`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('link', { name: /클라우드에 연결하기/ }).click()
  await page.getByRole('button', { name: '회원가입' }).click()
  await page.getByLabel('이름').fill(account.name)
  await page.getByLabel('이메일').fill(account.email)
  await page.getByLabel('비밀번호').fill(password)
  await page.locator('form').getByRole('button', { name: '계정 만들기' }).click()
  await expect(page).toHaveURL(/#\/$/, { timeout: 30_000 })
}

async function signIn(page: Page) {
  await page.goto(`${productionUrl}?proof=${unique}#/`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('link', { name: /클라우드에 연결하기/ }).click()
  await page.getByLabel('이메일').fill(account.email)
  await page.getByLabel('비밀번호').fill(password)
  await page.locator('form').getByRole('button', { name: '로그인' }).click()
  await expect(page).toHaveURL(/#\/$/, { timeout: 30_000 })
}

test('production attachment survives reload and previews in isolated WebKit', async () => {
  const edge = await chromium.launch({ headless: true, executablePath: edgePath })
  const safari = await webkit.launch({ headless: true })
  const edgeContext = await edge.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })
  const webkitContext = await safari.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })
  try {
    const owner = await edgeContext.newPage()
    await signUp(owner)
    await owner.getByRole('link', { name: '새 여행', exact: true }).last().click()
    await owner.getByLabel('여행 이름').fill(tripName)
    await owner.getByLabel('목적지').fill('Toronto')
    await owner.getByRole('button', { name: '여행 만들기' }).click()

    const rootInput = owner.getByPlaceholder('내용 입력').first()
    await rootInput.fill('/')
    await expect(owner.getByRole('option').first()).toContainText('토글')
    await rootInput.fill('/toggle')
    await owner.getByRole('option', { name: /토글/ }).click()
    await owner.getByRole('button', { name: '토글 펼치기' }).click()

    const nestedInput = owner.locator('.editor-blocks--nested').getByPlaceholder('내용 입력')
    await nestedInput.fill('/file')
    const chooserPromise = owner.waitForEvent('filechooser')
    await owner.getByRole('option', { name: /파일/ }).click()
    const chooser = await chooserPromise
    await chooser.setFiles({ name: 'firestore-preview.txt', mimeType: 'text/plain', buffer: Buffer.from('T Log Firestore preview proof') })

    const previewButton = owner.getByRole('button', { name: '미리보기' })
    await expect(previewButton).toBeVisible({ timeout: 30_000 })
    await expect(owner.locator('.editor-blocks--nested').getByPlaceholder('내용 입력')).toBeFocused()
    await previewButton.click()
    await expect(owner.getByRole('dialog', { name: 'firestore-preview.txt 미리보기' })).toContainText('T Log Firestore preview proof')
    await owner.getByRole('button', { name: '닫기' }).click()

    await owner.locator('.media-block-options').click()
    const actionDialog = owner.getByRole('dialog', { name: '블록 옵션' })
    await expect(actionDialog.getByRole('button', { name: '삭제' })).toBeVisible()
    await owner.waitForTimeout(300)
    const deleteBox = await actionDialog.getByRole('button', { name: '삭제' }).boundingBox()
    expect(deleteBox && deleteBox.y + deleteBox.height).toBeLessThanOrEqual(844)
    await actionDialog.getByRole('button', { name: '아래로 이동' }).click()

    await owner.reload({ waitUntil: 'domcontentloaded' })
    await expect(owner.getByText('firestore-preview.txt')).toBeVisible({ timeout: 30_000 })

    const isolated = await webkitContext.newPage()
    await signIn(isolated)
    await isolated.getByText(tripName).click()
    await expect(isolated.getByText('firestore-preview.txt')).toBeVisible({ timeout: 30_000 })
    await isolated.getByRole('button', { name: '미리보기' }).click()
    await expect(isolated.getByRole('dialog', { name: 'firestore-preview.txt 미리보기' })).toContainText('T Log Firestore preview proof')
  } finally {
    await Promise.allSettled([edgeContext.close(), webkitContext.close(), edge.close(), safari.close()])
  }
})

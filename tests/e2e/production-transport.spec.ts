import { chromium, expect, test, webkit, type Page } from '@playwright/test'

const productionUrl = 'https://rudwndgus.github.io/t-log/'
const edgePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const password = 'TLog-transport-E2E-2026!'
const unique = Date.now()
const account = { name: `Transport E2E ${unique}`, email: `tlog.transport.${unique}@example.com` }
const tripName = `Transport Proof ${unique}`

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

async function addGooglePlace(page: Page, url: string, name: string, first = false) {
  if (first) await page.getByRole('button', { name: '첫 장소 추가' }).click()
  else await page.locator('.map-fab').click()
  await page.getByRole('button', { name: /Google Maps 링크 붙여넣기/ }).click()
  await page.getByLabel('Google Maps URL').fill(url)
  await page.getByRole('button', { name: '위치 확인' }).click()
  await page.getByLabel('장소 이름').fill(name)
  await page.getByRole('button', { name: '추가', exact: true }).click()
}

test('production transport icon and duration survive reload and appear in isolated WebKit', async () => {
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
    await owner.getByRole('link', { name: '지도' }).click()

    await addGooglePlace(owner, 'https://www.google.com/maps/place/CN+Tower/@43.6425662,-79.3892455,17z', 'CN Tower', true)
    await addGooglePlace(owner, 'https://www.google.com/maps/place/Union+Station/@43.645319,-79.380407,17z', 'Union Station')
    await owner.getByRole('button', { name: /LIST/ }).click()
    await owner.getByRole('button', { name: '이동 정보 추가' }).click()
    await owner.getByRole('button', { name: '버스' }).click()
    await owner.getByLabel('소요 시간 · 분').fill('42')
    await owner.getByRole('button', { name: '저장' }).click()
    await expect(owner.getByRole('button', { name: '이동 정보 수정 · 42분' })).toBeVisible()

    await owner.reload({ waitUntil: 'domcontentloaded' })
    await expect(owner.getByRole('button', { name: '이동 정보 수정 · 42분' })).toBeVisible()

    const isolated = await webkitContext.newPage()
    await signIn(isolated)
    await isolated.getByText(tripName).click()
    await isolated.getByRole('link', { name: '지도' }).click()
    await isolated.getByRole('button', { name: /LIST/ }).click()
    const transport = isolated.getByRole('button', { name: '이동 정보 수정 · 42분' })
    await expect(transport).toBeVisible({ timeout: 30_000 })
    await expect(transport.locator('.lucide-bus-front')).toBeVisible()
  } finally {
    await Promise.allSettled([edgeContext.close(), webkitContext.close(), edge.close(), safari.close()])
  }
})

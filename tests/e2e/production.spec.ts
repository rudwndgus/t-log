import { expect, firefox, test, webkit, type BrowserContext, type Page } from '@playwright/test'
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'

const productionUrl = 'https://rudwndgus.github.io/t-log/'
const password = 'TLog-prod-E2E-2026!'
const edgePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'

const unique = Date.now()
const accountA = { name: `E2E Owner ${unique}`, email: `tlog.owner.${unique}@example.com` }
const accountB = { name: `E2E Member ${unique}`, email: `tlog.member.${unique}@example.com` }
const tripName = `Production Room ${unique}`
const privateTripName = `Owner Only ${unique}`
const noteTitle = `Realtime Note ${unique}`
const chatText = `hello from Edge ${unique}`
const proposalTitle = `Realtime Vote ${unique}`
const pinName = `Manual Pin ${unique}`
const googlePlaceName = `CN Tower ${unique}`

function watch(page: Page, engine: string, errors: string[]) {
  page.on('pageerror', (error) => errors.push(`${engine}:pageerror:${error.message}`))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(`${engine}:console:${message.text()}`) })
}

async function signUp(page: Page, account: { name: string; email: string }) {
  await page.goto(productionUrl, { waitUntil: 'domcontentloaded' })
  await page.getByRole('link', { name: /클라우드에 연결하기/ }).click()
  await page.getByRole('button', { name: '회원가입' }).click()
  await page.getByLabel('이름').fill(account.name)
  await page.getByLabel('이메일').fill(account.email)
  await page.getByLabel('비밀번호').fill(password)
  await page.locator('form').getByRole('button', { name: '계정 만들기' }).click()
  await expect(page).toHaveURL(/#\/$/, { timeout: 30_000 })
  await expect(page.getByRole('heading', { name: 'T Log' })).toBeVisible()
}

async function signIn(page: Page, email: string) {
  await page.goto(productionUrl, { waitUntil: 'domcontentloaded' })
  const cloudLink = page.getByRole('link', { name: /클라우드에 연결하기/ })
  if (await cloudLink.isVisible()) await cloudLink.click()
  if (page.url().includes('/auth')) {
    await page.getByLabel('이메일').fill(email)
    await page.getByLabel('비밀번호').fill(password)
    await page.locator('form').getByRole('button', { name: '로그인' }).click()
    await expect(page).toHaveURL(/#\/$/, { timeout: 20_000 })
    await expect(page.getByRole('heading', { name: 'T Log' })).toBeVisible()
  }
}

async function createTrip(page: Page, name: string) {
  await page.getByRole('link', { name: '새 여행', exact: true }).last().click()
  await page.getByLabel('여행 이름').fill(name)
  await page.getByLabel('목적지').fill('Toronto')
  await page.getByRole('button', { name: '여행 만들기' }).click()
  await expect(page).toHaveURL(/#\/trip\/[^/]+\/note$/, { timeout: 30_000 })
  return page.url().match(/#\/trip\/([^/]+)/)?.[1] || ''
}

async function readInviteCode(page: Page) {
  await page.locator('.member-button').click()
  const code = (await page.locator('.invite-panel strong').innerText()).trim()
  await page.getByRole('dialog', { name: '멤버' }).locator('.sheet-header').getByRole('button', { name: '닫기' }).click()
  return code
}

function firebaseApiKey() {
  const env = readFileSync('.env.local', 'utf8')
  return env.match(/^VITE_FIREBASE_API_KEY=(.+)$/m)?.[1].trim() || ''
}

async function firebaseSession(email: string) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey()}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true })
  })
  if (!response.ok) throw new Error(`Firebase sign-in failed: ${response.status} ${await response.text()}`)
  return response.json() as Promise<{ idToken: string; localId: string }>
}

async function expectFirestoreDocument(path: string, token: string) {
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/tlog-8833f/databases/(default)/documents/${path}`, { headers: { authorization: `Bearer ${token}` } })
  expect(response.status, `${path}: ${await response.text()}`).toBe(200)
}

async function swipeTrip(page: Page, trip: string, direction: 'left' | 'right') {
  const row = page.locator('.trip-swipe').filter({ hasText: trip })
  const content = row.locator('.trip-swipe__content'); const box = await content.boundingBox()
  if (!box) throw new Error(`Trip swipe row not visible: ${trip}`)
  const startX = box.x + box.width / 2; const y = box.y + box.height / 2
  await page.mouse.move(startX, y); await page.mouse.down(); await page.mouse.move(startX + (direction === 'right' ? 90 : -90), y, { steps: 8 }); await page.mouse.up()
  return row
}

test('production survives reload and synchronizes across Edge, Firefox, and WebKit', async ({ browserName }, testInfo) => {
  const errors: string[] = []
  const edge = await chromium.launch({ headless: true, executablePath: edgePath })
  const gecko = await firefox.launch({ headless: true })
  const safari = await webkit.launch({ headless: true })
  const contexts: BrowserContext[] = []
  try {
    const edgeA = await edge.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); contexts.push(edgeA)
    const pageA = await edgeA.newPage(); watch(pageA, 'edge', errors)
    await signUp(pageA, accountA)
    const tripId = await createTrip(pageA, tripName)
    const inviteCode = await readInviteCode(pageA)

    await pageA.reload({ waitUntil: 'domcontentloaded' })
    await expect(pageA.getByText(tripName)).toBeVisible()

    const firefoxSameAccount = await gecko.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); contexts.push(firefoxSameAccount)
    const pageSameAccount = await firefoxSameAccount.newPage(); watch(pageSameAccount, 'firefox', errors)
    await signIn(pageSameAccount, accountA.email)
    await expect(pageSameAccount.getByText(tripName)).toBeVisible()
    await createTrip(pageSameAccount, privateTripName)

    const webkitB = await safari.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); contexts.push(webkitB)
    const pageB = await webkitB.newPage(); watch(pageB, 'webkit', errors)
    await signUp(pageB, accountB)
    await pageB.getByRole('link', { name: /초대 코드가 있나요/ }).click()
    await pageB.getByLabel('초대 코드').fill(inviteCode)
    await pageB.getByRole('button', { name: '여행 참여하기' }).click()
    await expect(pageB).toHaveURL(new RegExp(`#/trip/${tripId}/note$`))
    await expect(pageB.getByText(tripName)).toBeVisible()
    await pageB.getByRole('link', { name: '여행 목록' }).click()
    await expect(pageB.getByText(tripName)).toBeVisible()
    await expect(pageB.getByText(privateTripName)).toHaveCount(0)
    await pageB.getByText(tripName).click()

    await pageA.goto(`${productionUrl}#/trip/${tripId}/note`)
    await pageA.locator('.member-button').click()
    await expect(pageA.getByText(accountB.name)).toBeVisible()
    await pageA.getByRole('dialog', { name: '멤버' }).locator('.sheet-header').getByRole('button', { name: '닫기' }).click()

    await pageB.getByRole('button', { name: /첫 페이지 만들기/ }).click()
    await pageB.getByLabel('페이지 제목').fill(noteTitle)
    await pageA.goto(`${productionUrl}#/trip/${tripId}/note`)
    await expect(pageA.getByText(noteTitle)).toBeVisible({ timeout: 8_000 })

    await pageA.getByRole('link', { name: '채팅' }).click()
    await pageB.getByRole('link', { name: '채팅' }).click()
    await pageA.getByPlaceholder('메시지...').fill(chatText)
    await pageA.getByRole('button', { name: '전송' }).click()
    await expect(pageB.getByText(chatText)).toBeVisible()

    await pageA.getByRole('button', { name: '제안 만들기' }).click()
    await pageA.getByLabel('제안 제목').fill(proposalTitle)
    await pageA.getByRole('button', { name: '채팅에 보내기' }).click()
    await expect(pageB.getByText(proposalTitle)).toBeVisible()
    const proposalB = pageB.locator('.proposal-card').filter({ hasText: proposalTitle })
    await proposalB.getByRole('button', { name: /좋아요/ }).click()
    const proposalA = pageA.locator('.proposal-card').filter({ hasText: proposalTitle })
    await expect(proposalA.getByRole('button', { name: /좋아요/ }).locator('em')).toHaveText('1')

    await pageA.getByRole('link', { name: '지도' }).click()
    await pageB.getByRole('link', { name: '지도' }).click()
    await expect(pageA.locator('.map-canvas[data-map-loaded="true"]')).toBeVisible({ timeout: 15_000 })
    await expect(pageB.locator('.map-canvas[data-map-loaded="true"]')).toBeVisible({ timeout: 15_000 })
    await expect(pageB.locator('.maplibregl-ctrl-zoom-in')).toBeVisible()
    await pageB.getByRole('button', { name: '첫 장소 추가' }).click()
    await pageB.getByRole('button', { name: /지도에 직접 핀/ }).click()
    await pageB.locator('.maplibregl-canvas').click({ position: { x: 190, y: 300 } })
    await pageB.getByRole('button', { name: '이 위치 저장' }).click()
    await pageB.getByLabel('장소 이름').fill(pinName)
    await pageB.getByRole('button', { name: '추가', exact: true }).click()
    await pageA.getByRole('button', { name: /LIST/ }).click()
    await expect(pageA.getByText(pinName)).toBeVisible()

    await pageA.getByRole('button', { name: /MAP/ }).click()
    await pageA.locator('.map-fab').click()
    await pageA.getByRole('button', { name: /Google Maps 링크 붙여넣기/ }).click()
    await pageA.getByPlaceholder(/https:\/\/www.google.com\/maps/).fill('https://www.google.com/maps/place/CN+Tower/@43.6425662,-79.3892455,17z')
    await pageA.getByRole('button', { name: '좌표 찾기' }).click()
    await pageA.getByLabel('장소 이름').fill(googlePlaceName)
    await pageA.getByRole('button', { name: '추가', exact: true }).click()
    await pageB.getByRole('button', { name: /LIST/ }).click()
    await expect(pageB.getByText(googlePlaceName)).toBeVisible()

    await pageB.reload({ waitUntil: 'domcontentloaded' })
    await expect(pageB.getByText(pinName)).toBeVisible()
    await expect(pageB.getByText(googlePlaceName)).toBeVisible()
    await pageB.getByRole('button', { name: /MAP/ }).click()
    await expect(pageB.locator('.map-marker')).toHaveCount(2)
    await expect(pageB.locator('.map-canvas')).toHaveAttribute('data-route-point-count', '2')

    await pageB.locator('.map-fab').click()
    await pageB.getByRole('button', { name: /Google Maps 링크 붙여넣기/ }).click()
    await pageB.getByPlaceholder(/https:\/\/www.google.com\/maps/).fill('https://maps.app.goo.gl/6zP7Example')
    await pageB.getByRole('button', { name: '좌표 찾기' }).click()
    await expect(pageB.getByText(/짧은 링크는 브라우저 제한으로 읽지 못했어요/)).toBeVisible()

    const ownerSession = await firebaseSession(accountA.email)
    const memberSession = await firebaseSession(accountB.email)
    await expectFirestoreDocument(`users/${ownerSession.localId}`, ownerSession.idToken)
    await expectFirestoreDocument(`users/${memberSession.localId}`, memberSession.idToken)
    await expectFirestoreDocument(`trips/${tripId}`, ownerSession.idToken)
    await expectFirestoreDocument(`trips/${tripId}/members/${ownerSession.localId}`, ownerSession.idToken)
    await expectFirestoreDocument(`trips/${tripId}/members/${memberSession.localId}`, memberSession.idToken)
    await expectFirestoreDocument(`inviteCodes/${inviteCode}`, ownerSession.idToken)

    await pageA.goto(productionUrl)
    const sharedRow = await swipeTrip(pageA, tripName, 'right')
    await sharedRow.getByRole('button', { name: `${tripName} 일정 공유` }).click()
    const shareInput = pageA.getByLabel('읽기 전용 공개 링크')
    await expect(shareInput).toBeVisible({ timeout: 15_000 })
    const publicUrl = await shareInput.inputValue()
    expect(publicUrl).toContain('#/shared/')

    const publicContext = await gecko.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); contexts.push(publicContext)
    const publicPage = await publicContext.newPage(); watch(publicPage, 'firefox-public', errors)
    await publicPage.goto(publicUrl, { waitUntil: 'domcontentloaded' })
    await expect(publicPage.getByText(tripName)).toBeVisible()
    await expect(publicPage.locator('.map-canvas[data-map-loaded="true"]')).toBeVisible({ timeout: 15_000 })
    await publicPage.getByRole('button', { name: /LIST/ }).click()
    await expect(publicPage.getByText(pinName)).toBeVisible()
    await expect(publicPage.getByText(googlePlaceName)).toBeVisible()
    await expect(publicPage.getByRole('link', { name: '채팅' })).toHaveCount(0)
    await expect(publicPage.getByText('초대 코드')).toHaveCount(0)

    await pageSameAccount.goto(productionUrl)
    const deleteRow = await swipeTrip(pageSameAccount, privateTripName, 'left')
    await deleteRow.getByRole('button', { name: `${privateTripName} 삭제` }).click()
    await pageSameAccount.getByRole('dialog', { name: '여행 삭제' }).getByRole('button', { name: '여행 삭제' }).click()
    await expect(pageSameAccount.getByText(privateTripName)).toHaveCount(0)
    await pageSameAccount.reload({ waitUntil: 'domcontentloaded' })
    await expect(pageSameAccount.getByText(privateTripName)).toHaveCount(0)

    await pageB.goto(productionUrl)
    await pageB.getByRole('button', { name: '프로필' }).click()
    await pageB.getByRole('dialog', { name: '내 프로필' }).getByRole('button', { name: '로그아웃' }).click()
    await expect(pageB.getByRole('link', { name: /클라우드에 연결하기/ })).toBeVisible()

    await testInfo.attach('edge-owner.png', { body: await pageA.screenshot(), contentType: 'image/png' })
    await testInfo.attach('webkit-member.png', { body: await pageB.screenshot(), contentType: 'image/png' })
    await testInfo.attach('production-proof.json', { body: Buffer.from(JSON.stringify({ tripId, inviteCode, publicUrl, runnerBrowserName: browserName, engines: ['Edge/Chromium', 'Firefox/Gecko', 'WebKit'], accountA: accountA.email, accountB: accountB.email, verifiedAt: new Date().toISOString() }, null, 2)), contentType: 'application/json' })
    expect(errors.filter((entry) => !entry.includes('favicon'))).toEqual([])
  } finally {
    const cleanup = Promise.allSettled([
      ...contexts.map((context) => context.close()), edge.close(), gecko.close(), safari.close()
    ])
    await Promise.race([cleanup, new Promise((resolve) => setTimeout(resolve, 5_000))])
  }
})

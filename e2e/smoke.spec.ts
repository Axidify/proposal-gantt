import { expect, test, type Page } from '@playwright/test'

async function gridRowCount(page: Page): Promise<number> {
  return page.locator('[role="grid"] [role="row"]').filter({ hasNotText: 'Resize' }).count()
}

async function gridIncludesTask(page: Page, name: string): Promise<boolean> {
  return page.getByRole('row', { name: new RegExp(name, 'i') }).count().then((n) => n > 0)
}

test.describe('Proposal Gantt smoke', () => {
  test('welcome → editor → add row → link mode → dependency', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: /New proposal/i }).click()
    await expect(page.getByRole('heading', { name: 'Untitled Proposal' })).toBeVisible()

    expect(await gridIncludesTask(page, 'Phase 1')).toBe(true)
    const beforeCount = await gridRowCount(page)

    await page.getByRole('row', { name: /Phase 1/i }).hover()
    await page.getByRole('button', { name: 'Add task to phase' }).click()

    await expect(page.getByRole('row', { name: /New Task/i })).toBeVisible()
    expect(await gridRowCount(page)).toBeGreaterThan(beforeCount)

    await page.getByRole('row', { name: /Kickoff/i }).hover()
    await page
      .getByRole('row', { name: /Kickoff/i })
      .getByRole('button', { name: 'Mark as milestone' })
      .click()
    await expect(page.getByRole('button', { name: 'Convert to task' }).first()).toBeVisible()

    await page.getByRole('button', { name: 'Start date' }).click()
    await expect(page.getByText(/Starting/i)).toBeVisible()

    await page.getByRole('button', { name: 'Link' }).click()
    await expect(page.getByRole('button', { name: 'Linking' })).toBeVisible()

    await page.getByRole('tab', { name: 'Links' }).click()
    await page.getByLabel('Predecessor').selectOption({ label: 'Kickoff' })
    await page.getByLabel('Successor').selectOption({ label: 'Go-live' })
    await page.getByRole('button', { name: 'Add FS dependency' }).click()
    await expect(page.getByText('Kickoff→Go-live')).toBeVisible()
  })

  test('template loads and save works in browser shim', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Software Implementation' }).click()
    await expect(page.getByRole('banner').getByText('Enterprise Platform Implementation')).toBeVisible()

    await page.getByRole('tab', { name: 'Links' }).click()
    await expect(page.getByText('Requirements sign-off→Solution design')).toBeVisible()
    await expect(page.getByText('Design approval→Core configuration')).toBeVisible()

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Save' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.pgantt$/i)
  })
})

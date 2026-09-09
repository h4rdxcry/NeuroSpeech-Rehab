// Read the populated local clone and exercise local practice setup without fake media.
const { chromium, expect } = require('../frontend/node_modules/@playwright/test')
const AxeBuilder = require('../frontend/node_modules/@axe-core/playwright').default
const { writeFileSync } = require('node:fs')
const { resolve } = require('node:path')
const out = resolve(__dirname, '../work/verification-20260909')
async function main() {
  const browser = await chromium.launch()
  const report = { checkedAt: new Date().toISOString(), url: 'http://127.0.0.1:5174', pages: [], failures: [], syntheticMedia: false }
  try {
    for (const role of ['patient','researcher','clinician']) {
      const context = await browser.newContext({ baseURL: report.url, viewport: { width: 1440, height: 1000 } })
      const page = await context.newPage()
      page.on('pageerror', e => report.failures.push(e.message))
      page.on('response', r => { if (r.url().includes('/api/v1/') && r.status() >= 400 && r.status() !== 404) report.failures.push(r.status() + ' ' + r.url()) })
      await page.goto('/login')
      await page.getByLabel('Email', { exact: true }).fill(role+'@neurospeech.dev')
      await page.getByLabel('Password', { exact: true }).fill('NeuroSpeechDemo123!')
      await page.getByRole('button', { name: 'Sign In', exact: true }).click()
      await expect(page).not.toHaveURL(/login/)
      const names = role === 'patient' ? ['Home','Therapy','History','Settings'] : role === 'researcher' ? ['Participants','Sessions','Datasets','Recordings','Annotations','Evaluation','Models'] : ['Patients','Sessions','Recordings','Annotations']
      for (const name of names) {
        await page.getByRole('navigation', { name: role === 'patient' ? 'Patient navigation' : role === 'researcher' ? 'Research navigation' : 'Clinician navigation' }).getByRole('link', { name, exact: true }).click()
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30000 })
        await expect(page.getByText(/^Loading/)).toHaveCount(0, { timeout: 30000 })
        if (role === 'patient' && name === 'Therapy') {
          await expect(page.getByRole('button', { name: 'Create session', exact: true }).or(page.getByLabel('Choose an exercise'))).toBeVisible()
          if (await page.getByRole('button', { name: 'Create session', exact: true }).count()) await page.getByRole('button', { name: 'Create session', exact: true }).click()
          await expect(page.getByLabel('Choose an exercise')).toBeVisible()
          if (await page.getByRole('button', { name: 'Add exercise to session' }).count()) {
            await page.getByLabel('Choose an exercise').selectOption({ label: 'Tamil phrase practice · self-paced' })
            await page.getByRole('button', { name: 'Add exercise to session' }).click()
          }
          await expect(page.locator('blockquote')).toHaveText('வணக்கம்')
          await expect(page.getByRole('button', { name: 'Start attempt', exact: true })).toBeEnabled()
          report.localPracticeSessionUrl = page.url()
        }
        if (name === 'Datasets') {
          await expect(page.getByText('View provenance and splits', { exact: true }).first()).toBeVisible()
          for (const summary of await page.getByText('View provenance and splits', { exact: true }).all()) await summary.click()
          await expect(page.getByText(/^Loading dataset details/)).toHaveCount(0, { timeout: 30000 })
          await expect(page.getByText('178 locked split records', { exact: true })).toBeVisible()
          await page.getByText('View split definition', { exact: true }).last().click()
        }
        if (name === 'Recordings') {
          await expect(page.getByText('View signal quality and predictions', { exact: true }).first()).toBeVisible()
          await page.getByText('View signal quality and predictions', { exact: true }).first().click()
          await page.getByRole('button', { name: 'View computed features', exact: true }).first().click()
          await expect(page.getByText(/^Loading/)).toHaveCount(0, { timeout: 30000 })
          const next = page.getByRole('button', { name: 'Next page', exact: true })
          if (await next.isEnabled()) {
            await next.click()
            await expect(page.getByText(/^Page 2 ·/)).toBeVisible()
            await expect(page.getByText(/^Loading/)).toHaveCount(0)
          }
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()
        report.pages.push({ role, name, url: page.url(), violations: axe.violations, passes: axe.passes.length })
        expect(axe.violations).toEqual([])
        if (role === 'patient' || name === 'Datasets') {
          await page.evaluate(() => { window.scrollTo(0,0); document.activeElement?.blur() })
          await page.screenshot({ path: resolve(out, 'live-'+role+'-'+name.toLowerCase()+'.png'), fullPage: true })
        }
      }
      await context.close()
    }
    expect(report.failures).toEqual([])
    report.status = 'passed'
  } finally {
    writeFileSync(resolve(out, 'live-site.json'), JSON.stringify(report, null, 2))
    await browser.close()
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })

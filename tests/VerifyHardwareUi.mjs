import fs from 'node:fs/promises'

const phase = process.argv[2] || 'verify'
const debugPort = Number(process.env.EZ_AI_CDP_PORT || 9453)
const baseUrl = process.env.EZ_AI_BASE_URL || 'http://127.0.0.1:62363'

async function getPageTarget() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const targets = await fetch(`http://127.0.0.1:${debugPort}/json`).then(response => response.json())
      const page = targets.find(target => target.type === 'page' && target.url.startsWith(baseUrl))
      if (page) return page
    } catch { /* Chrome is still starting. */ }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error('No EZ AI Chrome page was found on the configured DevTools port.')
}

const page = await getPageTarget()
const ws = new WebSocket(page.webSocketDebuggerUrl)
const pending = new Map()
let nextId = 1
ws.addEventListener('message', event => {
  const packet = JSON.parse(event.data)
  if (packet.method === 'Fetch.requestPaused') {
    ws.send(JSON.stringify({ id: nextId++, method: 'Fetch.failRequest', params: { requestId: packet.params.requestId, errorReason: 'Failed' } }))
    return
  }
  const resolve = pending.get(packet.id)
  if (resolve) { pending.delete(packet.id); resolve(packet) }
})
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true })
  ws.addEventListener('error', reject, { once: true })
})

function command(method, params = {}) {
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, resolve)
    ws.send(JSON.stringify({ id, method, params }))
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error(`Timed out: ${method}`)) } }, 10000)
  })
}

async function evaluate(expression, awaitPromise = false) {
  const packet = await command('Runtime.evaluate', { expression, awaitPromise, returnByValue: true })
  if (packet.result?.exceptionDetails) throw new Error(packet.result.exceptionDetails.text || 'Browser evaluation failed')
  return packet.result?.result?.value
}

async function waitFor(expression, timeout = 30000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for ${expression}`)
}

async function assert(condition, label) {
  if (!condition) throw new Error(`FAIL: ${label}`)
  console.log(`PASS: ${label}`)
}

await command('Page.enable')
await command('Runtime.enable')
if (phase === 'verify') await evaluate(`location.reload()`)
await waitFor(`Boolean(document.querySelector('[data-page]') && document.querySelector('.nav-item'))`)

if (phase === 'verify') {
  await evaluate(`Array.from(document.querySelectorAll('.nav-item')).find(button => button.textContent.trim() === 'Home')?.click()`)
  await waitFor(`document.querySelector('[data-page]')?.getAttribute('data-page') === 'HOME'`)
  const previousScan = await evaluate(`localStorage.getItem('ez-ai-hardware-scan-v1')`)
  await command('Fetch.enable', { patterns: [{ urlPattern: '*api/hardware/scan*', requestStage: 'Request' }] })
  await evaluate(`document.querySelector('.scan-wrap .btn').click()`)
  await waitFor(`Boolean(document.querySelector('.scan-error'))`)
  await command('Fetch.disable')
  await assert(await evaluate(`Boolean(document.querySelector('.scan-error'))`), 'a network failure is shown with a useful retry state')
  if (previousScan) await assert((await evaluate(`localStorage.getItem('ez-ai-hardware-scan-v1')`)) === previousScan, 'failed refresh retains the previous cached scan')
  await waitFor(`!document.querySelector('.scan-wrap .btn').disabled`)
  await evaluate(`document.querySelector('.scan-wrap .btn').click()`)
  await waitFor(`!document.querySelector('.scan-wrap .btn').disabled && Boolean(localStorage.getItem('ez-ai-hardware-scan-v1')) && !document.querySelector('.scan-error')`)
  const scanSummary = await evaluate(`JSON.parse(localStorage.getItem('ez-ai-hardware-scan-v1'))`)
  await assert(['success', 'partial'].includes(scanSummary.status), `Scan My Computer stores a real ${scanSummary.status} result`)
  await assert(Boolean(scanSummary.scannedAtUtc) && scanSummary.cpu.model, 'Hardware result includes a timestamp and CPU model')
  await waitFor(`Boolean(localStorage.getItem('ez-ai-software-discovery-v1'))`)
  const inventory = await evaluate(`JSON.parse(localStorage.getItem('ez-ai-software-discovery-v1'))`)
  await assert(['success', 'partial'].includes(inventory.status) && inventory.applications.length >= 8, 'Scan My Computer stores the real software discovery inventory')
  await assert(inventory.codingAgents.some(item => item.name === 'Codex CLI') && inventory.codingAgents.some(item => item.name === 'Codex Desktop'), 'Codex Desktop and Codex CLI are tracked separately')
  await assert(inventory.models.every(model => model.status === 'Installed'), 'My Models is backed only by positively detected local model records')

  for (const [label, expected] of [['AI Installers', 'AI INSTALLERS'], ['My Models', 'MY MODELS'], ['Knowledge', 'KNOWLEDGE'], ['Home', 'HOME']]) {
    await evaluate(`Array.from(document.querySelectorAll('.nav-item')).find(button => button.textContent.trim() === ${JSON.stringify(label)})?.click()`)
    await waitFor(`document.querySelector('[data-page]')?.getAttribute('data-page') === ${JSON.stringify(expected)}`)
    await assert(await evaluate(`document.querySelector('[data-page]').getAttribute('data-page')` ) === expected, `${label} navigation opens ${expected}`)
  }

  await evaluate(`document.querySelector('.product-main[aria-label="Open ChatGPT installer details"]').click()`)
  await waitFor(`document.querySelector('[data-page]')?.getAttribute('data-page') === 'AI INSTALLERS' && document.querySelector('.explore-focus b')?.textContent === 'ChatGPT'`)
  await assert(true, 'the AI application card opens its matching installer details')
  await evaluate(`Array.from(document.querySelectorAll('.nav-item')).find(button => button.textContent.trim() === 'Home')?.click()`)
  await waitFor(`document.querySelector('[data-page]')?.getAttribute('data-page') === 'HOME'`)
  await evaluate(`Array.from(document.querySelectorAll('.product-learn')).find(button => button.closest('.product-card')?.querySelector('b')?.textContent === 'Claude')?.click()`)
  await waitFor(`document.querySelector('[data-page]')?.getAttribute('data-page') === 'KNOWLEDGE' && document.querySelector('.learn-focus .eyebrow')?.textContent.includes('CLAUDE')`)
  await assert(await evaluate(`document.querySelector('[data-page]').getAttribute('data-page')`) === 'KNOWLEDGE', 'Learn opens the matching Knowledge guide without opening installer details')
  await evaluate(`Array.from(document.querySelectorAll('.nav-item')).find(button => button.textContent.trim() === 'Home')?.click()`)
  await waitFor(`document.querySelector('[data-page]')?.getAttribute('data-page') === 'HOME'`)

  const template = await evaluate(`(() => { const picker = document.querySelector('select[aria-label="Templates"]'); picker.value = 'Plan My Project'; picker.dispatchEvent(new Event('change', { bubbles: true })); return document.querySelector('textarea[aria-label="Prompt text"]').value; })()`)
  await assert(template.includes('thoughtful project planner') && template.includes('step-by-step build plan'), 'Plan My Project loads its full useful template')
  await command('Browser.grantPermissions', { origin: baseUrl, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] })
  await evaluate(`document.querySelector('.prompt-tools button').click()`)
  await waitFor(`document.querySelector('.prompt-footer > span')?.textContent.includes('Copied to clipboard')`)
  await assert(true, 'Copy confirms the template was written to the clipboard')

  const prompt = 'Mission 03 prompt persistence check — remain local after launcher restart.'
  await evaluate(`(() => { const area = document.querySelector('textarea[aria-label="Prompt text"]'); const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; setter.call(area, ${JSON.stringify(prompt)}); area.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('.prompt-tools button:nth-child(2)').click(); })()`)
  await waitFor(`localStorage.getItem('aerus-saved-prompt') === ${JSON.stringify(prompt)}`)
  await assert(await evaluate(`localStorage.getItem('aerus-saved-prompt')`) === prompt, 'Save Prompt writes to the isolated browser profile')
  await evaluate(`location.reload()`)
  await waitFor(`document.querySelector('textarea[aria-label="Prompt text"]')?.value === ${JSON.stringify(prompt)}`)
  await assert(true, 'prompt restores after a production-page reload')

  await evaluate(`Array.from(document.querySelectorAll('.nav-item')).find(button => button.textContent.trim() === 'AI Installers')?.click()`)
  await waitFor(`document.querySelector('[data-page]')?.getAttribute('data-page') === 'AI INSTALLERS'`)
  const installerStatusesMatch = await evaluate(`JSON.parse(localStorage.getItem('ez-ai-software-discovery-v1')).codingAgents.every(agent => { const card = Array.from(document.querySelectorAll('.installer-card')).find(item => item.querySelector('h3')?.textContent === agent.name); return card?.querySelector('.state-chip')?.textContent.trim().includes(agent.status) })`)
  await assert(installerStatusesMatch, 'AI Installers shows the same detected coding-agent statuses as Home')
  const deferredActionsDisabled = await evaluate(`Array.from(document.querySelectorAll('.installer-card .installer-bottom > button')).every(button => button.disabled && /deferred to a later phase/i.test(button.title))`)
  await assert(deferredActionsDisabled, 'installer and launch actions stay disabled with a later-phase explanation')
  for (const [width, height, expectedColumns] of [[1366,768,2],[1920,1080,3],[2560,1440,4],[3440,1440,4]]) {
    await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    await new Promise(resolve => setTimeout(resolve, 300))
    await assert(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), `${width}×${height} has no horizontal overflow`)
    const columns = await evaluate(`getComputedStyle(document.querySelector('.installer-grid')).gridTemplateColumns.trim().split(/\\s+/).length`)
    await assert(columns === expectedColumns, `${width}×${height} installer grid uses ${expectedColumns} readable columns`)
    const widthCheck = await evaluate(`Math.max(...Array.from(document.querySelectorAll('.installer-card')).map(card => card.getBoundingClientRect().width))`)
    await assert(widthCheck <= 640, `${width}×${height} installer cards stay within the width limit`)
    for (const [label, expected] of [['Home','HOME'],['AI Installers','AI INSTALLERS'],['My Models','MY MODELS'],['Knowledge','KNOWLEDGE']]) {
      await evaluate(`Array.from(document.querySelectorAll('.nav-item')).find(button => button.textContent.trim() === ${JSON.stringify(label)})?.click()`)
      await waitFor(`document.querySelector('[data-page]')?.getAttribute('data-page') === ${JSON.stringify(expected)}`)
      await assert(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), `${label} has no horizontal overflow at ${width}×${height}`)
      if ((width === 1920 || width === 3440) && ['Home','AI Installers','My Models'].includes(label)) {
        const image = await command('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false })
        const pageName = label.toLowerCase().replaceAll(' ', '-')
        await fs.writeFile(`screenshots/ez-ai-mission04-${pageName}-${width}x${height}.png`, Buffer.from(image.result.data, 'base64'))
      }
    }
    await evaluate(`Array.from(document.querySelectorAll('.nav-item')).find(button => button.textContent.trim() === 'AI Installers')?.click()`)
    await waitFor(`document.querySelector('[data-page]')?.getAttribute('data-page') === 'AI INSTALLERS'`)
  }
  console.log('Phase: verify complete. Keep Chrome open for the post-restart check.')
} else if (phase === 'postrestart') {
  await evaluate(`location.reload()`)
  await waitFor(`Boolean(document.querySelector('[data-page]') && document.querySelector('.nav-item'))`)
  await evaluate(`Array.from(document.querySelectorAll('.nav-item')).find(button => button.textContent.trim() === 'Home')?.click()`)
  await waitFor(`document.querySelector('textarea[aria-label="Prompt text"]')?.value === localStorage.getItem('aerus-saved-prompt')`)
  await assert(await evaluate(`Boolean(localStorage.getItem('ez-ai-hardware-scan-v1'))`), 'cached hardware summary persists through launcher restart')
  await assert(await evaluate(`Boolean(localStorage.getItem('ez-ai-software-discovery-v1'))`), 'cached application and model inventory persists through launcher restart')
  await assert(await evaluate(`document.querySelector('.scan-timestamp')?.textContent.includes('Cached from')`), 'restart labels the retained hardware result as cached')
  await assert(await evaluate(`localStorage.getItem('aerus-saved-prompt') === 'Mission 03 prompt persistence check — remain local after launcher restart.'`), 'saved prompt survives launcher restart')
  await evaluate(`localStorage.setItem('aerus-prompt',''); localStorage.removeItem('aerus-saved-prompt'); location.reload()`)
  await waitFor(`document.querySelector('textarea[aria-label="Prompt text"]')?.value === ''`)
  for (const [width, height] of [[3440, 1440], [1920, 1080]]) {
    await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    await new Promise(resolve => setTimeout(resolve, 300))
    await assert(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), `${width}×${height} has no horizontal overflow after launcher restart`)
    const screenshot = await command('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false })
    await fs.writeFile(`screenshots/ez-ai-mission03b-postrestart-${width}x${height}.png`, Buffer.from(screenshot.result.data, 'base64'))
  }
  console.log('Phase: postrestart complete.')
} else {
  throw new Error(`Unknown phase: ${phase}`)
}

ws.close()

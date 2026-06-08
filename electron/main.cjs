const { app, BrowserWindow, Menu, ipcMain, net } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const APP_TITLE = '\u004a\u0061\u0076\u0061 \u540e\u7aef\u9762\u8bd5\u8bad\u7ec3\u52a9\u624b'
const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com'
const DEFAULT_AI_TIMEOUT_MS = 30000
const DEFAULT_AI_RESPONSE_BUDGET_MS = 9000
const isDev = process.env.VITE_DEV_SERVER_URL

loadDotEnv()
configureProxy()

function createWindow() {
  Menu.setApplicationMenu(null)

  const window = new BrowserWindow({
    width: 1240,
    height: 760,
    minWidth: 960,
    minHeight: 620,
    title: APP_TITLE,
    backgroundColor: '#f4f1e9',
    show: false,
    frame: true,
    alwaysOnTop: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  window.once('ready-to-show', () => window.show())
  window.on('page-title-updated', (event) => {
    event.preventDefault()
    window.setTitle(APP_TITLE)
  })

  if (isDev) {
    window.loadURL(isDev)
  } else {
    window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.handle('generate-answer', async (_event, payload) => {
  const aiConfig = getAIConfig()
  const question = String(payload?.question || '').trim().slice(0, 800)
  const mode = String(payload?.mode || 'standard')
  const requestId = String(payload?.requestId || '')
  const shouldStream = Boolean(payload?.stream && requestId)
  const startedAt = Date.now()

  if (!question) {
    return { ok: false, error: '\u8bf7\u5148\u8f93\u5165\u6216\u8bc6\u522b\u4e00\u4e2a\u95ee\u9898\u3002' }
  }

  if (!aiConfig.apiKey) {
    return {
      ok: false,
      error:
        '\u672a\u914d\u7f6e DEEPSEEK_API_KEY 或 OPENAI_API_KEY\uff0c\u5df2\u4f7f\u7528\u672c\u5730\u515c\u5e95\u7b54\u6848\u3002\u914d\u7f6e\u540e\u4f1a\u751f\u6210\u66f4\u8d34\u5408\u95ee\u9898\u7684\u6807\u51c6\u7b54\u6848\u3002',
    }
  }

  let timeout

  try {
    const abortController = new AbortController()
    timeout = setTimeout(() => abortController.abort(), aiConfig.timeoutMs)
    const response = await net.fetch(buildChatCompletionsUrl(aiConfig.baseUrl), {
      method: 'POST',
      signal: abortController.signal,
      headers: {
        Authorization: `Bearer ${aiConfig.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: aiConfig.model,
        messages: [
          {
            role: 'system',
            content: '用中文直接回答 Java 面试题。极简、准确、可口述，不寒暄，不展开长篇解释。',
          },
          {
            role: 'user',
            content: buildPrompt(question, mode),
          },
        ],
        temperature: 0.2,
        max_tokens: getMaxTokens(mode),
        stream: shouldStream,
      }),
    })
    clearTimeout(timeout)

    if (!response.ok) {
      const text = await response.text()
      return { ok: false, error: `AI request failed: ${response.status} ${text.slice(0, 240)}` }
    }

    if (shouldStream) {
      const result = await readStreamedAnswer(response, _event.sender, requestId, startedAt, aiConfig.responseBudgetMs)
      return {
        ok: true,
        answer: result.text || '\u0041\u0049 \u6ca1\u6709\u8fd4\u56de\u6709\u6548\u5185\u5bb9\uff0c\u8bf7\u91cd\u8bd5\u3002',
        elapsedMs: Date.now() - startedAt,
        firstTokenMs: result.firstTokenMs,
        budgetExceeded: result.budgetExceeded,
      }
    }

    const data = await response.json()
    const text = extractChatCompletionText(data)
    return {
      ok: true,
      answer: text || '\u0041\u0049 \u6ca1\u6709\u8fd4\u56de\u6709\u6548\u5185\u5bb9\uff0c\u8bf7\u91cd\u8bd5\u3002',
      elapsedMs: Date.now() - startedAt,
    }
  } catch (error) {
    if (timeout) clearTimeout(timeout)
    const timeoutHint = error.name === 'AbortError' ? `请求超过 ${aiConfig.timeoutMs / 1000} 秒，已中止。` : ''
    return {
      ok: false,
      error: `AI request error: ${timeoutHint}${error.message}。当前地址：${buildChatCompletionsUrl(aiConfig.baseUrl)}，模型：${aiConfig.model}。如果你使用代理，请设置 DEEPSEEK_PROXY 或 HTTPS_PROXY。`,
    }
  }
})

async function readStreamedAnswer(response, webContents, requestId, startedAt, responseBudgetMs) {
  const reader = response.body?.getReader()
  if (!reader) {
    const data = await response.json()
    return { text: extractChatCompletionText(data), firstTokenMs: null, budgetExceeded: false }
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''
  let firstTokenMs = null
  let budgetExceeded = false
  const budgetTimer = setTimeout(() => {
    budgetExceeded = true
    reader.cancel().catch(() => {})
  }, responseBudgetMs)

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue

        const payload = trimmed.slice(5).trim()
        if (payload === '[DONE]') continue

        try {
          const data = JSON.parse(payload)
          const delta = extractStreamDelta(data)
          if (!delta) continue

          if (firstTokenMs === null) firstTokenMs = Date.now() - startedAt
          text += delta
          webContents.send('generate-answer-progress', {
            requestId,
            type: 'delta',
            delta,
            elapsedMs: Date.now() - startedAt,
            firstTokenMs,
          })
        } catch {
          // Ignore malformed SSE fragments; the next chunk may complete the stream frame.
        }
      }
    }
  } finally {
    clearTimeout(budgetTimer)
  }

  webContents.send('generate-answer-progress', {
    requestId,
    type: 'done',
    elapsedMs: Date.now() - startedAt,
    firstTokenMs,
    budgetExceeded,
  })

  return { text, firstTokenMs, budgetExceeded }
}

function extractStreamDelta(data) {
  return data?.choices
    ?.map((choice) => choice.delta?.content || choice.message?.content || '')
    ?.filter(Boolean)
    ?.join('')
}

function buildPrompt(question, mode) {
  const guide =
    {
      quick: '输出 120-180 字，适合 30 秒口述。',
      standard: '输出 180-260 字，只保留面试最关键说法。',
      deep: '输出 350-500 字，只补充关键原理和项目落地。',
    }[mode] || '输出 180-260 字，只保留面试最关键说法。'

  return [
    `面试题：${question}`,
    `要求：${guide}`,
    '格式：结论一句话 + 3 个要点 + 1 个追问。',
    '不要解释格式，不要输出多余铺垫。',
  ].join('\n')
}

function extractChatCompletionText(data) {
  return data?.choices
    ?.map((choice) => choice.message?.content || choice.delta?.content || '')
    ?.filter(Boolean)
    ?.join('\n')
}

function getAIConfig() {
  return {
    apiKey: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY,
    baseUrl: process.env.DEEPSEEK_BASE_URL || process.env.OPENAI_BASE_URL || DEFAULT_DEEPSEEK_BASE_URL,
    model: process.env.DEEPSEEK_MODEL || process.env.OPENAI_MODEL || 'deepseek-v4-pro',
    timeoutMs: parsePositiveInt(process.env.AI_TIMEOUT_MS, DEFAULT_AI_TIMEOUT_MS),
    responseBudgetMs: parsePositiveInt(process.env.AI_RESPONSE_BUDGET_MS, DEFAULT_AI_RESPONSE_BUDGET_MS),
  }
}

function getMaxTokens(mode) {
  return {
    quick: parsePositiveInt(process.env.AI_QUICK_MAX_TOKENS, 180),
    standard: parsePositiveInt(process.env.AI_STANDARD_MAX_TOKENS, 300),
    deep: parsePositiveInt(process.env.AI_DEEP_MAX_TOKENS, 650),
  }[mode] || parsePositiveInt(process.env.AI_STANDARD_MAX_TOKENS, 300)
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function buildChatCompletionsUrl(baseUrl) {
  const normalized = String(baseUrl || DEFAULT_DEEPSEEK_BASE_URL).replace(/\/+$/, '')
  return normalized.endsWith('/v1') ? `${normalized}/chat/completions` : `${normalized}/v1/chat/completions`
}

function configureProxy() {
  const proxy = process.env.DEEPSEEK_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY
  if (proxy) app.commandLine.appendSwitch('proxy-server', proxy)
}

function loadDotEnv() {
  const envPath = path.join(__dirname, '..', '.env')
  if (!fs.existsSync(envPath)) return

  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separator = trimmed.indexOf('=')
    if (separator === -1) continue

    const key = trimmed.slice(0, separator).trim()
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, '')
    if (key && !process.env[key]) process.env[key] = value
  }
}

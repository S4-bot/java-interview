const { app, BrowserWindow, Menu, ipcMain } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const APP_TITLE = '\u004a\u0061\u0076\u0061 \u540e\u7aef\u9762\u8bd5\u8bad\u7ec3\u52a9\u624b'
const isDev = process.env.VITE_DEV_SERVER_URL

loadDotEnv()

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
  const apiKey = process.env.OPENAI_API_KEY
  const question = String(payload?.question || '').trim()
  const mode = String(payload?.mode || 'standard')

  if (!question) {
    return { ok: false, error: '\u8bf7\u5148\u8f93\u5165\u6216\u8bc6\u522b\u4e00\u4e2a\u95ee\u9898\u3002' }
  }

  if (!apiKey) {
    return {
      ok: false,
      error:
        '\u672a\u914d\u7f6e OPENAI_API_KEY\uff0c\u5df2\u4f7f\u7528\u672c\u5730\u515c\u5e95\u7b54\u6848\u3002\u914d\u7f6e\u540e\u4f1a\u751f\u6210\u66f4\u8d34\u5408\u95ee\u9898\u7684\u6807\u51c6\u7b54\u6848\u3002',
    }
  }

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        input: [
          {
            role: 'system',
            content:
              '\u4f60\u662f Java \u540e\u7aef\u9762\u8bd5\u8bad\u7ec3\u6559\u7ec3\u3002\u53ea\u670d\u52a1\u4e8e\u6a21\u62df\u7ec3\u4e60\u3001\u590d\u76d8\u548c\u5b66\u4e60\u573a\u666f\u3002\u8bf7\u7528\u4e2d\u6587\u7ed9\u51fa\u51c6\u786e\u3001\u7ed3\u6784\u5316\u3001\u53ef\u53e3\u8ff0\u7684\u53c2\u8003\u7b54\u6848\u3002',
          },
          {
            role: 'user',
            content: buildPrompt(question, mode),
          },
        ],
        temperature: 0.35,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      return { ok: false, error: `AI request failed: ${response.status} ${text.slice(0, 240)}` }
    }

    const data = await response.json()
    const text = extractResponseText(data)
    return { ok: true, answer: text || '\u0041\u0049 \u6ca1\u6709\u8fd4\u56de\u6709\u6548\u5185\u5bb9\uff0c\u8bf7\u91cd\u8bd5\u3002' }
  } catch (error) {
    return { ok: false, error: `AI request error: ${error.message}` }
  }
})

function buildPrompt(question, mode) {
  const lengthGuide =
    {
      quick: '\u63a7\u5236\u5728 30 \u79d2\u53e3\u8ff0\u957f\u5ea6\uff0c\u77ed\u800c\u51c6\u3002',
      standard: '\u63a7\u5236\u5728 2 \u5206\u949f\u53e3\u8ff0\u957f\u5ea6\uff0c\u7ed3\u6784\u5b8c\u6574\u3002',
      deep: '\u7ed9\u6df1\u5165\u7248\u7b54\u6848\uff0c\u5305\u542b\u539f\u7406\u3001\u5de5\u7a0b\u573a\u666f\u3001\u98ce\u9669\u53d6\u820d\u3001\u8ffd\u95ee\u65b9\u5411\u3002',
    }[mode] || '\u63a7\u5236\u5728 2 \u5206\u949f\u53e3\u8ff0\u957f\u5ea6\uff0c\u7ed3\u6784\u5b8c\u6574\u3002'

  return [
    `\u9762\u8bd5\u7ec3\u4e60\u95ee\u9898\uff1a${question}`,
    `\u7b54\u6848\u8981\u6c42\uff1a${lengthGuide}`,
    '\u8bf7\u6309\u4ee5\u4e0b\u683c\u5f0f\u8f93\u51fa\uff1a',
    '1. \u5f00\u573a\u603b\u8ff0',
    '2. \u6838\u5fc3\u539f\u7406/\u673a\u5236',
    '3. \u9879\u76ee\u843d\u5730\u8bf4\u6cd5',
    '4. \u5e38\u89c1\u8ffd\u95ee\u548c\u56de\u7b54\u8981\u70b9',
    '5. \u5bb9\u6613\u6263\u5206\u7684\u5751',
  ].join('\n')
}

function extractResponseText(data) {
  if (typeof data?.output_text === 'string') return data.output_text

  return data?.output
    ?.flatMap((item) => item.content || [])
    ?.map((content) => content.text || '')
    ?.filter(Boolean)
    ?.join('\n')
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

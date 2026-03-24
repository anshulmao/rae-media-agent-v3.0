require('dotenv').config()
const express = require('express')
const cors = require('cors')
const multer = require('multer')
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs')
const { join } = require('path')
const { v4: uuidv4 } = require('uuid')
const { GoogleGenerativeAI } = require('@google/generative-ai')

const app = express()
const PORT = process.env.PORT || 3001

// ── Gemini Setup ──────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// ── CORS ──────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:4173',
  process.env.FRONTEND_URL,
].filter(Boolean)

app.use(cors({
  origin: function (origin, cb) {
    if (!origin || allowedOrigins.some(function (o) { return origin.startsWith(o) })) {
      return cb(null, true)
    }
    cb(new Error('Not allowed by CORS'))
  },
  credentials: true
}))

app.use(express.json({ limit: '10mb' }))

// ── File upload ───────────────────────────────────────────────
const uploadsDir = join(__dirname, 'uploads')
if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true })

const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, uploadsDir) },
  filename: function (req, file, cb) { cb(null, Date.now() + '-' + file.originalname) }
})
const upload = multer({ storage: storage, limits: { fileSize: 10 * 1024 * 1024 } })

// ── JSON file helpers ─────────────────────────────────────────
const dataDir = join(__dirname, 'data')
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })

function readJSON(filename) {
  const fp = join(dataDir, filename)
  if (!existsSync(fp)) return []
  try { return JSON.parse(readFileSync(fp, 'utf8')) } catch (e) { return [] }
}

function writeJSON(filename, data) {
  writeFileSync(join(dataDir, filename), JSON.stringify(data, null, 2))
}

// ── Gemini helpers ────────────────────────────────────────────
function getModel(modelId) {
  // Map frontend model IDs to actual Gemini model names
  const modelMap = {
    'gemini-3-flash-preview': 'gemini-1.5-flash',
    'gemini-3-pro-preview': 'gemini-1.5-pro',
    'gemini-3-pro-image-preview': 'gemini-1.5-pro',
  }
  return modelMap[modelId] || 'gemini-1.5-flash'
}

function buildSystemPrompt(templates) {
  const allTemplates = readJSON('templates.json')
  const globalTemplates = allTemplates.filter(function (t) { return t.isGlobal && t.prompt })
  const linkedTemplates = templates
    ? allTemplates.filter(function (t) { return templates.includes(t.id) && t.prompt })
    : []
  // Deduplicate
  const seen = {}
  const combined = []
  globalTemplates.concat(linkedTemplates).forEach(function (t) {
    if (!seen[t.id]) { seen[t.id] = true; combined.push(t) }
  })
  if (combined.length === 0) return ''
  return combined.map(function (t) { return '[' + t.name + ']\n' + t.prompt }).join('\n\n---\n\n')
}

// ── ROUTES ────────────────────────────────────────────────────

// Health check
app.get('/api/health', function (req, res) {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ── Templates ─────────────────────────────────────────────────
app.get('/api/templates', function (req, res) {
  res.json(readJSON('templates.json'))
})

app.post('/api/templates', function (req, res) {
  const templates = readJSON('templates.json')
  const payload = req.body
  const existing = templates.findIndex(function (t) { return t.id === payload.id })
  if (existing >= 0) {
    templates[existing] = Object.assign({}, templates[existing], payload)
  } else {
    templates.push(Object.assign({}, payload, { id: payload.id || ('tpl_' + uuidv4()) }))
  }
  writeJSON('templates.json', templates)
  res.json({ success: true })
})

app.delete('/api/templates/:id', function (req, res) {
  const templates = readJSON('templates.json').filter(function (t) { return t.id !== req.params.id })
  writeJSON('templates.json', templates)
  res.json({ success: true })
})

app.post('/api/templates/:id/upload', upload.single('file'), function (req, res) {
  if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' })
  res.json({ success: true, file: req.file.filename })
})

// ── Suggested Templates ───────────────────────────────────────
app.get('/api/suggested-templates', function (req, res) {
  res.json([
    { id: 'sugg_1', name: 'Crisis Communications', description: 'Template for crisis response messaging' },
    { id: 'sugg_2', name: 'Product Launch', description: 'Announcements for new product or service launches' },
    { id: 'sugg_3', name: 'Regulatory Response', description: 'Responses to regulatory or government inquiries' },
    { id: 'sugg_4', name: 'ESG / Sustainability', description: 'Environmental and social responsibility communications' },
  ])
})

// ── Generate (text) ───────────────────────────────────────────
app.post('/api/generate', async function (req, res) {
  const channel = req.body.channel
  const language = req.body.language
  const tone = req.body.tone
  const input = req.body.input
  const agent = req.body.agent
  const model = req.body.model
  const linkedTemplates = req.body.linkedTemplates

  if (!input || !input.trim()) {
    return res.status(400).json({ success: false, error: 'Input is required' })
  }
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ success: false, error: 'GEMINI_API_KEY not configured' })
  }

  try {
    const systemPrompt = buildSystemPrompt(linkedTemplates)
    const modelName = getModel(model)
    const geminiModel = genAI.getGenerativeModel({ model: modelName })

    const channelInstructions = {
      'LinkedIn Post': 'Write a professional LinkedIn post (150-300 words). Include relevant hashtags. Use paragraph breaks for readability.',
      'WhatsApp Message': 'Write a concise WhatsApp broadcast message (under 200 words). Use simple formatting. Be direct and friendly.',
      'Press Release': 'Write a formal press release with: headline, dateline, lead paragraph with who/what/where/when/why, supporting paragraphs, boilerplate about CelcomDigi, and contact details placeholder.',
      'Internal Email': 'Write a professional internal email with: subject line, greeting, clear body paragraphs, and sign-off. Tone should be collegial and clear.',
      'Website Copy': 'Write engaging website copy with: a compelling headline, benefit-focused subheadline, body copy with clear value propositions, and a call-to-action.',
      'General': 'Write clear, professional content appropriate for the request.',
    }

    const channelGuide = channelInstructions[channel] || channelInstructions['General']
    const toneGuide = tone && tone !== 'default' ? ('Tone: ' + tone + '.') : ''
    const langGuide = language && language !== 'en'
      ? ('Write in ' + (language === 'ms' ? 'Bahasa Malaysia' : language) + '.')
      : ''

    const parts = [
      systemPrompt,
      'You are Rae, CelcomDigi\'s AI communications assistant.',
      channelGuide,
      toneGuide,
      langGuide,
      '\nUser request:\n' + input
    ].filter(Boolean)

    const fullPrompt = parts.join('\n\n')

    const result = await geminiModel.generateContent(fullPrompt)
    const text = result.response.text()

    // Log the generation
    const logs = readJSON('logs.json')
    const logId = 'log_' + uuidv4()
    logs.unshift({
      id: logId,
      timestamp: new Date().toISOString(),
      agent: agent || 'custom',
      channel: channel,
      tone: tone || 'default',
      language: language || 'en',
      input: input,
      output: text,
      model: modelName,
      type: 'text'
    })
    writeJSON('logs.json', logs.slice(0, 500)) // keep last 500

    res.json({ success: true, text: text, logId: logId })
  } catch (err) {
    console.error('Generate error:', err)
    res.status(500).json({ success: false, error: err.message || 'Generation failed' })
  }
})

// ── Generate Image (placeholder — Gemini image gen is API-gated) ──
app.post('/api/generate-image', async function (req, res) {
  const input = req.body.input
  const agent = req.body.agent

  // Imagen / Gemini image generation requires allowlisted access.
  // Return a placeholder response for now.
  const logs = readJSON('logs.json')
  const logId = 'log_' + uuidv4()
  logs.unshift({
    id: logId,
    timestamp: new Date().toISOString(),
    agent: agent || 'custom',
    input: input,
    output: 'IMAGE_GENERATED',
    type: 'image'
  })
  writeJSON('logs.json', logs.slice(0, 500))
  res.json({
    success: true,
    imageUrl: 'https://placehold.co/1200x630/001871/ffffff?text=Image+Generation+Coming+Soon',
    logId: logId
  })
})

// ── Generate QA ───────────────────────────────────────────────
app.post('/api/generate-qa', async function (req, res) {
  const items = req.body.items
  const language = req.body.language
  const tone = req.body.tone
  const model = req.body.model
  const linkedTemplates = req.body.linkedTemplates

  if (!items || !items.length) {
    return res.status(400).json({ success: false, error: 'No questions provided' })
  }
  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ success: false, error: 'GEMINI_API_KEY not configured' })
  }

  try {
    const systemPrompt = buildSystemPrompt(linkedTemplates)
    const modelName = getModel(model)
    const geminiModel = genAI.getGenerativeModel({ model: modelName })
    const toneGuide = tone && tone !== 'default' ? ('Tone: ' + tone + '.') : 'Tone: professional.'
    const langGuide = language && language !== 'en'
      ? ('Write in ' + (language === 'ms' ? 'Bahasa Malaysia' : language) + '.')
      : ''

    // Process each question
    const generatedResults = await Promise.all(items.map(async function (item) {
      const draftContext = item.draft && item.draft.trim()
        ? '\n\nThe communications team has drafted this initial response:\n"' + item.draft + '"\n\nUse this as inspiration and refine/expand it into 3 polished variations.'
        : ''

      const parts = [
        systemPrompt,
        'You are Rae, CelcomDigi\'s AI media relations assistant. Generate exactly 3 distinct response variations for the following media question.',
        toneGuide,
        langGuide,
        'Each variation should offer a meaningfully different angle, emphasis, or framing — not just minor word changes.',
        'Format your response as a JSON array with exactly 3 strings. Return ONLY the JSON array, no other text.',
        'Example format: ["Response variation 1 text here.", "Response variation 2 text here.", "Response variation 3 text here."]',
        draftContext,
        '\nMedia Question: ' + item.question
      ].filter(Boolean)

      const prompt = parts.join('\n\n')

      try {
        const result = await geminiModel.generateContent(prompt)
        let text = result.response.text().trim()

        // Parse JSON array from response
        const jsonMatch = text.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          try {
            const variations = JSON.parse(jsonMatch[0])
            if (Array.isArray(variations) && variations.length >= 1) {
              return { question: item.question, variations: variations.slice(0, 3) }
            }
          } catch (e) { /* fall through to fallback */ }
        }

        // Fallback: split by numbered lines if JSON parsing fails
        const lines = text.split(/\n+/).filter(function (l) { return l.trim() })
        const variations = lines
          .filter(function (l) { return /^["1-3\[]/.test(l.trim()) })
          .map(function (l) { return l.replace(/^["1-3\.\)]\s*/, '').replace(/^["']|["']$/g, '').trim() })
          .filter(function (v) { return v.length > 10 })
          .slice(0, 3)

        return {
          question: item.question,
          variations: variations.length >= 1 ? variations : [text.substring(0, 500)]
        }
      } catch (err) {
        console.error('QA generation error for question:', item.question, err)
        return {
          question: item.question,
          variations: ['Unable to generate response for this question. Please try again.']
        }
      }
    }))

    res.json({ success: true, results: generatedResults })
  } catch (err) {
    console.error('QA batch error:', err)
    res.status(500).json({ success: false, error: err.message || 'QA generation failed' })
  }
})

// ── Drafts ────────────────────────────────────────────────────
app.get('/api/drafts', function (req, res) {
  res.json(readJSON('drafts.json'))
})

app.post('/api/drafts', function (req, res) {
  const drafts = readJSON('drafts.json')
  const newDraft = Object.assign({}, req.body, {
    id: 'draft_' + uuidv4(),
    status: 'pending',
    createdAt: new Date().toISOString()
  })
  drafts.unshift(newDraft)
  writeJSON('drafts.json', drafts)
  res.json({ success: true, id: newDraft.id })
})

app.patch('/api/drafts/:id', function (req, res) {
  const drafts = readJSON('drafts.json')
  const idx = drafts.findIndex(function (d) { return d.id === req.params.id })
  if (idx < 0) return res.status(404).json({ success: false, error: 'Draft not found' })
  drafts[idx] = Object.assign({}, drafts[idx], req.body, { updatedAt: new Date().toISOString() })
  writeJSON('drafts.json', drafts)
  res.json({ success: true })
})

app.delete('/api/drafts/:id', function (req, res) {
  const drafts = readJSON('drafts.json').filter(function (d) { return d.id !== req.params.id })
  writeJSON('drafts.json', drafts)
  res.json({ success: true })
})

// ── Logs ──────────────────────────────────────────────────────
app.get('/api/logs', function (req, res) {
  res.json(readJSON('logs.json'))
})

app.get('/api/logs/:id', function (req, res) {
  const log = readJSON('logs.json').find(function (l) { return l.id === req.params.id })
  if (!log) return res.status(404).json({ error: 'Log not found' })
  res.json(log)
})

// ── Knowledge Base ─────────────────────────────────────────────
app.get('/api/kb', function (req, res) {
  const templates = readJSON('templates.json')
  res.json(templates.map(function (t) {
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      files: t.files || [],
      isGlobal: t.isGlobal
    }
  }))
})

// ── Start server ──────────────────────────────────────────────
app.listen(PORT, function () {
  console.log('\nRae API server running on http://localhost:' + PORT)
  console.log('   Gemini key: ' + (process.env.GEMINI_API_KEY ? 'configured' : 'MISSING — set GEMINI_API_KEY in server/.env'))
  console.log('   Data dir:   ' + dataDir + '\n')
})

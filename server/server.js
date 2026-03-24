const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3001;

// Log key status (masked for security)
const key = process.env.GEMINI_API_KEY || '';
console.log(`[Server] Gemini API Key loaded: ${key.substring(0, 4)}...${key.substring(key.length - 4)}`);

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Setup Storage
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
const generatedDir = path.join(uploadDir, 'generated');
if (!fs.existsSync(generatedDir)) {
    fs.mkdirSync(generatedDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Prefix with template id for organization
        const prefix = req.body.templateId || 'general';
        cb(null, `${prefix}__${file.originalname}`);
    }
});
const upload = multer({ storage: storage });

const DATA_FILE = path.join(__dirname, 'data.json');
const LOGS_FILE = path.join(__dirname, 'logs.json');
const DRAFTS_FILE = path.join(__dirname, 'drafts.json');

// --- Helpers ---
const readData = () => {
    if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE);
        return JSON.parse(raw);
    }
    return { templates: [], global_prompts: {}, suggested_templates: [] };
};

const writeData = (data) => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
};

const readLogs = () => {
    if (fs.existsSync(LOGS_FILE)) {
        const raw = fs.readFileSync(LOGS_FILE);
        return JSON.parse(raw);
    }
    return [];
};

const appendLog = (logEntry) => {
    const logs = readLogs();
    const logId = Date.now();
    logs.unshift({
        id: logId,
        timestamp: new Date().toISOString(),
        ...logEntry
    });
    if (logs.length > 100) logs.length = 100;
    fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2));
    return logId;
};

const readDrafts = () => {
    if (fs.existsSync(DRAFTS_FILE)) {
        const raw = fs.readFileSync(DRAFTS_FILE);
        return JSON.parse(raw);
    }
    return [];
};

const writeDrafts = (drafts) => {
    fs.writeFileSync(DRAFTS_FILE, JSON.stringify(drafts, null, 2));
};

const readFileContent = (filename) => {
    const filePath = path.join(uploadDir, filename);
    if (fs.existsSync(filePath) && (filename.endsWith('.txt') || filename.endsWith('.md'))) {
        return fs.readFileSync(filePath, 'utf-8');
    }
    return '';
};

// --- Endpoints ---

// Get all templates
app.get('/api/templates', (req, res) => {
    const data = readData();
    res.json(data.templates || []);
});

// Get single template
app.get('/api/templates/:id', (req, res) => {
    const data = readData();
    const tpl = (data.templates || []).find(t => t.id === req.params.id);
    if (tpl) res.json(tpl);
    else res.status(404).json({ error: 'Template not found' });
});

// Create or update a template
app.post('/api/templates', (req, res) => {
    const { id, name, description, prompt, files, isGlobal, assignedAgents, category } = req.body;
    const data = readData();
    const idx = data.templates.findIndex(t => t.id === id);
    const template = {
        id: id || `tpl_${Date.now()}`,
        name: name || 'Untitled Template',
        description: description || '',
        prompt: prompt || '',
        files: files || [],
        isGlobal: isGlobal ?? false,
        assignedAgents: assignedAgents || [],
        category: category || 'custom'
    };
    if (idx >= 0) {
        data.templates[idx] = template;
    } else {
        data.templates.push(template);
    }
    writeData(data);

    res.json({ success: true, template });
});

// Delete a template
app.delete('/api/templates/:id', (req, res) => {
    const data = readData();
    data.templates = data.templates.filter(t => t.id !== req.params.id);
    writeData(data);
    res.json({ success: true });
});

// Upload file to a template
app.post('/api/templates/:id/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');
    const data = readData();
    const tpl = data.templates.find(t => t.id === req.params.id);
    if (tpl) {
        if (!tpl.files) tpl.files = [];
        tpl.files.push(req.file.filename);
        writeData(data);
    }
    res.json({ success: true, file: req.file.filename });
});

// Delete file from a template
app.delete('/api/templates/:id/files/:filename', (req, res) => {
    const data = readData();
    const tpl = data.templates.find(t => t.id === req.params.id);
    if (tpl) {
        tpl.files = (tpl.files || []).filter(f => f !== req.params.filename);
        writeData(data);
    }
    const filePath = path.join(uploadDir, req.params.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ success: true });
});

// Get suggested templates
app.get('/api/suggested-templates', (req, res) => {
    const data = readData();
    res.json(data.suggested_templates || []);
});

// Get prompts/templates data (legacy compat)
app.get('/api/data', (req, res) => {
    res.json(readData());
});

// Get generation logs
app.get('/api/logs', (req, res) => {
    res.json(readLogs());
});

// Get single log by ID
app.get('/api/logs/:id', (req, res) => {
    const logs = readLogs();
    const log = logs.find(l => String(l.id) === req.params.id);
    if (log) res.json(log);
    else res.status(404).json({ error: 'Log not found' });
});

// --- Drafts ---
app.get('/api/drafts', (req, res) => {
    res.json(readDrafts());
});

app.post('/api/drafts', (req, res) => {
    const { content, agent, channel, tone, language, logId, type, imageUrl } = req.body;
    const drafts = readDrafts();
    const draft = {
        id: Date.now(),
        content: content || '',
        agent: agent || 'custom',
        channel: channel || 'General',
        tone: tone || 'default',
        language: language || 'en',
        logId: logId || null,
        type: type || 'text',
        imageUrl: imageUrl || null,
        status: 'pending',
        author: 'Alex Creator',
        createdAt: new Date().toISOString()
    };
    drafts.unshift(draft);
    writeDrafts(drafts);
    res.json({ success: true, draft });
});

app.patch('/api/drafts/:id', (req, res) => {
    const drafts = readDrafts();
    const idx = drafts.findIndex(d => String(d.id) === req.params.id);
    if (idx >= 0) {
        drafts[idx] = { ...drafts[idx], ...req.body };
        writeDrafts(drafts);
        res.json({ success: true, draft: drafts[idx] });
    } else {
        res.status(404).json({ error: 'Draft not found' });
    }
});

app.delete('/api/drafts/:id', (req, res) => {
    let drafts = readDrafts();
    drafts = drafts.filter(d => String(d.id) !== req.params.id);
    writeDrafts(drafts);
    res.json({ success: true });
});

// Get all files in KB (legacy compat - now returns all uploaded files)
app.get('/api/kb', (req, res) => {
    if (!fs.existsSync(uploadDir)) return res.json([]);
    const files = fs.readdirSync(uploadDir).map(file => {
        const stats = fs.statSync(path.join(uploadDir, file));
        return {
            name: file,
            size: `${(stats.size / 1024).toFixed(2)} KB`,
            date: stats.mtime.toLocaleDateString()
        };
    });
    res.json(files);
});

// Upload a file to KB (legacy compat)
app.post('/api/kb/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');
    res.json({ success: true, file: req.file.originalname });
});

// Delete a file from KB (legacy compat)
app.delete('/api/kb/:filename', (req, res) => {
    const filePath = path.join(uploadDir, req.params.filename);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.json({ success: true });
    } else {
        res.status(404).send('File not found');
    }
});

// Generate content via Gemini
app.post('/api/generate', async (req, res) => {
    const { channel, language, tone, input, promptInput, agent, model, linkedTemplates } = req.body;
    const modelId = model || 'gemini-2.5-flash';

    const data = readData();
    const allTemplates = data.templates || [];

    // 1. Always include global/required templates
    const globalTemplates = allTemplates.filter(t => t.isGlobal || t.category === 'required');

    // 2. Include templates assigned to the selected agent
    const agentTemplates = agent
        ? allTemplates.filter(t => !t.isGlobal && t.category !== 'required' && (t.assignedAgents || []).includes(agent))
        : [];

    // 3. Include manually linked templates
    const linkedTemplatesList = linkedTemplates && Array.isArray(linkedTemplates)
        ? allTemplates.filter(t => linkedTemplates.includes(t.id) && !globalTemplates.find(gt => gt.id === t.id) && !agentTemplates.find(at => at.id === t.id))
        : [];

    // 4. Build template context
    const usedTemplateNames = [];
    const usedKbFiles = [];
    let templateContext = '';

    for (const tpl of [...globalTemplates, ...agentTemplates, ...linkedTemplatesList]) {
        usedTemplateNames.push(tpl.name);
        templateContext += `\n--- Template: ${tpl.name} ---\n${tpl.prompt}\n`;

        // Read attached files
        for (const f of (tpl.files || [])) {
            const content = readFileContent(f);
            if (content) {
                usedKbFiles.push(f);
                templateContext += `\n--- File (${f}) ---\n${content}\n`;
            }
        }
    }

    const systemPrompt = `
${data.global_prompts?.core || ''}
${data.global_prompts?.compliance || ''}

${templateContext}

You are generating content for the following channel: ${channel}.
The requested tone is: ${tone}
The target language is: ${language}

If the user requested specific instructions in their prompt:
---
${promptInput || 'No specific instructions provided.'}
---
`;

    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: [
                { role: 'user', parts: [{ text: `Generate the content based on this input:\n\n${input}` }] }
            ],
            config: {
                systemInstruction: systemPrompt,
                temperature: 0.7,
            }
        });

        const logId = appendLog({
            channel, language, tone, agent,
            userInput: input,
            promptInput,
            systemPrompt,
            usedTemplates: usedTemplateNames,
            usedKbFiles,
            output: response.text,
            type: 'text'
        });

        res.json({ success: true, text: response.text, logId });
    } catch (error) {
        console.error('Generation Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/generate-image', async (req, res) => {
    const { input, agent, promptInput, model, linkedTemplates } = req.body;
    const modelId = model || 'gemini-3-pro-image-preview'; // nanobana default

    const data = readData();
    const allTemplates = data.templates || [];

    // Build extra context from linked templates
    let extraContext = '';
    if (linkedTemplates && Array.isArray(linkedTemplates)) {
        const selectedTemplates = allTemplates.filter(t => linkedTemplates.includes(t.id));
        for (const tpl of selectedTemplates) {
            extraContext += `\n--- Style Reference (${tpl.name}) ---\n${tpl.prompt}\n`;
            for (const f of (tpl.files || [])) {
                const content = readFileContent(f);
                if (content) extraContext += `\n--- File (${f}) ---\n${content}\n`;
            }
        }
    }

    // BRAND-LOCKING LOGIC: Wrap user input in TBA. Brand System
    const brandGuidelines = `
    AESTHETIC: Fossil Black (#0A0A0A) background, Neon Amber (#FF6B00) electric highlights.
    STYLE: High-contrast industrial lighting, macro textures, performance-driven.
    BRAND: TBA (Theropod Basketball Association).
    TAGLINE: "EVOLVED TO DOMINATE".
    `;

    const masterPrompt = `
    Create a professional premium basketball poster for the brand TBA.
    ${brandGuidelines}
    
    Context from Linked Templates:
    ${extraContext}

    User Request: ${input}
    Additional Context: ${promptInput || 'None'}
    `;

    console.log('[Image Gen] Constructing Master Brand Prompt:', masterPrompt);

    // MOCK: In a real implementation, we would call Google Imagen or DALL-E here.
    // For this MVP, we return a high-quality placeholder that matches the theme.
    try {
        // If it's Gemini 3 or Gemini 2.5 Image, use native image generation
        if (modelId.includes('gemini-3') || modelId.includes('gemini-2.5-flash-image')) {
            const response = await ai.models.generateContent({
                model: modelId,
                contents: [{ role: 'user', parts: [{ text: masterPrompt }] }],
                config: {
                    responseModalities: ['image']
                }
            });

            // Extract the generated image
            const imagePart = response.candidates[0].content.parts.find(p => p.inlineData);
            if (imagePart) {
                const base64 = imagePart.inlineData.data;
                const mimeType = imagePart.inlineData.mimeType || 'image/png';

                // Save image to disk
                const filename = `gen_${Date.now()}.png`;
                const filePath = path.join(generatedDir, filename);
                fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));

                const imageUrl = `http://localhost:${PORT}/uploads/generated/${filename}`;

                const logId = appendLog({
                    agent, userInput: input, systemPrompt: masterPrompt,
                    output: `IMAGE_GENERATED: ${filename}`,
                    imageUrl,
                    type: 'image'
                });

                return res.json({ success: true, imageUrl, logId });
            }
        }

        // MOCK/Fallback for nanobana/others if not using native flow
        const filename = 'tba_brand_mock.png'; // In a real case we would fetch and save the remote image
        const logId = appendLog({
            agent,
            userInput: input,
            systemPrompt: masterPrompt,
            output: `IMAGE_GENERATED: ${filename}`,
            imageUrl: 'https://images.unsplash.com/photo-1544919982-b61976f0ba43?q=80&w=1000&auto=format&fit=crop',
            type: 'image'
        });

        res.json({
            success: true,
            imageUrl: 'https://images.unsplash.com/photo-1544919982-b61976f0ba43?q=80&w=1000&auto=format&fit=crop',
            logId
        });
    } catch (error) {
        console.error('Image Generation Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/generate-qa', async (req, res) => {
    const { items, language, tone, model, linkedTemplates } = req.body;
    const modelId = model || 'gemini-2.5-flash';

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, error: 'No items provided.' });
    }

    const data = readData();
    const allTemplates = data.templates || [];

    // 1. Always include global/required templates
    const globalTemplates = allTemplates.filter(t => t.isGlobal || t.category === 'required');

    // 2. Include manually linked templates
    const linkedTemplatesList = linkedTemplates && Array.isArray(linkedTemplates)
        ? allTemplates.filter(t => linkedTemplates.includes(t.id) && !globalTemplates.find(gt => gt.id === t.id))
        : [];

    let templateContext = '';
    for (const tpl of [...globalTemplates, ...linkedTemplatesList]) {
        templateContext += `\n--- Template: ${tpl.name} ---\n${tpl.prompt}\n`;
        for (const f of (tpl.files || [])) {
            const content = readFileContent(f);
            if (content) {
                templateContext += `\n--- File (${f}) ---\n${content}\n`;
            }
        }
    }

    console.log('[QA Gen] Global Templates:', globalTemplates.length);
    console.log('[QA Gen] Linked Templates:', linkedTemplatesList.length);
    console.log('[QA Gen] Built Context Length:', templateContext.length);

    try {
        const results = await Promise.all(items.map(async (item) => {
            const systemPrompt = `
${data.global_prompts?.core || ''}
${data.global_prompts?.compliance || ''}

=== KNOWLEDGE & TEMPLATE CONTEXT ===
${templateContext}
====================================

You are an expert PR & Media content creator responding on behalf of the brand defined in the context above.
The requested tone is: ${tone || 'default'}
The target language is: ${language || 'en'}

CRITICAL INSTRUCTIONS:
1. You MUST use the Knowledge & Template Context above to answer the user's question. 
${item.draft && item.draft.trim() !== '' ? `2. IMPORTANT: The user has provided an initial draft/notes for the answer. You MUST use this draft as the primary factual basis and foundation. Expand on it professionally.\nUser Draft: "${item.draft}"` : `2. Adopt the specific brand voice, facts, and guidelines provided.`}
3. For the provided question, generate EXACTLY 3 distinct, high-quality variations of a suggested response or guidance.
4. Format your output strictly as a JSON array of 3 strings. Example: ["Variation 1", "Variation 2", "Variation 3"].
5. Do not include markdown code block syntax around the JSON.
`;

            const response = await ai.models.generateContent({
                model: modelId,
                contents: [{ role: 'user', parts: [{ text: `Question: ${item.question}` }] }],
                config: {
                    systemInstruction: systemPrompt,
                    temperature: 0.8,
                }
            });

            let text = response.text.trim();
            // clean up markdown json formatting if present
            if (text.startsWith('\`\`\`json')) {
                text = text.replace(/^\`\`\`json\n/, '').replace(/\n\`\`\`$/, '');
            } else if (text.startsWith('\`\`\`')) {
                text = text.replace(/^\`\`\`\n/, '').replace(/\n\`\`\`$/, '');
            }

            let variations = [];
            try {
                variations = JSON.parse(text);
                if (!Array.isArray(variations)) variations = [text];
            } catch (e) {
                variations = [text, "Failed to parse JSON for variation 2", "Failed to parse JSON for variation 3"];
            }

            return { question: item.question, draft: item.draft, variations };
        }));

        res.json({ success: true, results });
    } catch (error) {
        console.error('Q&A Generation Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

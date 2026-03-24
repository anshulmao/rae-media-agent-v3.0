import { useState, useEffect, useRef } from 'react'
import { CheckCircle2, Sparkles, Send, Bot, Paperclip, FileText, X, Plus, Eye, Edit3, ArrowLeft, Image as ImageIcon, Download } from 'lucide-react'
import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useApp } from '../context/AppContext'
import { api } from '../lib/api.js'
import './CreatorPage.css'

const AGENT_LABELS = {
    'linkedin': 'LinkedIn',
    'whatsapp': 'WhatsApp',
    'press-release': 'Press Release',
    'internal-email': 'Internal Email',
    'website-copy': 'Website Copy',
    'custom': 'Custom'
}

const CHANNEL_MAP = {
    'linkedin': 'LinkedIn Post',
    'whatsapp': 'WhatsApp Message',
    'internal-email': 'Internal Email',
    'website-copy': 'Website Copy',
    'press-release': 'Press Release',
    'custom': 'General'
}

export function CreatorPage() {
    // Grab URL params
    const queryParams = new URLSearchParams(window.location.search)
    const agentParam = queryParams.get('agent') || 'custom'
    const promptParam = queryParams.get('prompt') || ''

    const [inputText, setInputText] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)
    const [uploadedFile, setUploadedFile] = useState(null)
    const [generatedOutput, setGeneratedOutput] = useState('')
    const [generatedImage, setGeneratedImage] = useState(null)
    const [isImageMode, setIsImageMode] = useState(agentParam === 'media')
    const [lastLogId, setLastLogId] = useState(null)

    // Modifier states — null means not added
    const [toneModifier, setToneModifier] = useState(null)
    const [languageModifier, setLanguageModifier] = useState(null)
    const [customTone, setCustomTone] = useState('')
    const [showToneDropdown, setShowToneDropdown] = useState(false)
    const [showLangDropdown, setShowLangDropdown] = useState(false)
    const [showAddMenu, setShowAddMenu] = useState(false)
    const [selectedModel, setSelectedModel] = useState(isImageMode ? 'gemini-3-pro-image-preview' : 'gemini-3-flash-preview')
    const [showModelDropdown, setShowModelDropdown] = useState(false)

    // Template linking states
    const [allTemplates, setAllTemplates] = useState([])
    const [selectedTemplates, setSelectedTemplates] = useState([])
    const [showTemplateDropdown, setShowTemplateDropdown] = useState(false)

    const addMenuRef = useRef(null)

    const { addSubmission } = useApp()
    const [submitted, setSubmitted] = useState(false)
    const [isPreview, setIsPreview] = useState(true)
    const hasAutoRun = useRef(false)


    const agentLabel = AGENT_LABELS[agentParam] || agentParam.charAt(0).toUpperCase() + agentParam.slice(1)
    const channel = CHANNEL_MAP[agentParam] || 'General'

    useEffect(() => {
        if (promptParam && !inputText) {
            setInputText(promptParam)
        }
    }, [promptParam])

    // Fetch templates for linking
    useEffect(() => {
        const fetchTemplates = async () => {
            try {
                const res = await api.get('/api/templates')
                const data = await res.json()
                setAllTemplates(data || [])
            } catch (err) {
                console.error('Error fetching templates:', err)
            }
        }
        fetchTemplates()
    }, [])

    // Auto-generation logic
    useEffect(() => {
        const autoParam = queryParams.get('auto')
        if (autoParam === 'true' && promptParam && !hasAutoRun.current) {
            hasAutoRun.current = true
            handleGenerate()
        }
    }, [promptParam])

    // Close add menu on outside click
    useEffect(() => {
        const handler = (e) => {
            if (addMenuRef.current && !addMenuRef.current.contains(e.target)) {
                setShowAddMenu(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const handleGenerate = async () => {
        if (!inputText.trim()) return
        setIsGenerating(true)
        setGeneratedOutput('')
        setSubmitted(false)

        const effectiveTone = toneModifier === '__custom__' ? customTone : (toneModifier || 'default')
        const effectiveLang = languageModifier || 'en'

        try {
            const endpoint = isImageMode ? '/api/generate-image' : '/api/generate'
            const res = await api.post(endpoint, {
                    channel,
                    language: effectiveLang,
                    tone: effectiveTone,
                    input: inputText + (uploadedFile ? `\n\n[Attached File: ${uploadedFile.name}]` : ''),
                    promptInput: promptParam,
                    agent: agentParam,
                    model: selectedModel,
                    linkedTemplates: selectedTemplates.map(t => t.id)
                })
            const data = await res.json()
            if (data.success) {
                if (isImageMode) {
                    setGeneratedImage(data.imageUrl)
                } else {
                    setGeneratedOutput(data.text)
                }
                if (data.logId) setLastLogId(data.logId)
            } else {
                setGeneratedOutput('Error generating content: ' + data.error)
            }
        } catch (err) {
            setGeneratedOutput('Error connecting to generation server.')
        } finally {
            setIsGenerating(false)
        }
    }

    const handleSubmit = async () => {
        const effectiveTone = toneModifier === '__custom__' ? customTone : (toneModifier || 'default')
        const effectiveLang = languageModifier || 'en'
        try {
            await api.post('/api/drafts', {
                    content: generatedOutput,
                    agent: agentParam,
                    channel,
                    tone: effectiveTone,
                    language: effectiveLang,
                    logId: lastLogId,
                    type: isImageMode ? 'image' : 'text',
                    imageUrl: isImageMode ? generatedImage : null
                })
            setSubmitted(true)
        } catch (e) { console.error(e) }
    }

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0]
        if (file) setUploadedFile(file)
    }

    const handleAddTone = () => {
        setShowAddMenu(false)
        setToneModifier('professional')
        setShowToneDropdown(true)
    }

    const handleAddLanguage = () => {
        setShowAddMenu(false)
        setLanguageModifier('en')
        setShowLangDropdown(true)
    }

    const handleAddTemplate = () => {
        setShowAddMenu(false)
        setShowTemplateDropdown(true)
    }

    const toggleTemplate = (template) => {
        if (selectedTemplates.find(t => t.id === template.id)) {
            setSelectedTemplates(selectedTemplates.filter(t => t.id !== template.id))
        } else {
            setSelectedTemplates([...selectedTemplates, template])
        }
    }

    const toneDisplayLabel = () => {
        if (toneModifier === '__custom__') return customTone || 'Custom'
        return toneModifier ? toneModifier.charAt(0).toUpperCase() + toneModifier.slice(1) : ''
    }

    const langDisplayLabel = () => {
        const map = { en: 'English', ms: 'Malay', zh: 'Chinese', ta: 'Tamil', hi: 'Hindi' }
        return map[languageModifier] || languageModifier || ''
    }

    return (
        <div className="creator-page animate-fade-in">
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 className="heading-gradient">Content Generation</h1>
                    <p className="subtitle">Collaborate with the AI agent to draft and refine content</p>
                </div>
                <Link to="/creator/select" className="btn btn-secondary btn-sm">
                    <ArrowLeft size={14} /> Back to Selector
                </Link>
            </header>

            <div className="generation-workspace">
                <div className="output-container glass-panel">
                    <div className="card-header">
                        <h2>Generation Workspace</h2>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <div className="tab-btn-group" style={{ display: 'flex', background: 'var(--color-surface-1)', padding: '2px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                                <button
                                    className={`tab-btn btn-sm ${!isImageMode ? 'active' : ''}`}
                                    onClick={() => {
                                        setIsImageMode(false);
                                        setGeneratedImage(null);
                                        if (selectedModel === 'gemini-3-pro-image-preview' || selectedModel === 'gemini-2.5-flash-image') setSelectedModel('gemini-3-flash-preview');
                                    }}
                                    style={{ padding: '4px 12px', minWidth: '80px', fontSize: '0.8rem' }}
                                >
                                    <FileText size={14} style={{ marginRight: '4px' }} /> Content
                                </button>
                                <button
                                    className={`tab-btn btn-sm ${isImageMode ? 'active' : ''}`}
                                    onClick={() => {
                                        setIsImageMode(true);
                                        setGeneratedOutput('');
                                        if (selectedModel === 'gemini-2.5-flash' || selectedModel === 'gemini-3-flash-preview') setSelectedModel('gemini-3-pro-image-preview');
                                    }}
                                    style={{ padding: '4px 12px', minWidth: '80px', fontSize: '0.8rem' }}
                                >
                                    <ImageIcon size={14} style={{ marginRight: '4px' }} /> Media
                                </button>
                            </div>

                            {/* Model Selection Dropdown */}
                            <div className="tab-btn-group" style={{ position: 'relative', display: 'flex', background: 'var(--color-surface-1)', padding: '2px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                                <button
                                    className="tab-btn btn-sm active"
                                    onClick={() => setShowModelDropdown(!showModelDropdown)}
                                    style={{ padding: '4px 12px', minWidth: '120px', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                >
                                    <span>{selectedModel.includes('pro-image') ? 'Nanobanana Pro' : selectedModel.includes('flash-image') ? 'Nanobanana' : selectedModel.includes('3') ? 'Gemini 3 Flash' : 'Gemini 2.5 Flash'}</span>
                                    <Edit3 size={10} style={{ marginLeft: '6px', opacity: 0.7 }} />
                                </button>
                                {showModelDropdown && (
                                    <div className="modifier-dropdown" style={{ top: '100%', left: 0, marginTop: '4px', width: '200px', zIndex: 100 }}>
                                        {!isImageMode ? (
                                            <>
                                                <button className={`modifier-option ${selectedModel === 'gemini-3-flash-preview' ? 'active' : ''}`} onClick={() => { setSelectedModel('gemini-3-flash-preview'); setShowModelDropdown(false) }}>
                                                    Gemini 3 Flash Preview
                                                </button>
                                                <button className={`modifier-option ${selectedModel === 'gemini-2.5-flash' ? 'active' : ''}`} onClick={() => { setSelectedModel('gemini-2.5-flash'); setShowModelDropdown(false) }}>
                                                    Gemini 2.5 Flash
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button className={`modifier-option ${selectedModel === 'gemini-3-pro-image-preview' ? 'active' : ''}`} onClick={() => { setSelectedModel('gemini-3-pro-image-preview'); setShowModelDropdown(false) }}>
                                                    Nanobanana Pro (G3)
                                                </button>
                                                <button className={`modifier-option ${selectedModel === 'gemini-2.5-flash-image' ? 'active' : ''}`} onClick={() => { setSelectedModel('gemini-2.5-flash-image'); setShowModelDropdown(false) }}>
                                                    Nanobanana (G2.5)
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {(generatedOutput || generatedImage) && !isImageMode && (
                                <div className="tab-btn-group" style={{ display: 'flex', background: 'var(--color-surface-1)', padding: '2px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                                    <button
                                        className={`tab-btn btn-sm ${isPreview ? 'active' : ''}`}
                                        onClick={() => setIsPreview(true)}
                                        style={{ padding: '4px 12px', minWidth: '80px', fontSize: '0.8rem' }}
                                    >
                                        <Eye size={14} style={{ marginRight: '4px' }} /> Preview
                                    </button>
                                    <button
                                        className={`tab-btn btn-sm ${!isPreview ? 'active' : ''}`}
                                        onClick={() => setIsPreview(false)}
                                        style={{ padding: '4px 12px', minWidth: '80px', fontSize: '0.8rem' }}
                                    >
                                        <Edit3 size={14} style={{ marginRight: '4px' }} /> Edit
                                    </button>
                                </div>
                            )}
                            <div className="status-badge success">
                                <CheckCircle2 size={14} /> Brand Compliant
                            </div>
                        </div>
                    </div>
                    <div className="card-body editor-body">
                        {!isGenerating && !generatedOutput && !generatedImage ? (
                            <div className="empty-state">
                                <Sparkles size={48} className="empty-icon" />
                                <h3>Ready to Generate</h3>
                                <p>Configure your prompt in the chat box below and press send.</p>
                            </div>
                        ) : (
                            <div className="editor-container">
                                {isGenerating ? (
                                    <div className="generating-overlay">
                                        <div className="spinner"></div>
                                        <p>{isImageMode ? 'Rendering TBA. Brand Poster...' : 'Consulting Agentbase Templates...'}</p>
                                    </div>
                                ) : (
                                    <>
                                        {isImageMode ? (
                                            <div className="generated-media-view" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                                                {generatedImage ? (
                                                    <>
                                                        <div className="poster-preview glass-panel" style={{ maxWidth: '100%', borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
                                                            <img src={generatedImage} alt="Generated Poster" style={{ width: '100%', height: 'auto', display: 'block' }} />
                                                        </div>
                                                        <div className="editor-actions" style={{ marginTop: '20px' }}>
                                                            <button className="btn btn-secondary" onClick={handleGenerate}>Regenerate</button>
                                                            <a href={generatedImage} download="TBA_Poster.png" className="btn btn-primary">
                                                                <Download size={16} /> Download Poster
                                                            </a>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="empty-state">
                                                        <ImageIcon size={48} className="empty-icon" />
                                                        <p>Image will appear here</p>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <>
                                                {!isPreview ? (
                                                    <textarea
                                                        className="output-textarea"
                                                        value={generatedOutput}
                                                        onChange={(e) => setGeneratedOutput(e.target.value)}
                                                        placeholder="Output will appear here..."
                                                    />
                                                ) : (
                                                    <div className="output-textarea markdown-content" style={{ overflowY: 'auto' }}>
                                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                            {generatedOutput}
                                                        </ReactMarkdown>
                                                    </div>
                                                )}
                                                <div className="editor-actions">
                                                    <button className="btn btn-secondary" onClick={handleGenerate}>Regenerate</button>
                                                    {!submitted ? (
                                                        <button className="btn btn-primary" onClick={handleSubmit} disabled={!generatedOutput && !generatedImage}>
                                                            <Send size={16} /> Submit for Review
                                                        </button>
                                                    ) : (
                                                        <button className="btn btn-secondary" disabled>
                                                            <CheckCircle2 size={16} /> Submitted
                                                        </button>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Floating Chat Box */}
            <div className="creator-prompt-box">
                {/* Dynamic Modifier Pills Row */}
                <div className="prompt-pills-row">
                    {/* Agent pill — always visible */}
                    <div className="pill primary-pill">
                        <Bot size={14} />
                        {agentLabel} Agent
                    </div>

                    {/* Tone modifier pill — only if added */}
                    {toneModifier !== null && (
                        <div className="pill modifier-pill" style={{ position: 'relative' }}>
                            <span onClick={() => setShowToneDropdown(!showToneDropdown)} style={{ cursor: 'pointer' }}>
                                🎨 {toneDisplayLabel()}
                            </span>
                            <button className="clear-btn" onClick={() => { setToneModifier(null); setShowToneDropdown(false); setCustomTone('') }}>
                                <X size={12} />
                            </button>
                            {showToneDropdown && (
                                <div className="modifier-dropdown">
                                    {['professional', 'casual', 'urgent', 'empathetic', 'bold', 'friendly'].map(t => (
                                        <button key={t} className={`modifier-option ${toneModifier === t ? 'active' : ''}`} onClick={() => { setToneModifier(t); setShowToneDropdown(false) }}>
                                            {t.charAt(0).toUpperCase() + t.slice(1)}
                                        </button>
                                    ))}
                                    <div className="modifier-custom-row">
                                        <input
                                            type="text"
                                            placeholder="Custom tone..."
                                            value={customTone}
                                            onChange={e => setCustomTone(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter' && customTone.trim()) { setToneModifier('__custom__'); setShowToneDropdown(false) } }}
                                        />
                                        {customTone.trim() && (
                                            <button className="modifier-option" onClick={() => { setToneModifier('__custom__'); setShowToneDropdown(false) }}>Use</button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Language modifier pill — only if added */}
                    {languageModifier !== null && (
                        <div className="pill modifier-pill" style={{ position: 'relative' }}>
                            <span onClick={() => setShowLangDropdown(!showLangDropdown)} style={{ cursor: 'pointer' }}>
                                🌐 {langDisplayLabel()}
                            </span>
                            <button className="clear-btn" onClick={() => { setLanguageModifier(null); setShowLangDropdown(false) }}>
                                <X size={12} />
                            </button>
                            {showLangDropdown && (
                                <div className="modifier-dropdown">
                                    {[
                                        { value: 'en', label: 'English' },
                                        { value: 'ms', label: 'Malay' },
                                        { value: 'zh', label: 'Chinese' },
                                        { value: 'ta', label: 'Tamil' },
                                        { value: 'hi', label: 'Hindi' }
                                    ].map(l => (
                                        <button key={l.value} className={`modifier-option ${languageModifier === l.value ? 'active' : ''}`} onClick={() => { setLanguageModifier(l.value); setShowLangDropdown(false) }}>
                                            {l.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Uploaded file pill */}
                    {uploadedFile && (
                        <div className="pill file-pill">
                            <FileText size={14} />
                            {uploadedFile.name}
                            <button className="clear-btn" onClick={() => setUploadedFile(null)}>
                                <X size={12} />
                            </button>
                        </div>
                    )}

                    {/* Linked Template pills */}
                    {selectedTemplates.map(tpl => (
                        <div key={tpl.id} className="pill primary-pill">
                            <Sparkles size={14} />
                            {tpl.name}
                            <button className="clear-btn" onClick={() => toggleTemplate(tpl)}>
                                <X size={12} />
                            </button>
                        </div>
                    ))}

                    {/* Add modifier '+' button */}
                    <div className="add-modifier-wrapper" ref={addMenuRef}>
                        <button className="add-modifier-btn" onClick={() => setShowAddMenu(!showAddMenu)} title="Add modifier">
                            <Plus size={14} />
                        </button>
                        {showAddMenu && (
                            <div className="add-modifier-menu">
                                {toneModifier === null && (
                                    <button className="modifier-menu-item" onClick={handleAddTone}>
                                        🎨 Add tone modifier
                                    </button>
                                )}
                                {languageModifier === null && (
                                    <button className="modifier-menu-item" onClick={handleAddLanguage}>
                                        🌐 Add language modifier
                                    </button>
                                )}
                                <button className="modifier-menu-item" onClick={handleAddTemplate}>
                                    📄 Link Knowledge Template
                                </button>
                                {toneModifier !== null && languageModifier !== null && (
                                    <div className="modifier-menu-item" style={{ opacity: 0.5, cursor: 'default' }}>Most modifiers added</div>
                                )}
                            </div>
                        )}
                        {showTemplateDropdown && (
                            <div className="modifier-dropdown" style={{ minWidth: '240px' }}>
                                <div style={{ padding: '8px 14px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-subtle)', borderBottom: '1px solid var(--color-border)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    Link Templates
                                    <X size={14} style={{ cursor: 'pointer' }} onClick={() => setShowTemplateDropdown(false)} />
                                </div>
                                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                    {allTemplates.length === 0 ? (
                                        <div style={{ padding: '12px', textAlign: 'center', fontSize: '0.8rem', opacity: 0.6 }}>No templates found</div>
                                    ) : (
                                        allTemplates.map(tpl => (
                                            <button
                                                key={tpl.id}
                                                className={`modifier-option ${selectedTemplates.find(t => t.id === tpl.id) ? 'active' : ''}`}
                                                onClick={() => toggleTemplate(tpl)}
                                            >
                                                {tpl.name}
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="prompt-input-area">
                    <textarea
                        className="chat-textarea"
                        placeholder="Describe what you want the agent to do..."
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleGenerate();
                            }
                        }}
                    />
                    <div className="prompt-actions">
                        <label className="icon-btn" title="Attach file">
                            <input type="file" style={{ display: 'none' }} onChange={handleFileUpload} />
                            <Paperclip size={18} />
                        </label>
                        <button
                            className="icon-btn submit-btn"
                            onClick={handleGenerate}
                            disabled={isGenerating || !inputText.trim()}
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            </div>
        </div >
    )
}


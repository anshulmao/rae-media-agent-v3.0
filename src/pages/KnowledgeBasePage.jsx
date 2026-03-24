import React, { useState, useEffect } from 'react'
import { FileText, Database, ShieldCheck, Activity, Trash2, Upload, Search, CheckCircle2, XCircle, Plus, ArrowLeft, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useApp } from '../context/AppContext'
import { api } from '../lib/api.js'
import './AdminPage.css'

export function KnowledgeBasePage() {
    const { metrics: contextMetrics } = useApp()

    // Templates state
    const [templates, setTemplates] = useState([])
    const [suggestedTemplates, setSuggestedTemplates] = useState([])
    const [wizardOpen, setWizardOpen] = useState(false)
    const [editingTemplate, setEditingTemplate] = useState(null)

    // Wizard form state
    const [wizName, setWizName] = useState('')
    const [wizDesc, setWizDesc] = useState('')
    const [wizPrompt, setWizPrompt] = useState('')
    const [wizIsGlobal, setWizIsGlobal] = useState(false)
    const [wizAgents, setWizAgents] = useState([])
    const [wizFiles, setWizFiles] = useState([])
    const [wizUploading, setWizUploading] = useState(false)
    const [wizCategory, setWizCategory] = useState('custom')

    const availableAgents = [
        { id: 'linkedin', name: 'LinkedIn Post' },
        { id: 'whatsapp', name: 'WhatsApp Broadcast' },
        { id: 'press-release', name: 'Press Release' },
        { id: 'internal-email', name: 'Internal Email' },
        { id: 'website-copy', name: 'Website Copy' },
        { id: 'custom', name: 'Custom Request' }
    ]

    useEffect(() => {
        fetchTemplates()
        fetchSuggestions()
    }, [])

    const fetchTemplates = async () => {
        try {
            const res = await api.get('/api/templates')
            const data = await res.json()
            setTemplates(data)
        } catch (e) { console.error(e) }
    }

    const fetchSuggestions = async () => {
        try {
            const res = await api.get('/api/suggested-templates')
            const data = await res.json()
            setSuggestedTemplates(data)
        } catch (e) { console.error(e) }
    }

    // ---- Wizard Logic ----
    const openNewWizard = (suggestion) => {
        setEditingTemplate(null)
        setWizName(suggestion?.name || '')
        setWizDesc(suggestion?.description || '')
        setWizPrompt('')
        setWizIsGlobal(false)
        setWizAgents([])
        setWizFiles([])
        setWizCategory('custom')
        setWizardOpen(true)
    }

    const openEditWizard = (tpl) => {
        setEditingTemplate(tpl)
        setWizName(tpl.name)
        setWizDesc(tpl.description || '')
        setWizPrompt(tpl.prompt || '')
        setWizIsGlobal(tpl.isGlobal || false)
        setWizAgents(tpl.assignedAgents || [])
        setWizFiles(tpl.files || [])
        setWizCategory(tpl.category || 'custom')
        setWizardOpen(true)
    }

    const handleWizardSave = async () => {
        const payload = {
            id: editingTemplate?.id || `tpl_${Date.now()}`,
            name: wizName,
            description: wizDesc,
            prompt: wizPrompt,
            files: wizFiles,
            isGlobal: wizIsGlobal,
            assignedAgents: wizAgents,
            category: wizCategory
        }
        try {
            await api.post('/api/templates', payload)
            setWizardOpen(false)
            await fetchTemplates()
        } catch (e) { console.error(e) }
    }

    const handleDeleteTemplate = async (id) => {
        try {
            await api.delete(`/api/templates/${id}`)
            await fetchTemplates()
        } catch (e) { console.error(e) }
    }

    const handleWizFileUpload = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        setWizUploading(true)
        const tplId = editingTemplate?.id || 'new'
        const formData = new FormData()
        formData.append('file', file)
        formData.append('templateId', tplId)
        try {
            const res = await api.upload(`/api/templates/${tplId}/upload`, formData)
            const data = await res.json()
            if (data.success) {
                setWizFiles(prev => [...prev, data.file])
            }
        } catch (e) { console.error(e) }
        finally { setWizUploading(false) }
    }

    const handleWizFileRemove = (filename) => {
        setWizFiles(prev => prev.filter(f => f !== filename))
    }

    const toggleAgent = (agentId) => {
        setWizAgents(prev =>
            prev.includes(agentId) ? prev.filter(a => a !== agentId) : [...prev, agentId]
        )
    }

    // Separate templates into required vs custom
    const requiredTemplates = templates.filter(t => t.category === 'required')
    const customTemplates = templates.filter(t => t.category !== 'required')

    return (
        <div className="admin-page animate-fade-in">
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 className="heading-gradient">Knowledge Base</h1>
                    <p className="subtitle">Manage AI instructions, guardrails, and context-specific templates</p>
                </div>
                <Link to="/control-panel" className="btn btn-secondary btn-sm">
                    <ArrowLeft size={14} /> Back to Dashboard
                </Link>
            </header>

            {/* =================== TEMPLATES TAB =================== */}
            {!wizardOpen && (
                <div className="tab-content templates-tab animate-fade-in">
                    {/* Required */}
                    <h3 className="section-label">Required Templates</h3>
                    <div className="templates-grid">
                        {requiredTemplates.map(tpl => (
                            <div key={tpl.id} className="template-card glass-panel" onClick={() => openEditWizard(tpl)}>
                                <div className="template-icon"><FileText size={20} /></div>
                                <h3>{tpl.name}</h3>
                                <p>{tpl.description}</p>
                                {tpl.isGlobal && <span className="global-badge">Global</span>}
                            </div>
                        ))}
                    </div>

                    {/* Custom */}
                    <h3 className="section-label" style={{ marginTop: '32px' }}>Custom Templates</h3>
                    <div className="templates-grid">
                        {customTemplates.map(tpl => (
                            <div key={tpl.id} className="template-card glass-panel" onClick={() => openEditWizard(tpl)}>
                                <div className="template-icon"><FileText size={20} /></div>
                                <h3>{tpl.name}</h3>
                                <p>{tpl.description}</p>
                                {tpl.assignedAgents?.length > 0 && (
                                    <span className="agent-badge">{tpl.assignedAgents.join(', ')}</span>
                                )}
                            </div>
                        ))}

                        {/* Add New Template Card */}
                        <div className="template-card glass-panel add-card" onClick={() => openNewWizard()}>
                            <Plus size={32} />
                            <h3>New Template</h3>
                            <p>Create a custom knowledge base template</p>
                        </div>
                    </div>
                </div>
            )}

            {/* =================== TEMPLATE WIZARD =================== */}
            {wizardOpen && (
                <div className="tab-content wizard-tab animate-fade-in">
                    <div className="glass-panel wizard-panel">
                        <div className="wizard-header">
                            <div className="wizard-title-group">
                                <h2>{editingTemplate ? 'Refine Template' : 'Create New Template'}</h2>
                                <p className="subtitle">{wizName || 'Configure your AI generation context'}</p>
                            </div>
                            <div className="wizard-action-group">
                                {editingTemplate && editingTemplate.category !== 'required' && (
                                    <button className="btn btn-secondary btn-sm" style={{ color: 'var(--color-error, #ef4444)' }} onClick={() => { handleDeleteTemplate(editingTemplate.id); setWizardOpen(false) }}>
                                        <Trash2 size={14} /> Delete
                                    </button>
                                )}
                                <button className="btn btn-secondary btn-sm" onClick={() => setWizardOpen(false)}>
                                    <ArrowLeft size={14} /> Back
                                </button>
                            </div>
                        </div>
                        <div className="card-body wizard-body">
                            {/* Suggestions (only when creating new) */}
                            {!editingTemplate && suggestedTemplates.length > 0 && (
                                <div className="wizard-section">
                                    <label>Start from a suggestion</label>
                                    <div className="suggestion-pills">
                                        {suggestedTemplates.map(s => (
                                            <button key={s.id} className="pill suggestion-pill" onClick={() => { setWizName(s.name); setWizDesc(s.description) }}>
                                                {s.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="wizard-section">
                                <label>Template Name *</label>
                                <input type="text" className="wiz-input" value={wizName} onChange={e => setWizName(e.target.value)} placeholder="e.g. LinkedIn Playbook" />
                            </div>

                            <div className="wizard-section">
                                <label>Description</label>
                                <input type="text" className="wiz-input" value={wizDesc} onChange={e => setWizDesc(e.target.value)} placeholder="Short description of what this template does" />
                            </div>

                            <div className="wizard-section">
                                <label>System Prompt / Instructions</label>
                                <textarea className="input-textarea" rows={6} value={wizPrompt} onChange={e => setWizPrompt(e.target.value)} placeholder="Enter the exact instructions the agent should follow when this template is active..." />
                            </div>

                            <div className="wizard-section">
                                <label>Attached Files</label>
                                <div className="wiz-files-list">
                                    {wizFiles.map((f, i) => (
                                        <div key={i} className="wiz-file-chip">
                                            <FileText size={14} /> {f}
                                            <button className="clear-btn" onClick={() => handleWizFileRemove(f)}><X size={12} /></button>
                                        </div>
                                    ))}
                                </div>
                                <label className="upload-dropzone wiz-upload" style={{ cursor: 'pointer' }}>
                                    <input type="file" accept=".txt,.md" style={{ display: 'none' }} onChange={handleWizFileUpload} disabled={wizUploading} />
                                    <Upload size={20} />
                                    <span>{wizUploading ? 'Uploading...' : 'Attach .txt or .md file'}</span>
                                </label>
                            </div>

                            <div className="wizard-section">
                                <label>Agent Assignment</label>
                                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-subtle)', marginBottom: '8px' }}>Assign templates to specific agents. Global templates are automatically used by all agents.</p>
                                <div className="agent-checkboxes">
                                    {availableAgents.map(a => (
                                        <label key={a.id} className={`agent-checkbox ${wizAgents.includes(a.id) ? 'checked' : ''}`}>
                                            <input type="checkbox" checked={wizAgents.includes(a.id)} onChange={() => toggleAgent(a.id)} />
                                            {a.name}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="wizard-section">
                                <label className="checkbox-row">
                                    <input type="checkbox" checked={wizIsGlobal} onChange={e => setWizIsGlobal(e.target.checked)} />
                                    <span>Mark as Global Template (used in all generations)</span>
                                </label>
                            </div>

                            <div className="action-row">
                                <button className="btn btn-primary" onClick={handleWizardSave} disabled={!wizName.trim()}>
                                    {editingTemplate ? 'Save Changes' : 'Create Template'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

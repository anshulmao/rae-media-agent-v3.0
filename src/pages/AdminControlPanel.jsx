import React, { useState, useEffect, useMemo } from 'react'
import {
    CheckCircle2, XCircle, FileText, ArrowLeft, Clock, Eye, Trash2,
    LayoutDashboard, ClipboardList, Activity, TrendingUp, BarChart3,
    Calendar, Users, ShieldCheck, Database, Image as ImageIcon, Type
} from 'lucide-react'
import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api } from '../lib/api.js'
import './AdminPage.css'

export function AdminControlPanel() {
    const [activeTab, setActiveTab] = useState('dashboard')
    const [logs, setLogs] = useState([])
    const [drafts, setDrafts] = useState([])
    const [selectedDraft, setSelectedDraft] = useState(null)
    const [selectedLog, setSelectedLog] = useState(null)
    const [linkedLog, setLinkedLog] = useState(null)
    const [showLogDetails, setShowLogDetails] = useState(false)
    const [kbFiles, setKbFiles] = useState([])

    useEffect(() => {
        fetchLogs()
        fetchDrafts()
        fetchKbFiles()
    }, [])

    const fetchKbFiles = async () => {
        try {
            const res = await api.get('/api/kb')
            const data = await res.json()
            setKbFiles(data)
        } catch (e) { console.error(e) }
    }

    const fetchLogs = async () => {
        try {
            const res = await api.get('/api/logs')
            const data = await res.json()
            setLogs(data)
        } catch (e) { console.error(e) }
    }

    const fetchDrafts = async () => {
        try {
            const res = await api.get('/api/drafts')
            const data = await res.json()
            setDrafts(data)
        } catch (e) { console.error(e) }
    }

    const fetchLogById = async (logId) => {
        try {
            const res = await api.get(`/api/logs/${logId}`)
            const data = await res.json()
            setLinkedLog(data)
        } catch (e) { console.error(e) }
    }

    const isImageLog = (log) => log?.type === 'image' || (log?.imageUrl && !log?.output?.includes('IMAGE_GENERATED'));
    const isImageDraft = (draft) => draft?.type === 'image' || draft?.imageUrl;

    // --- Metrics Calculation ---
    const stats = useMemo(() => {
        const total = logs.length
        const pending = drafts.filter(d => d.status === 'pending').length

        // Count by Agent
        const byAgent = logs.reduce((acc, log) => {
            const agent = log.agent || 'custom'
            acc[agent] = (acc[agent] || 0) + 1
            return acc
        }, {})

        // Count by Date (last 7 days)
        const byDate = logs.reduce((acc, log) => {
            const date = new Date(log.timestamp).toLocaleDateString()
            acc[date] = (acc[date] || 0) + 1
            return acc
        }, {})

        return { total, pending, byAgent, byDate }
    }, [logs, drafts])

    // --- Actions ---
    const handleUpdateDraftStatus = async (id, status) => {
        try {
            await api.patch(`/api/drafts/${id}`, { status })
            await fetchDrafts()
            setSelectedDraft(null)
        } catch (e) { console.error(e) }
    }

    const handleDeleteDraft = async (id) => {
        try {
            await api.delete(`/api/drafts/${id}`)
            await fetchDrafts()
            setSelectedDraft(null)
        } catch (e) { console.error(e) }
    }

    const agentLabel = (a) => {
        const map = {
            linkedin: 'LinkedIn Post',
            whatsapp: 'WhatsApp',
            'press-release': 'Press Release',
            'internal-email': 'Internal Email',
            'website-copy': 'Website Copy',
            custom: 'Custom'
        }
        return map[a] || a
    }

    return (
        <div className="admin-page animate-fade-in">
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 className="heading-gradient">Admin Control Panel</h1>
                    <p className="subtitle">Monitor generations, review drafts, and analyze system performance</p>
                </div>
                <Link to="/creator/select" className="btn btn-secondary btn-sm">
                    <ArrowLeft size={14} /> Back to Workspace
                </Link>
            </header>

            <div className="admin-nav">
                <button className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
                    <LayoutDashboard size={16} /> Dashboard
                </button>
                <button className={`tab-btn ${activeTab === 'drafts' ? 'active' : ''}`} onClick={() => { setActiveTab('drafts'); setSelectedDraft(null) }}>
                    <ClipboardList size={16} /> Drafts Review {stats.pending > 0 && <span className="count-badge">{stats.pending}</span>}
                </button>
                <button className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => { setActiveTab('logs'); setSelectedLog(null) }}>
                    <Activity size={16} /> Generation Logs
                </button>
            </div>

            <div className="tab-content">
                {/* DASHBOARD TAB */}
                {activeTab === 'dashboard' && (
                    <div className="dashboard-view animate-fade-in">
                        <div className="metrics-grid">
                            <div className="metric-card glass-panel">
                                <div className="metric-header">
                                    <span className="metric-label">Total Generations</span>
                                    <TrendingUp size={20} className="text-primary" />
                                </div>
                                <div className="metric-value">{stats.total}</div>
                                <div className="metric-trend">Across all agent types</div>
                            </div>
                            <div className="metric-card glass-panel alert-card">
                                <div className="metric-header">
                                    <span className="metric-label">Awaiting Approval</span>
                                    <Clock size={20} className="text-warning" />
                                </div>
                                <div className="metric-value">{stats.pending}</div>
                                {stats.pending > 0 && <button className="btn btn-secondary btn-sm mt-2 w-full" onClick={() => setActiveTab('drafts')}>Review Now</button>}
                            </div>
                            <div className="metric-card glass-panel">
                                <div className="metric-header">
                                    <span className="metric-label">Active Agents</span>
                                    <ShieldCheck size={20} className="text-success" />
                                </div>
                                <div className="metric-value">{Object.keys(stats.byAgent).length}</div>
                                <div className="metric-trend">Configured in System</div>
                            </div>
                            <div className="metric-card glass-panel">
                                <div className="metric-header">
                                    <span className="metric-label">Knowledge Assets</span>
                                    <Database size={20} className="text-primary" />
                                </div>
                                <div className="metric-value">{kbFiles.length}</div>
                                <div className="metric-trend">Reference files indexed</div>
                            </div>
                        </div>

                        <div className="dashboard-grid mt-6">
                            <div className="glass-panel stat-card">
                                <div className="card-header">
                                    <h3><BarChart3 size={18} /> Activity by Agent Type</h3>
                                </div>
                                <div className="card-body">
                                    <div className="agent-stats-list">
                                        {Object.entries(stats.byAgent).length === 0 ? (
                                            <p className="text-center py-4 text-muted">No generation data yet</p>
                                        ) : (
                                            Object.entries(stats.byAgent).map(([agent, count]) => (
                                                <div key={agent} className="agent-stat-row">
                                                    <span className="agent-name">{agentLabel(agent)}</span>
                                                    <div className="stat-bar-container">
                                                        <div className="stat-bar" style={{ width: `${(count / stats.total) * 100}%` }}></div>
                                                    </div>
                                                    <span className="stat-count">{count}</span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="glass-panel stat-card">
                                <div className="card-header">
                                    <h3><Calendar size={18} /> Recent Activity Trend</h3>
                                </div>
                                <div className="card-body">
                                    <div className="date-stats-list">
                                        {Object.entries(stats.byDate).sort((a, b) => new Date(b[0]) - new Date(a[0])).slice(0, 5).map(([date, count]) => (
                                            <div key={date} className="date-stat-row">
                                                <span className="date-label">{date}</span>
                                                <div className="date-count-pill">{count} gens</div>
                                            </div>
                                        ))}
                                        {Object.entries(stats.byDate).length === 0 && (
                                            <p className="text-center py-4 text-muted">No activity trends yet</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="glass-panel mt-6">
                            <div className="card-header">
                                <h3><Users size={18} /> Recent Pending Submissions</h3>
                            </div>
                            <div className="card-body">
                                <div className="table-responsive">
                                    <table className="admin-table">
                                        <thead>
                                            <tr>
                                                <th>Author</th>
                                                <th>Agent</th>
                                                <th>Type</th>
                                                <th>Format</th>
                                                <th>Generated At</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {drafts.filter(d => d.status === 'pending').slice(0, 5).map(draft => (
                                                <tr key={draft.id}>
                                                    <td>{draft.author}</td>
                                                    <td>{agentLabel(draft.agent)}</td>
                                                    <td>{draft.channel}</td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            {isImageDraft(draft) ? <ImageIcon size={14} /> : <Type size={14} />}
                                                            {isImageDraft(draft) ? 'Media' : 'Text'}
                                                        </div>
                                                    </td>
                                                    <td>{new Date(draft.createdAt).toLocaleString()}</td>
                                                    <td>
                                                        <button className="btn btn-secondary btn-sm" onClick={() => { setSelectedDraft(draft); setActiveTab('drafts') }}>Review</button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {drafts.filter(d => d.status === 'pending').length === 0 && (
                                                <tr><td colSpan="5" className="text-center py-4">All caught up! No pending drafts.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* DRAFTS TAB */}
                {activeTab === 'drafts' && !selectedDraft && (
                    <div className="glass-panel animate-fade-in">
                        <div className="card-header">
                            <h2>Drafts Queue</h2>
                        </div>
                        <div className="card-body">
                            <div className="table-responsive">
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Author</th>
                                            <th>Agent</th>
                                            <th>Channel</th>
                                            <th>Format</th>
                                            <th>Created</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {drafts.length === 0 ? (
                                            <tr><td colSpan="6" className="text-center py-8">No drafts found</td></tr>
                                        ) : (
                                            drafts.map(draft => (
                                                <tr key={draft.id}>
                                                    <td>{draft.author}</td>
                                                    <td>{agentLabel(draft.agent)}</td>
                                                    <td>{draft.channel}</td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            {isImageDraft(draft) ? <ImageIcon size={14} className="text-secondary" /> : <Type size={14} className="text-primary" />}
                                                            {isImageDraft(draft) ? 'Media' : 'Text'}
                                                        </div>
                                                    </td>
                                                    <td>{new Date(draft.createdAt).toLocaleString()}</td>
                                                    <td>
                                                        <span className={draft.status === 'approved' ? 'badge-success' : draft.status === 'rejected' ? 'badge-danger' : 'badge-warning'}>
                                                            {draft.status.charAt(0).toUpperCase() + draft.status.slice(1)}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: '8px' }}>
                                                            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedDraft(draft)}>
                                                                <Eye size={14} /> View
                                                            </button>
                                                            {draft.status === 'pending' && (
                                                                <>
                                                                    <button className="icon-btn success" onClick={() => handleUpdateDraftStatus(draft.id, 'approved')} title="Approve">
                                                                        <CheckCircle2 size={18} />
                                                                    </button>
                                                                    <button className="icon-btn danger" onClick={() => handleUpdateDraftStatus(draft.id, 'rejected')} title="Reject">
                                                                        <XCircle size={18} />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* DRAFT DETAIL VIEW */}
                {activeTab === 'drafts' && selectedDraft && (
                    <div className="glass-panel animate-fade-in p-6">
                        <div className="card-header">
                            <h2>Review: {agentLabel(selectedDraft.agent)} Content</h2>
                            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedDraft(null)}>
                                <ArrowLeft size={14} /> Back to Queue
                            </button>
                        </div>
                        <div className="card-body space-y-6">
                            <div className="info-grid grid grid-cols-3 gap-4">
                                <div className="info-box"><strong>Author:</strong> {selectedDraft.author}</div>
                                <div className="info-box"><strong>Channel:</strong> {selectedDraft.channel}</div>
                                <div className="info-box"><strong>Created:</strong> {new Date(selectedDraft.createdAt).toLocaleString()}</div>
                            </div>

                            <div className="prompt-editor mt-4">
                                <label>Generated {isImageDraft(selectedDraft) ? 'Media' : 'Content'} Preview</label>
                                {isImageDraft(selectedDraft) ? (
                                    <div className="image-preview-container" style={{ background: 'var(--color-surface-2)', borderRadius: '12px', padding: '24px', border: '1px solid var(--color-border)', display: 'flex', justifyContent: 'center' }}>
                                        <img src={selectedDraft.imageUrl} alt="Generated Asset" style={{ maxWidth: '100%', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} />
                                    </div>
                                ) : (
                                    <div className="markdown-content" style={{ minHeight: '300px', background: 'var(--color-surface-2)', borderRadius: '12px', padding: '24px', border: '1px solid var(--color-border)' }}>
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {selectedDraft.content}
                                        </ReactMarkdown>
                                    </div>
                                )}
                            </div>

                            <div className="action-row flex gap-4 pt-6 border-t border-white/10">
                                {selectedDraft.status === 'pending' ? (
                                    <>
                                        <button className="btn btn-primary" onClick={() => handleUpdateDraftStatus(selectedDraft.id, 'approved')}>
                                            <CheckCircle2 size={18} /> Approve Web Application
                                        </button>
                                        <button className="btn btn-secondary text-error" onClick={() => handleUpdateDraftStatus(selectedDraft.id, 'rejected')}>
                                            <XCircle size={18} /> Reject
                                        </button>
                                    </>
                                ) : (
                                    <button className="btn btn-secondary text-error" onClick={() => handleDeleteDraft(selectedDraft.id)}>
                                        <Trash2 size={16} /> Delete Record
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* LOGS TAB */}
                {activeTab === 'logs' && !selectedLog && (
                    <div className="glass-panel animate-fade-in">
                        <div className="card-header">
                            <h2>All System Generations</h2>
                        </div>
                        <div className="card-body">
                            <div className="table-responsive">
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Time</th>
                                            <th>Agent</th>
                                            <th>Channel</th>
                                            <th>Format</th>
                                            <th>Templates</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {logs.map(log => (
                                            <tr key={log.id}>
                                                <td>{new Date(log.timestamp).toLocaleString()}</td>
                                                <td>{agentLabel(log.agent)}</td>
                                                <td>{log.channel}</td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        {isImageLog(log) ? <ImageIcon size={14} className="text-secondary" /> : <Type size={14} className="text-primary" />}
                                                        {isImageLog(log) ? 'Media' : 'Text'}
                                                    </div>
                                                </td>
                                                <td>{(log.usedTemplates || []).length} used</td>
                                                <td><button className="btn btn-secondary btn-sm" onClick={() => setSelectedLog(log)}>View Detailed Log</button></td>
                                            </tr>
                                        ))}
                                        {logs.length === 0 && <tr><td colSpan="5" className="text-center py-8">No logs available</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* LOG DETAIL VIEW */}
                {activeTab === 'logs' && selectedLog && (
                    <div className="glass-panel animate-fade-in p-6">
                        <div className="card-header">
                            <h2>Generation Log Details</h2>
                            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedLog(null)}>
                                <ArrowLeft size={14} /> Back to Logs
                            </button>
                        </div>
                        <div className="card-body space-y-4">
                            <div className="info-grid grid grid-cols-2 gap-4">
                                <div className="info-box"><strong>Time:</strong> {new Date(selectedLog.timestamp).toLocaleString()}</div>
                                <div className="info-box"><strong>Agent:</strong> {agentLabel(selectedLog.agent)}</div>
                                <div className="info-box"><strong>Channel:</strong> {selectedLog.channel}</div>
                                <div className="info-box"><strong>Tone:</strong> {selectedLog.tone}</div>
                            </div>

                            <div className="prompt-editor">
                                <label>System Prompt (Final)</label>
                                <textarea readOnly className="input-textarea h-40 font-mono text-xs opacity-60" value={selectedLog.systemPrompt} />
                            </div>

                            <div className="prompt-editor">
                                <label>Output Rendered</label>
                                {isImageLog(selectedLog) ? (
                                    <div className="image-preview-container bg-black/20 p-4 rounded-lg border border-white/5 flex justify-center">
                                        <img src={selectedLog.imageUrl} alt="Logged Image" style={{ maxWidth: '100%', borderRadius: '8px' }} />
                                    </div>
                                ) : (
                                    <div className="markdown-content bg-black/20 p-4 rounded-lg border border-white/5">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedLog.output}</ReactMarkdown>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

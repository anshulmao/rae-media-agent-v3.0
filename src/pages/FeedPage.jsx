import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import html2pdf from 'html2pdf.js';
import { Type, Image as ImageIcon, CheckCircle2, Search, Filter, X, Download } from 'lucide-react';
import { api } from '../lib/api.js';
import './FeedPage.css';

export function FeedPage() {
    const [drafts, setDrafts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [selectedDraft, setSelectedDraft] = useState(null);
    const contentRef = useRef(null);

    useEffect(() => {
        fetchApprovedDrafts();
    }, []);

    const fetchApprovedDrafts = async () => {
        try {
            const res = await api.get('/api/drafts');
            const data = await res.json();
            // Only keep approved drafts
            const approvedDrafts = data.filter(d => d.status === 'approved');
            setDrafts(approvedDrafts);
        } catch (e) {
            console.error('Failed to fetch drafts for feed:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleExportPDF = () => {
        if (!contentRef.current || !selectedDraft) return;
        const opt = {
            margin: 10,
            filename: `tba-export-${selectedDraft.id}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(contentRef.current).save();
    };

    const handleExportWord = () => {
        if (!contentRef.current || !selectedDraft) return;
        const html = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head><meta charset='utf-8'><title>Export HTML to Word</title></head>
            <body>
                ${contentRef.current.innerHTML}
            </body>
            </html>
        `;
        const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tba-export-${selectedDraft.id}.doc`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const isImageDraft = (draft) => draft?.type === 'image' || draft?.imageUrl;

    const filteredDrafts = drafts.filter(draft => {
        const matchesType = filterType === 'all' ||
            (filterType === 'media' && isImageDraft(draft)) ||
            (filterType === 'text' && !isImageDraft(draft));
        const matchesSearch = draft.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            draft.author?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            draft.agent?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesType && matchesSearch;
    });

    return (
        <div className="feed-page animate-fade-in">
            <header className="page-header" style={{ marginBottom: '32px' }}>
                <h1 className="heading-gradient">Approved Content Feed</h1>
                <p className="subtitle">Discover ready-to-publish assets and communications.</p>
            </header>

            <div className="feed-controls glass-panel">
                <div className="search-bar">
                    <Search size={18} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search content, authors, or agents..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="filter-group">
                    <button
                        className={`filter-btn ${filterType === 'all' ? 'active' : ''}`}
                        onClick={() => setFilterType('all')}
                    >
                        <Filter size={16} /> All
                    </button>
                    <button
                        className={`filter-btn ${filterType === 'text' ? 'active' : ''}`}
                        onClick={() => setFilterType('text')}
                    >
                        <Type size={16} /> Text
                    </button>
                    <button
                        className={`filter-btn ${filterType === 'media' ? 'active' : ''}`}
                        onClick={() => setFilterType('media')}
                    >
                        <ImageIcon size={16} /> Media
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="feed-loading">
                    <div className="spinner"></div>
                    <p>Loading the feed...</p>
                </div>
            ) : filteredDrafts.length === 0 ? (
                <div className="empty-feed glass-panel">
                    <p>No approved content matches your criteria.</p>
                </div>
            ) : (
                <div className="feed-grid">
                    {filteredDrafts.map(draft => (
                        <div key={draft.id} className="feed-card glass-panel animate-slide-up">
                            <div className="feed-card-header">
                                <div className="feed-card-meta">
                                    <div className="feed-author-avatar">
                                        <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(draft.author)}&background=random`} alt={draft.author} />
                                    </div>
                                    <div className="meta-text">
                                        <span className="author-name">{draft.author}</span>
                                        <span className="publish-date">{new Date(draft.createdAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <div className="feed-badges">
                                    <span className="badge-agent">{draft.agent || 'Agent'}</span>
                                    <span style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                                        <CheckCircle2 size={12} /> Approved
                                    </span>
                                </div>
                            </div>

                            <div className="feed-card-content">
                                {isImageDraft(draft) ? (
                                    <div className="feed-media-container">
                                        <img src={draft.imageUrl} alt="Generated Asset" className="feed-image" />
                                    </div>
                                ) : (
                                    <div className="feed-text-preview markdown-content">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {draft.content?.length > 300 ? draft.content.substring(0, 300) + '...' : draft.content}
                                        </ReactMarkdown>
                                    </div>
                                )}
                            </div>

                            <div className="feed-card-footer">
                                <span className="channel-badge">{draft.channel}</span>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setSelectedDraft(draft)}
                                >
                                    Full View
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Full View Modal */}
            {selectedDraft && (
                <div className="modal-overlay" onClick={() => setSelectedDraft(null)}>
                    <div className="modal-container glass-panel animate-zoom-in" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-author-info">
                                <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(selectedDraft.author)}&background=random`} alt={selectedDraft.author} className="modal-avatar" />
                                <div>
                                    <h3>{selectedDraft.author}</h3>
                                    <span className="modal-date">{new Date(selectedDraft.createdAt).toLocaleString()}</span>
                                </div>
                            </div>
                            <button className="modal-close-btn" onClick={() => setSelectedDraft(null)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-content-body" ref={contentRef}>
                            {isImageDraft(selectedDraft) ? (
                                <div className="modal-media">
                                    <img src={selectedDraft.imageUrl} alt="Full Resolution Asset" />
                                </div>
                            ) : (
                                <div className="modal-text markdown-content">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {selectedDraft.content}
                                    </ReactMarkdown>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <div className="modal-meta-badges">
                                <span className="badge-agent">{selectedDraft.agent}</span>
                                <span className="channel-badge">{selectedDraft.channel}</span>
                            </div>
                            <div className="modal-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <button className="btn btn-secondary btn-sm" onClick={handleExportWord} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Download size={14} /> Word
                                </button>
                                <button className="btn btn-secondary btn-sm" onClick={handleExportPDF} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Download size={14} /> PDF
                                </button>
                                <div className="modal-status" style={{ marginLeft: '12px' }}>
                                    <CheckCircle2 size={16} className="text-success" />
                                    <span className="text-success">Verified Approved</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

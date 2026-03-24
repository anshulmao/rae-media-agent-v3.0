import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, CheckCircle2, ChevronDown, ChevronUp, RefreshCw, FileText, Plus, X, Sparkles, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useApp } from '../context/AppContext';
import { api } from '../lib/api.js';
import './QAPage.css';

export function QAPage() {
    const [file, setFile] = useState(null);
    // results: Array of { question, userDraft: '', variations: [], status: 'draft'|'pending'|'approved', selectedIndex: null, customEdits: [] }
    const [results, setResults] = useState([]); 
    const [isGenerating, setIsGenerating] = useState(false);
    const [expandedIndex, setExpandedIndex] = useState(0);

    const [allTemplates, setAllTemplates] = useState([]);
    const [selectedTemplates, setSelectedTemplates] = useState([]);
    const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
    const navigate = useNavigate();

    const fileInputRef = useRef(null);
    const addMenuRef = useRef(null);

    useEffect(() => {
        const fetchTemplates = async () => {
            try {
                const res = await api.get('/api/templates');
                const data = await res.json();
                setAllTemplates(data || []);
            } catch (err) { console.error(err); }
        };
        fetchTemplates();
    }, []);

    // Close template menu on outside click
    useEffect(() => {
        const handler = (e) => {
            if (addMenuRef.current && !addMenuRef.current.contains(e.target)) {
                setShowTemplateDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const toggleTemplate = (template) => {
        if (selectedTemplates.find(t => t.id === template.id)) {
            setSelectedTemplates(selectedTemplates.filter(t => t.id !== template.id));
        } else {
            setSelectedTemplates([...selectedTemplates, template]);
        }
    };

    const handleFileUpload = (e) => {
        const uploadedFile = e.target.files?.[0];
        if (!uploadedFile) return;

        setFile(uploadedFile);
        const reader = new FileReader();
        reader.onload = (evt) => {
            const text = evt.target.result;
            const parsedQuestions = text.split(/\n\s*\n|\n/).map(q => q.trim()).filter(q => q.length > 0);
            
            // Immediately populate results in 'draft' state
            const initialDrafts = parsedQuestions.map(q => ({
                question: q,
                userDraft: '',
                variations: [],
                status: 'draft',
                selectedIndex: null,
                customEdits: []
            }));
            
            setResults(initialDrafts);
            if (initialDrafts.length > 0) setExpandedIndex(0);
        };
        reader.readAsText(uploadedFile);
    };

    const handleDraftChange = (index, value) => {
        const newResults = [...results];
        newResults[index].userDraft = value;
        setResults(newResults);
    };

    const generateVariations = async () => {
        if (results.length === 0) return;
        setIsGenerating(true);

        // Send all questions and their current user drafts
        const itemsPayload = results.map(r => ({
            question: r.question,
            draft: r.userDraft
        }));

        try {
            const res = await api.post('/api/generate-qa', {
                    items: itemsPayload,
                    language: 'en',
                    tone: 'professional',
                    model: 'gemini-3-flash-preview',
                    linkedTemplates: selectedTemplates.map(t => t.id)
                });
            const data = await res.json();
            if (data.success) {
                // Merge variations back into results and update status
                const newResults = [...results].map((r, i) => {
                    const matchedGen = data.results.find(gen => gen.question === r.question);
                    const parsedVariations = matchedGen ? matchedGen.variations : [];
                    return {
                        ...r,
                        status: 'pending',
                        variations: parsedVariations,
                        customEdits: [...parsedVariations]
                    };
                });
                setResults(newResults);
                if (newResults.length > 0) setExpandedIndex(0);
            } else {
                alert('Generation failed: ' + data.error);
            }
        } catch (error) {
            console.error(error);
            alert('Failed to connect to generation server.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSelectVariation = (qIndex, vIndex) => {
        const newResults = [...results];
        newResults[qIndex].selectedIndex = vIndex;
        setResults(newResults);
    };

    const handleEditVariation = (qIndex, vIndex, newText) => {
        const newResults = [...results];
        newResults[qIndex].customEdits[vIndex] = newText;
        setResults(newResults);
    };

    const handleApprove = (qIndex) => {
        const item = results[qIndex];
        if (item.selectedIndex === null) return;

        const newResults = [...results];
        newResults[qIndex].status = 'approved';
        setResults(newResults);

        // Auto-expand next pending question
        const nextPending = newResults.findIndex(r => r.status === 'pending');
        if (nextPending !== -1) {
            setExpandedIndex(nextPending);
        } else {
            setExpandedIndex(-1); // Close all when fully done
        }
    };

    const handlePublishAll = async () => {
        const allApproved = results.every(r => r.status === 'approved');
        if (!allApproved) return;

        let combinedContent = '# Approved Q&A Responses\n\n';
        results.forEach((item, idx) => {
            combinedContent += `### Q${idx + 1}: ${item.question}\n\n**Response:**\n\n${item.customEdits[item.selectedIndex]}\n\n---\n\n`;
        });

        try {
            await api.post('/api/drafts', {
                    content: combinedContent,
                    agent: 'qa-agent',
                    channel: 'Q&A Document',
                    tone: 'professional',
                    language: 'en',
                    type: 'text'
                });
            navigate('/feed');
        } catch (e) {
            console.error('Publish failed', e);
        }
    };

    return (
        <div className="qa-page animate-fade-in">
            <header className="page-header" style={{ marginBottom: '32px' }}>
                <h1 className="heading-gradient">Q&A Knowledge Agent</h1>
                <p className="subtitle">Upload a list of questions, select variations, and approve approved answers for your feed.</p>
            </header>

            {!file && (
                <div className="upload-container glass-panel" onClick={() => fileInputRef.current.click()}>
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept=".txt,.md"
                        onChange={handleFileUpload}
                    />
                    <UploadCloud size={48} className="upload-icon" />
                    <h2>Upload Question File</h2>
                    <p>Select a <b>.txt</b> or <b>.md</b> file with one question per line.</p>
                </div>
            )}

            {file && results.some(r => r.status === 'draft') && !isGenerating && (
                <div className="glass-panel summary-container" style={{ marginBottom: '24px' }}>
                    <div className="file-summary">
                        <FileText size={24} className="text-primary" />
                        <div>
                            <h3>{file.name}</h3>
                            <p>{results.length} questions detected. Add initial notes before generating.</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <button className="btn btn-primary" onClick={generateVariations}>
                            <RefreshCw size={16} /> Generate Variations
                        </button>

                        <div className="template-selector" ref={addMenuRef} style={{ position: 'relative' }}>
                            <button className="btn btn-secondary" onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}>
                                <Plus size={16} /> Link Knowledge Template
                            </button>
                            {showTemplateDropdown && (
                                <div className="dropdown-menu glass-panel" style={{ position: 'absolute', top: '100%', left: 0, marginTop: '8px', zIndex: 10, width: '250px' }}>
                                    {allTemplates.filter(t => !t.isGlobal && t.category !== 'required').map(t => {
                                        const isSelected = selectedTemplates.find(st => st.id === t.id);
                                        return (
                                            <div key={t.id} className="dropdown-item" onClick={() => toggleTemplate(t)} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', cursor: 'pointer' }}>
                                                <span>{t.name}</span>
                                                {isSelected && <CheckCircle2 size={16} className="text-primary" />}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        <button className="btn btn-secondary" onClick={() => { setFile(null); setResults([]); }}>
                            Cancel
                        </button>
                    </div>
                    {selectedTemplates.length > 0 && (
                        <div className="selected-templates-pills" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
                            {selectedTemplates.map(t => (
                                <span key={t.id} className="template-pill" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(99, 102, 241, 0.15)', padding: '4px 12px', borderRadius: '16px', fontSize: '0.85rem', color: 'var(--color-primary)' }}>
                                    {t.name} <X size={14} style={{ cursor: 'pointer' }} onClick={() => toggleTemplate(t)} />
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {isGenerating && (
                <div className="generating-overlay glass-panel">
                    <div className="spinner"></div>
                    <p>Generating 3 variations per question...</p>
                </div>
            )}

            {results.length > 0 && (
                <div className="qa-results-container">
                    <div className="qa-overall-progress">
                        <div className="progress-bar-container">
                            <div
                                className="progress-bar-fill"
                                style={{ width: `${(results.filter(r => r.status === 'approved').length / results.length) * 100}%` }}
                            ></div>
                        </div>
                        <p>{results.filter(r => r.status === 'approved').length} of {results.length} approved</p>
                    </div>

                    {results.map((resItem, qIndex) => {
                        const isExpanded = expandedIndex === qIndex;
                        const isApproved = resItem.status === 'approved';

                        return (
                            <div key={qIndex} className={`qa-accordion glass-panel ${isApproved ? 'approved' : ''}`}>
                                <div
                                    className="qa-accordion-header"
                                    onClick={() => setExpandedIndex(isExpanded ? -1 : qIndex)}
                                >
                                    <div className="qa-accordion-title">
                                        {isApproved ? <CheckCircle2 size={18} className="text-success" /> : <div className="q-number">{qIndex + 1}</div>}
                                        <h3 className={isApproved ? 'text-subtle' : ''}>{resItem.question}</h3>
                                    </div>
                                    <div className="qa-accordion-toggle">
                                        {isApproved ? <span className="status-badge success">Approved</span> : null}
                                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="qa-accordion-body">
                                        {isApproved ? (
                                            <div className="approved-view">
                                                <p className="text-muted mb-2">Selected response has been sent to drafting/feed.</p>
                                                <div className="markdown-content">
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                        {resItem.customEdits[resItem.selectedIndex]}
                                                    </ReactMarkdown>
                                                </div>
                                            </div>
                                        ) : resItem.status === 'draft' ? (
                                            <div className="draft-view">
                                                <p className="text-muted mb-2">Optional: Add your own draft answer or talking points below to guide the AI generation.</p>
                                                <textarea
                                                    className="edit-textarea"
                                                    placeholder="e.g., Mention our Q3 growth numbers and pivot to sustainability..."
                                                    value={resItem.userDraft}
                                                    onChange={(e) => handleDraftChange(qIndex, e.target.value)}
                                                    style={{ minHeight: '120px' }}
                                                />
                                            </div>
                                        ) : (
                                            <div className="variations-grid">
                                                {resItem.variations.map((variation, vIndex) => (
                                                    <div
                                                        key={vIndex}
                                                        className={`variation-card ${resItem.selectedIndex === vIndex ? 'selected' : ''}`}
                                                        onClick={() => handleSelectVariation(qIndex, vIndex)}
                                                    >
                                                        <div className="variation-header">
                                                            <h4>Variation {vIndex + 1}</h4>
                                                            <div className="radio-circle"></div>
                                                        </div>
                                                        <div className="variation-content" onClick={(e) => e.stopPropagation()}>
                                                            {resItem.selectedIndex === vIndex ? (
                                                                <textarea
                                                                    className="edit-textarea"
                                                                    value={resItem.customEdits[vIndex]}
                                                                    onChange={(e) => handleEditVariation(qIndex, vIndex, e.target.value)}
                                                                />
                                                            ) : (
                                                                <div className="markdown-content text-sm">
                                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                                        {variation}
                                                                    </ReactMarkdown>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {resItem.status === 'pending' && (
                                            <div className="qa-actions">
                                                <button
                                                    className="btn btn-primary"
                                                    disabled={resItem.selectedIndex === null}
                                                    onClick={() => handleApprove(qIndex)}
                                                >
                                                    <CheckCircle2 size={16} /> Approve & Continue
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {results.length > 0 && results.every(r => r.status === 'approved') && (
                <div className="publish-all-container" style={{ marginTop: '32px', display: 'flex', justifyContent: 'center' }}>
                    <button className="btn btn-primary btn-lg shine-effect" onClick={handlePublishAll}>
                        <Send size={20} style={{ marginRight: '8px' }} /> Publish All Answers to Feed
                    </button>
                </div>
            )}
        </div>
    );
}

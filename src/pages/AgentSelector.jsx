import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Linkedin, MessageCircle, FileText, Mail, Globe, Sparkles, Send, ListChecks, Plus } from 'lucide-react'
import { api } from '../lib/api.js'
import './AgentSelector.css'

const ICON_MAP = {
    'linkedin': Linkedin,
    'whatsapp': MessageCircle,
    'press-release': FileText,
    'internal-email': Mail,
    'website-copy': Globe,
    'qa-agent': ListChecks,
    'custom': Sparkles
}

const COLOR_MAP = {
    'linkedin': '#0064DC',
    'whatsapp': '#1849d6',
    'press-release': '#001871',
    'internal-email': '#495AFF',
    'website-copy': '#0064DC',
    'qa-agent': '#001871',
    'custom': '#495AFF'
}

// Static fallback agents (always shown)
const staticAgents = [
    { id: 'qa-agent', name: 'Media Q&A Agent', description: 'Upload media question batches to generate multi-variant suggested responses', category: 'Core: Media Responses' },
    { id: 'linkedin', name: 'LinkedIn Post', description: 'Turn industry news into thought-leadership content', category: 'Secondary Agents' },
    { id: 'whatsapp', name: 'WhatsApp Broadcast', description: 'Draft concise updates for messaging platforms', category: 'Secondary Agents' },
    { id: 'press-release', name: 'Press Release', description: 'Formal announcements for external media', category: 'Secondary Agents' },
    { id: 'internal-email', name: 'Internal Email', description: 'Company-wide updates and employee newsletters', category: 'Secondary Agents' },
    { id: 'website-copy', name: 'Website Copy', description: 'Engaging landing page content and product descriptions', category: 'Secondary Agents' },
    { id: 'custom', name: 'Custom Request', description: 'Start with a blank slate for any format', category: 'Secondary Agents' }
]

export function AgentSelector() {
    const navigate = useNavigate()
    const [activeCategory, setActiveCategory] = useState('Core: Media Responses')
    const [promptInput, setPromptInput] = useState('')
    const [dynamicAgents, setDynamicAgents] = useState([])
    const [suggestions, setSuggestions] = useState([])
    const [showAllSuggestions, setShowAllSuggestions] = useState(false)

    const categories = ['Core: Media Responses', 'Secondary Agents']

    useEffect(() => {
        fetchAgentTemplates()
    }, [])

    const fetchAgentTemplates = async () => {
        try {
            const res = await api.get('/api/templates')
            const templates = await res.json()
            // Templates assigned to agents become selectable agent cards
            const agentTemplates = templates
                .filter(t => t.category === 'agent' && t.assignedAgents && t.assignedAgents.length > 0)
                .map(t => ({
                    id: t.assignedAgents[0],
                    name: t.name,
                    description: t.description,
                    category: 'Secondary Agents'
                }))
            setDynamicAgents(agentTemplates)
        } catch (e) { console.error(e) }
    }

    // Merge static + dynamic, deduplicate by id
    const allAgents = [...staticAgents]
    for (const da of dynamicAgents) {
        if (!allAgents.find(a => a.id === da.id)) {
            allAgents.push(da)
        }
    }

    const filteredAgents = allAgents.filter(a => a.category === activeCategory)

    const detectAgent = (text) => {
        const lowered = text.toLowerCase()
        const matches = []

        if (lowered.includes('linkedin') || lowered.includes('post')) matches.push('linkedin')
        if (lowered.includes('whatsapp') || lowered.includes('message')) matches.push('whatsapp')
        if (lowered.includes('press release') || lowered.includes('announcement')) matches.push('press-release')
        if (lowered.includes('email') || lowered.includes('newsletter')) matches.push('internal-email')
        if (lowered.includes('website') || lowered.includes('landing') || lowered.includes('copy')) matches.push('website-copy')
        if (lowered.includes('qa') || lowered.includes('media') || lowered.includes('question')) matches.push('qa-agent')

        return matches
    }

    const handleSelectAgent = (agentId) => {
        if (agentId === 'qa-agent') {
            navigate('/creator/qa');
        } else {
            navigate(`/creator/generate?agent=${agentId}`);
        }
    }

    const handleInputChange = (e) => {
        const val = e.target.value;
        setPromptInput(val);
        
        if (val.trim() === '') {
            setSuggestions([]);
            setShowAllSuggestions(false);
            return;
        }

        const lowered = val.toLowerCase();
        const searchMatches = allAgents.filter(a =>
            a.name.toLowerCase().includes(lowered) ||
            a.description.toLowerCase().includes(lowered)
        ).map(a => a.id);

        const detectMatches = detectAgent(val);
        const combined = [...new Set([...detectMatches, ...searchMatches])];

        if (combined.length > 0) {
            if (combined.includes('qa-agent')) {
                combined.splice(combined.indexOf('qa-agent'), 1);
                combined.unshift('qa-agent');
            }
            setSuggestions(combined);
        } else {
            setSuggestions([]);
        }
    }

    const handlePromptSubmit = () => {
        const matches = detectAgent(promptInput)

        if (matches.length === 1 && promptInput.trim()) {
            if (matches[0] === 'qa-agent') {
                navigate('/creator/qa');
            } else {
                navigate(`/creator/generate?agent=${matches[0]}&prompt=${encodeURIComponent(promptInput)}&auto=true`);
            }
        } else {
            // Ambiguous or no match - show suggestions
            let defaults = allAgents.map(a => a.id);
            if (defaults.includes('qa-agent')) {
                defaults.splice(defaults.indexOf('qa-agent'), 1);
                defaults.unshift('qa-agent');
            }
            let toShow = matches.length > 0 ? matches : defaults;
            
            // If already showing suggestions from the search logic, combine them
            if (suggestions.length > 0) {
                toShow = [...new Set([...suggestions, ...toShow])];
            } else {
                toShow = [...new Set(toShow)];
            }
            
            if (toShow.includes('qa-agent')) {
                toShow.splice(toShow.indexOf('qa-agent'), 1);
                toShow.unshift('qa-agent');
            }
            
            setSuggestions(toShow)
            setShowAllSuggestions(false)
        }
    }

    const handleConfirmAgent = (agentId) => {
        if (agentId === 'qa-agent') {
            navigate('/creator/qa');
        } else {
            navigate(`/creator/generate?agent=${agentId}&prompt=${encodeURIComponent(promptInput)}&auto=true`);
        }
    }

    const coreAgent = allAgents.find(a => a.id === 'qa-agent')
    const secondaryAgents = allAgents.filter(a => a.id !== 'qa-agent')

    return (
        <div className="agent-selector-page animate-fade-in">
            <div className="selector-header">
                <h1 className="heading-gradient">What can Rae help you with?</h1>
                <p className="selector-subtitle">Choose an agent below or describe your task in the prompt bar</p>
            </div>

            {/* ── Primary / Featured Agent ── */}
            {coreAgent && (
                <div className="featured-section">
                    <span className="section-heading">Primary Agent</span>
                    <div
                        className="featured-agent-card"
                        onClick={() => handleSelectAgent(coreAgent.id)}
                    >
                        <div className="featured-agent-left">
                            <div className="featured-icon-wrapper">
                                <ListChecks size={28} color="#fff" />
                            </div>
                            <div>
                                <div className="featured-agent-label">CORE · MEDIA RESPONSES</div>
                                <h2 className="featured-agent-name">{coreAgent.name}</h2>
                                <p className="featured-agent-desc">{coreAgent.description}</p>
                            </div>
                        </div>
                        <button className="featured-cta">Start →</button>
                    </div>
                </div>
            )}

            {/* ── Secondary Agents ── */}
            <div className="secondary-section">
                <span className="section-heading">Content Agents</span>
                <div className="agents-grid">
                    {secondaryAgents.map(agent => {
                        const Icon = ICON_MAP[agent.id] || FileText
                        const color = COLOR_MAP[agent.id] || '#0064DC'
                        return (
                            <div
                                key={agent.id}
                                className="agent-card glass-panel"
                                onClick={() => handleSelectAgent(agent.id)}
                            >
                                <div className="agent-icon-wrapper" style={{ background: `${color}12` }}>
                                    <Icon size={22} color={color} />
                                </div>
                                <h3 className="agent-name">{agent.name}</h3>
                                <p className="agent-description">{agent.description}</p>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* ── Floating Prompt ── */}
            <div className={`floating-prompt-box glass-panel ${suggestions.length > 0 ? 'has-suggestions' : ''}`}>
                {suggestions.length > 0 && (
                    <div className="suggestion-bubble animate-slide-up">
                        <p className="suggestion-title">Which agent should handle this?</p>
                        <div className="suggestion-list">
                            {(showAllSuggestions ? suggestions : suggestions.slice(0, 4)).map(id => {
                                const agent = allAgents.find(a => a.id === id) || { name: id.charAt(0).toUpperCase() + id.slice(1) }
                                return (
                                    <button key={id} className="suggestion-chip" onClick={() => handleConfirmAgent(id)}>
                                        {agent.name}
                                    </button>
                                )
                            })}
                            {!showAllSuggestions && suggestions.length > 4 && (
                                <button className="suggestion-chip suggestion-add-btn" onClick={() => setShowAllSuggestions(true)} title="Show all agents">
                                    <Plus size={16} />
                                </button>
                            )}
                            <button className="suggestion-chip secondary" onClick={() => { setSuggestions([]); setShowAllSuggestions(false); }}>
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
                <div className="prompt-input-wrapper">
                    <input
                        type="text"
                        placeholder="Describe what you want the agent to do..."
                        value={promptInput}
                        onChange={handleInputChange}
                        onKeyDown={(e) => e.key === 'Enter' && handlePromptSubmit()}
                    />
                    <button className="icon-btn prompt-submit-btn" onClick={handlePromptSubmit}>
                        <Send size={18} />
                    </button>
                </div>
            </div>
        </div>
    )
}

import React, { createContext, useContext, useState } from 'react'

const AppContext = createContext()

export function AppProvider({ children }) {
    const [submissions, setSubmissions] = useState([
        { id: 1, author: 'Sarah Jenkins', type: 'LinkedIn Post', time: '10 mins ago', status: 'Pending' },
        { id: 2, author: 'Mark Chen', type: 'Press Release', time: '1 hour ago', status: 'Pending' }
    ])

    const [metrics, setMetrics] = useState({
        compliance: '98%',
        timeSaved: '1,240',
        files: 342,
        pending: 2
    })

    const addSubmission = (submission) => {
        setSubmissions([submission, ...submissions])
        setMetrics(prev => ({ ...prev, pending: prev.pending + 1 }))
    }

    const updateSubmissionStatus = (id, newStatus) => {
        setSubmissions(submissions.map(s =>
            s.id === id ? { ...s, status: newStatus } : s
        ))
        if (newStatus !== 'Pending') {
            setMetrics(prev => ({ ...prev, pending: prev.pending - 1 }))
        }
    }

    return (
        <AppContext.Provider value={{ submissions, addSubmission, updateSubmissionStatus, metrics, setMetrics }}>
            {children}
        </AppContext.Provider>
    )
}

export function useApp() {
    return useContext(AppContext)
}

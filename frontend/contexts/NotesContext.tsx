/**
 * Notes Context
 * 
 * Manages notes data and operations including fetching, searching, and deleting notes.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { API_URL } from '../config/api';

// Types
export interface NoteFormula {
    latex: string;
    description?: string;
}

export interface NoteSection {
    title?: string;
    content: string;
    level?: number;
}

export interface StructuredContent {
    title: string;
    sections: NoteSection[];
    definitions: { term: string; definition: string }[];
    examples: string[];
    formulas: NoteFormula[];
    key_concepts: string[];
}

export interface Note {
    id: string;
    title: string;
    subject: string;
    preview?: string;
    raw_text: string;
    summary?: string;
    created_at: string;
    thumbnail_url?: string;
    processed_content?: StructuredContent;
    latex_formulas?: { latex: string; description?: string }[];
}

interface NotesContextType {
    notes: Note[];
    currentNote: Note | null;
    isLoading: boolean;
    error: string | null;
    fetchNotes: () => Promise<void>;
    fetchNote: (id: string) => Promise<void>;
    deleteNote: (id: string) => Promise<void>;
    searchNotes: (query: string) => Promise<void>;
}

// Context
const NotesContext = createContext<NotesContextType>({
    notes: [], 
    currentNote: null, 
    isLoading: false, 
    error: null,
    fetchNotes: async () => {}, 
    fetchNote: async () => {},
    deleteNote: async () => {}, 
    searchNotes: async () => {},
});

// Hook
export const useNotes = () => useContext(NotesContext);

// Provider
export const NotesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { auth, authFetch } = useAuth();
    const [notes, setNotes] = useState<Note[]>([]);
    const [currentNote, setCurrentNote] = useState<Note | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Clear notes when user changes (token change = different user)
    useEffect(() => {
        if (!auth.isAuthenticated) {
            setNotes([]);
            setCurrentNote(null);
        }
    }, [auth.isAuthenticated]);

    const fetchNotes = useCallback(async () => {
        if (!auth.token) return;
        setIsLoading(true);

        try {
            const res = await authFetch(`${API_URL}/notes`);
            if (res.ok) {
                const data = await res.json();
                setNotes(data);
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    }, [auth.token, authFetch]);

    const fetchNote = useCallback(async (id: string) => {
        if (!auth.token) return;
        setIsLoading(true);
        try {
            const res = await authFetch(`${API_URL}/notes/${id}`);
            if (res.ok) setCurrentNote(await res.json());
            else setError('Note non trouvée');
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    }, [auth.token, authFetch]);

    const deleteNote = useCallback(async (id: string) => {
        if (!auth.token) return;

        try {
            const res = await authFetch(`${API_URL}/notes/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
            setNotes(prev => prev.filter(n => n.id !== id));
        } catch (e: any) {
            setError(e.message);
        }
    }, [auth.token, authFetch]);

    const searchNotes = useCallback(async (query: string) => {
        if (!auth.token) return;

        try {
            const res = await authFetch(`${API_URL}/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query }),
            });

            if (res.ok) {
                const data = await res.json();
                setNotes(data.notes || []);
            }
        } catch (e: any) {
            setError(e.message);
        }
    }, [auth.token, authFetch]);

    // Auto-fetch notes when authenticated
    useEffect(() => {
        if (auth.isAuthenticated) fetchNotes();
    }, [auth.isAuthenticated, fetchNotes]);

    return (
        <NotesContext.Provider value={{ 
            notes, 
            currentNote, 
            isLoading, 
            error, 
            fetchNotes, 
            fetchNote, 
            deleteNote, 
            searchNotes 
        }}>
            {children}
        </NotesContext.Provider>
    );
};

import React, { createContext, useContext, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { API_URL } from '../config/api';

export interface Subject {
    id: string;
    user_id: string;
    name: string;
    color: string;
    icon: string;
    created_at: string;
    updated_at: string;
}

interface SubjectsContextType {
    subjects: Subject[];
    isLoading: boolean;
    fetchSubjects: () => Promise<void>;
    createSubject: (name: string, color: string, icon: string) => Promise<Subject>;
    updateSubject: (id: string, patch: Partial<Pick<Subject, 'name' | 'color' | 'icon'>>) => Promise<Subject>;
    deleteSubject: (id: string) => Promise<{ deleted: boolean; notes_transferred: number }>;
    changeNoteSubject: (noteId: string, subjectId: string) => Promise<void>;
}

const SubjectsContext = createContext<SubjectsContextType>({
    subjects: [],
    isLoading: false,
    fetchSubjects: async () => {},
    createSubject: async () => { throw new Error('not ready'); },
    updateSubject: async () => { throw new Error('not ready'); },
    deleteSubject: async () => { throw new Error('not ready'); },
    changeNoteSubject: async () => {},
});

export function SubjectsProvider({ children }: { children: React.ReactNode }) {
    const { token } = useAuth();
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const headers = useCallback(
        () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
        [token],
    );

    const fetchSubjects = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/v1/subjects`, { headers: headers() });
            if (res.ok) setSubjects(await res.json());
        } finally {
            setIsLoading(false);
        }
    }, [token, headers]);

    const createSubject = useCallback(async (name: string, color: string, icon: string): Promise<Subject> => {
        const res = await fetch(`${API_URL}/api/v1/subjects`, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({ name, color, icon }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail ?? `HTTP ${res.status}`);
        }
        const created: Subject = await res.json();
        setSubjects(prev => [...prev, created]);
        return created;
    }, [headers]);

    const updateSubject = useCallback(async (
        id: string,
        patch: Partial<Pick<Subject, 'name' | 'color' | 'icon'>>,
    ): Promise<Subject> => {
        const res = await fetch(`${API_URL}/api/v1/subjects/${id}`, {
            method: 'PATCH',
            headers: headers(),
            body: JSON.stringify(patch),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail ?? `HTTP ${res.status}`);
        }
        const updated: Subject = await res.json();
        setSubjects(prev => prev.map(s => (s.id === id ? updated : s)));
        return updated;
    }, [headers]);

    const deleteSubject = useCallback(async (id: string) => {
        const res = await fetch(`${API_URL}/api/v1/subjects/${id}`, {
            method: 'DELETE',
            headers: headers(),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail ?? `HTTP ${res.status}`);
        }
        const result = await res.json();
        setSubjects(prev => prev.filter(s => s.id !== id));
        return result as { deleted: boolean; notes_transferred: number };
    }, [headers]);

    const changeNoteSubject = useCallback(async (noteId: string, subjectId: string) => {
        const res = await fetch(`${API_URL}/api/v1/notes/${noteId}/subject`, {
            method: 'PATCH',
            headers: headers(),
            body: JSON.stringify({ subject_id: subjectId }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail ?? `HTTP ${res.status}`);
        }
    }, [headers]);

    return (
        <SubjectsContext.Provider value={{ subjects, isLoading, fetchSubjects, createSubject, updateSubject, deleteSubject, changeNoteSubject }}>
            {children}
        </SubjectsContext.Provider>
    );
}

export function useSubjects() {
    return useContext(SubjectsContext);
}

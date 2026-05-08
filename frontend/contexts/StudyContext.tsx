import React, { createContext, useContext, useState } from 'react';

export interface QuizQuestion { id: string; type: string; question: string;
    options?: string[]; correct_answer: string; explanation: string;
    difficulty: string; related_concept?: string; points: number; }
export interface Quiz { id: string; note_id: string; title: string;
    questions: QuizQuestion[]; total_points: number; estimated_time: number; }
export interface Flashcard { id: string; note_id: string; front: string;
    back: string; difficulty: string; tags: string[];
    last_reviewed?: string; next_review?: string;
    review_count: number; mastery_level: number; }

interface StudyContextType {
    currentQuiz: Quiz | null;
    setCurrentQuiz: (quiz: Quiz | null) => void;
    currentFlashcards: Flashcard[];
    setCurrentFlashcards: (cards: Flashcard[]) => void;
}

const StudyContext = createContext<StudyContextType>({
    currentQuiz: null, setCurrentQuiz: () => { },
    currentFlashcards: [], setCurrentFlashcards: () => { },
});

export const useStudy = () => useContext(StudyContext);

export const StudyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentQuiz, setCurrentQuiz] = useState<Quiz | null>(null);
    const [currentFlashcards, setCurrentFlashcards] = useState<Flashcard[]>([]);

    return (
        <StudyContext.Provider value={{ currentQuiz, setCurrentQuiz, currentFlashcards, setCurrentFlashcards }}>
            {children}
        </StudyContext.Provider>
    );
};

import React, { createContext, useContext, useState } from 'react';

interface StudyContextType {
    currentQuiz: any | null;
    setCurrentQuiz: (quiz: any) => void;
    currentFlashcards: any[];
    setCurrentFlashcards: (cards: any[]) => void;
}

const StudyContext = createContext<StudyContextType>({
    currentQuiz: null, setCurrentQuiz: () => { },
    currentFlashcards: [], setCurrentFlashcards: () => { },
});

export const useStudy = () => useContext(StudyContext);

export const StudyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentQuiz, setCurrentQuiz] = useState<any | null>(null);
    const [currentFlashcards, setCurrentFlashcards] = useState<any[]>([]);

    return (
        <StudyContext.Provider value={{ currentQuiz, setCurrentQuiz, currentFlashcards, setCurrentFlashcards }}>
            {children}
        </StudyContext.Provider>
    );
};

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

// ----------------------------------------------------------------------

type NavigationContextType = {
    hiddenTabs: string[];
    hideTab: (title: string) => void;
    showTab: (title: string) => void;
    resetTabs: () => void;
};

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const useNavigationContext = () => {
    const context = useContext(NavigationContext);
    if (!context) {
        throw new Error('useNavigationContext must be used within a NavigationProvider');
    }
    return context;
};

type Props = {
    children: React.ReactNode;
};

const STORAGE_KEY = 'navigation-hidden-tabs';

export function NavigationProvider({ children }: Props) {
    const [hiddenTabs, setHiddenTabs] = useState<string[]>(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    });

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(hiddenTabs));
    }, [hiddenTabs]);

    const hideTab = useCallback((title: string) => {
        setHiddenTabs((prev) => {
            if (prev.includes(title)) return prev;
            return [...prev, title];
        });
    }, []);

    const showTab = useCallback((title: string) => {
        setHiddenTabs((prev) => prev.filter((tab) => tab !== title));
    }, []);

    const resetTabs = useCallback(() => {
        setHiddenTabs([]);
    }, []);

    const memoizedValue = useMemo(
        () => ({
            hiddenTabs,
            hideTab,
            showTab,
            resetTabs,
        }),
        [hiddenTabs, hideTab, showTab, resetTabs]
    );

    return <NavigationContext.Provider value={memoizedValue}>{children}</NavigationContext.Provider>;
}

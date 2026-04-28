import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [workshop, setWorkshop] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('filter_auth_token'));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Initialize user from localStorage if token exists
        const storedUser = localStorage.getItem('filter_auth_user');
        const storedWorkshop = localStorage.getItem('filter_auth_workshop');
        if (token && storedUser) {
            try {
                setUser(JSON.parse(storedUser));
                if (storedWorkshop) {
                    setWorkshop(JSON.parse(storedWorkshop));
                }
            } catch (err) {
                console.error('Failed to parse admin_user from localStorage', err);
                setUser(null);
                setWorkshop(null);
                setToken(null);
                localStorage.removeItem('filter_auth_token');
                localStorage.removeItem('filter_auth_user');
                localStorage.removeItem('filter_auth_workshop');
            }
        } else if (token || storedUser) {
            // Partial session data - clear everything
            setUser(null);
            setWorkshop(null);
            setToken(null);
            localStorage.removeItem('filter_auth_token');
            localStorage.removeItem('filter_auth_user');
            localStorage.removeItem('filter_auth_workshop');
        }
        setLoading(false);
    }, [token]);

    const login = (userData, userToken, sessionMeta = {}) => {
        setUser(userData);
        setToken(userToken);
        const workshopData = sessionMeta?.workshop || null;
        setWorkshop(workshopData);
        localStorage.setItem('filter_auth_token', userToken);
        localStorage.setItem('filter_auth_user', JSON.stringify(userData));
        if (workshopData) {
            localStorage.setItem('filter_auth_workshop', JSON.stringify(workshopData));
        } else {
            localStorage.removeItem('filter_auth_workshop');
        }
    };

    const logout = () => {
        setUser(null);
        setWorkshop(null);
        setToken(null);
        localStorage.removeItem('filter_auth_token');
        localStorage.removeItem('filter_auth_user');
        localStorage.removeItem('filter_auth_workshop');
    };

    return (
        <AuthContext.Provider value={{ user, workshop, token, isAuthenticated: !!token, login, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

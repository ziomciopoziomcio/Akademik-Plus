import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { clearAuthToken } from '../api';
import './AppHeader.css';

const roleLinks = {
    mieszkaniec: [
        { to: '/dashboard', label: 'Panel mieszkańca' },
        { to: '/history', label: 'Historia płatności' },
    ],
    administrator: [
        { to: '/admin', label: 'Panel administratora' },
        { to: '/history', label: 'Rozliczenia' },
    ],
};

const AppHeader = ({ role, greeting }) => {
    const navigate = useNavigate();
    const location = useLocation();

    const links = useMemo(() => {
        const key = (role || '').toString().toLowerCase();
        return roleLinks[key] || roleLinks.mieszkaniec;
    }, [role]);

    const handleLogout = () => {
        clearAuthToken();
        sessionStorage.removeItem('userRole');
        navigate('/login', { replace: true });
    };

    return (
        <header className="app-header">
            <div className="app-header-brand">
                <h1 className="app-logo-text">Akademik+</h1>
                {greeting ? <h2 className="app-welcome-text">{greeting}</h2> : null}
            </div>
            <div className="app-header-actions">
                {links.map((link) => (
                    <button
                        key={link.to}
                        className={`secondary-btn ${location.pathname === link.to ? 'active' : ''}`}
                        onClick={() => navigate(link.to)}
                    >
                        {link.label}
                    </button>
                ))}
                <button className="secondary-btn" onClick={handleLogout}>Wyloguj</button>
            </div>
        </header>
    );
};

export default AppHeader;

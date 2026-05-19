import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';
import { apiFetch, readJsonOrText, setAuthToken } from '../api';

const decodeJwt = (token) => {
    try {
        const parts = token.split('.');
        if (parts.length < 2) return null;
        const payload = parts[1];
        const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
        return json;
    } catch {
        return null;
    }
};

const Login = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await apiFetch('/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const body = await readJsonOrText(res);
            if (!res.ok) {
                setError(typeof body === 'string' ? body : body?.error || `Status ${res.status}`);
                return;
            }

            if (!body?.token) {
                setError('Brak tokena w odpowiedzi');
                return;
            }

            setAuthToken(body.token);

            let role = body.rola || body.role || '';
            if (!role) {
                const claims = decodeJwt(body.token);
                role = claims?.rola || claims?.role || '';
            }

            if (role) {
                sessionStorage.setItem('userRole', role);
            }

            console.log('Zalogowano, token zapisany w sessionStorage.');

            const roleLower = role.toString().toLowerCase();
            if (roleLower.includes('admin')) {
                navigate('/admin', { replace: true });
            } else {
                navigate('/dashboard', { replace: true });
            }
        } catch (err) {
            console.error('Login error:', err);
            setError(err.message || 'Błąd logowania');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <h1 className="title">Akademik+</h1>
                <p className="subtitle">Zaloguj się do systemu</p>

                <form className="form" onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label htmlFor="email">Adres e-mail</label>
                        <input
                            type="email"
                            id="email"
                            placeholder="Podaj adres e-mail"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="input-group">
                        <label htmlFor="password">Hasło</label>
                        <input
                            type="password"
                            id="password"
                            placeholder="Podaj hasło"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    {error && <div className="error-message" role="alert">{error}</div>}

                    <button type="submit" className="submit-btn" disabled={loading}>
                        {loading ? 'Logowanie...' : 'Zaloguj się'}
                    </button>
                </form>

                <button type="button" className="reset-btn" onClick={() => navigate('/login') }>
                    Zresetuj hasło
                </button>
            </div>
        </div>
    );
};

export default Login;

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';
import roomImg from '../assets/room.png';
import { apiFetch, readJsonOrText, clearAuthToken } from '../api';

const mapPayment = (payment) => ({
    id: payment.numer_rachunku ?? payment.id ?? `${payment.data || payment.date}-${payment.opis || payment.desc}`,
    date: payment.data_wystawienia || payment.data || payment.date || '',
    desc: payment.okres_rozliczeniowy || payment.dodatkowe_uwagi || payment.opis || payment.desc || '',
    amount: Number(payment.kwota ?? payment.amount ?? 0),
    status: payment.czy_oplacone === true || payment.oplacone === true || payment.status === 'OPŁACONE' ? 'OPŁACONE' : 'NIEOPŁACONE',
});

const Dashboard = () => {
    const navigate = useNavigate();
    const [userData, setUserData] = useState({ name: 'Mieszkańcu' });
    const [payments, setPayments] = useState([]);
    const [billsMessage, setBillsMessage] = useState('');
    const [accommodation, setAccommodation] = useState(null);
    const [accommodationMessage, setAccommodationMessage] = useState('');
    const [faults, setFaults] = useState([]);
    const [faultForm, setFaultForm] = useState({ pokoj_id: '', priorytet: '', opis_usterki: '' });
    const [commentForm, setCommentForm] = useState({ faultId: '', tresc: '' });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let mounted = true;
        const loadFaults = async (pokojId) => {
            const faultsRes = await apiFetch(`/usterki/pokoj/${pokojId}`);
            if (!faultsRes.ok) {
                if (faultsRes.status === 404) {
                    if (mounted) setFaults([]);
                    return;
                }
                throw new Error('Nie udało się pobrać usterek.');
            }
            const faultsData = await readJsonOrText(faultsRes);
            const faultsItems = Array.isArray(faultsData) ? faultsData : faultsData?.items || [];
            if (mounted) setFaults(faultsItems);
        };

        const loadDashboard = async () => {
            setLoading(true);
            setError('');
            setBillsMessage('');
            setAccommodationMessage('');

            try {
                const [paymentsRes, residenceRes] = await Promise.all([
                    apiFetch('/rachunki/moje'),
                    apiFetch('/zakwaterowania/moje'),
                ]);

                if (paymentsRes.ok) {
                    const data = await readJsonOrText(paymentsRes);
                    const items = Array.isArray(data) ? data : data?.rachunki || data?.items || [];
                    if (mounted) {
                        setPayments(items.map(mapPayment));
                        if (!items.length) setBillsMessage('Brak aktywnych rachunków.');
                    }
                } else if (paymentsRes.status === 404) {
                    if (mounted) {
                        setPayments([]);
                        setBillsMessage('Brak aktywnych rachunków.');
                    }
                } else if (paymentsRes.status === 401 || paymentsRes.status === 403) {
                    if (mounted) setError('Brak dostępu do rachunków. Zaloguj się ponownie.');
                } else {
                    if (mounted) setError('Nie udało się pobrać rachunków.');
                }

                if (residenceRes.ok) {
                    const data = await readJsonOrText(residenceRes);
                    const item = Array.isArray(data) ? data[0] : data;
                    if (mounted && item) {
                        setAccommodation(item);
                        setUserData({ name: item.mieszkaniec_nazwa || 'Mieszkańcu' });
                        setFaultForm((prev) => ({
                            ...prev,
                            pokoj_id: String(item.pokoj_id || ''),
                        }));
                        if (item.pokoj_id) {
                            await loadFaults(item.pokoj_id);
                        }
                    }
                } else if (residenceRes.status === 404) {
                    if (mounted) {
                        setAccommodation(null);
                        setAccommodationMessage('Brak aktywnego zakwaterowania.');
                        setFaults([]);
                    }
                } else if (residenceRes.status === 401 || residenceRes.status === 403) {
                    if (mounted) setError((prev) => prev || 'Brak dostępu do historii zakwaterowań.');
                } else {
                    if (mounted) setError((prev) => prev || 'Błąd serwera przy pobieraniu zakwaterowania.');
                }
            } catch (err) {
                console.error('Dashboard load error:', err);
                if (mounted) setError('Nie udało się pobrać danych z API.');
            } finally {
                if (mounted) setLoading(false);
            }
        };

        loadDashboard();
        return () => { mounted = false; };
    }, []);

    const handleFaultSubmit = async (e) => {
        e.preventDefault();
        if (!faultForm.pokoj_id || !faultForm.priorytet || !faultForm.opis_usterki.trim()) {
            alert('Uzupełnij wszystkie pola zgłoszenia.');
            return;
        }
        try {
            const response = await apiFetch('/usterki', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pokoj_id: Number(faultForm.pokoj_id),
                    priorytet: faultForm.priorytet,
                    opis_usterki: faultForm.opis_usterki.trim(),
                }),
            });

            if (!response.ok) {
                const body = await readJsonOrText(response);
                alert(typeof body === 'string' ? body : body?.error || 'Nie udało się zgłosić usterki');
                return;
            }

            const createdFault = await readJsonOrText(response);
            setFaults((prev) => [createdFault, ...prev]);
            setFaultForm((prev) => ({ ...prev, priorytet: '', opis_usterki: '' }));
            alert('Usterka została zgłoszona.');
        } catch (err) {
            console.error('Fault submit error:', err);
            alert(err.message || 'Nie udało się zgłosić usterki');
        }
    };

    const handleCommentSubmit = async (e) => {
        e.preventDefault();
        if (!commentForm.faultId || !commentForm.tresc.trim()) {
            alert('Wybierz usterkę i wpisz komentarz.');
            return;
        }
        try {
            const response = await apiFetch(`/komentarze/usterka/${commentForm.faultId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tresc: commentForm.tresc.trim() }),
            });

            if (!response.ok) {
                const body = await readJsonOrText(response);
                alert(typeof body === 'string' ? body : body?.error || 'Nie udało się dodać komentarza');
                return;
            }
            setCommentForm({ faultId: '', tresc: '' });
            alert('Komentarz został dodany.');
        } catch (err) {
            console.error('Comment submit error:', err);
            alert(err.message || 'Nie udało się dodać komentarza');
        }
    };

    const handleLogout = () => {
        clearAuthToken();
        sessionStorage.removeItem('userRole');
        navigate('/');
    };

    return (
        <div className="dashboard-wrapper">
            <header className="dashboard-header">
                <h1 className="logo-text">Akademik+</h1>
                <h2 className="welcome-text">Witaj, {userData.name}!</h2>
                <div className="header-actions">
                    <button className="secondary-btn" onClick={() => navigate('/history')}>Historia płatności</button>
                    <button className="secondary-btn" onClick={handleLogout}>Wyloguj</button>
                </div>
            </header>

            {error && <div className="error-message" role="alert">{error}</div>}
            {loading && <div className="loading-message">Ładowanie danych z API...</div>}

            <div className="dashboard-grid">
                <div className="card panel-payments">
                    <h3 className="card-title">Historia opłat</h3>
                    <div className="table-container">
                        <table className="payments-table">
                            <thead>
                            <tr>
                                <th>Data</th>
                                <th>Opis płatności</th>
                                <th>Kwota</th>
                                <th>Status</th>
                            </tr>
                            </thead>
                            <tbody>
                            {payments.length ? payments.map((payment) => (
                                <tr key={payment.id}>
                                    <td>{payment.date}</td>
                                    <td>{payment.desc}</td>
                                    <td>{payment.amount} zł</td>
                                    <td>
                                        <span className={`status-badge ${payment.status === 'OPŁACONE' ? 'paid' : 'unpaid'}`}>
                                            {payment.status}
                                        </span>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="4">{billsMessage || 'Brak rachunków.'}</td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>
                    <button className="primary-btn mt-auto" onClick={() => navigate('/history')} disabled={!payments.some((payment) => payment.status !== 'OPŁACONE')}>
                        Dokonaj płatności
                    </button>
                </div>

                <div className="card panel-history">
                    <h3 className="card-title">Historia zamieszkania</h3>
                    <div className="timeline">
                        {accommodation ? (
                            <div className="timeline-item">
                                <div className="timeline-dot current"></div>
                                <div className="timeline-content">
                                    <strong>{accommodation.akademik_adres || 'Akademik'}</strong><br />
                                    {`Pokój ${accommodation.numer_pokoju || '-'}`}<br />
                                    <span className="timeline-date">{`od ${accommodation.poczatek_zakwaterowania || '-'}`}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="timeline-item">
                                <div className="timeline-content">{accommodationMessage || 'Brak aktywnego zakwaterowania.'}</div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="card panel-room">
                    <h3 className="card-title">Mój pokój</h3>
                    <div className="room-info">
                        <div className="room-image-placeholder">
                            <img src={roomImg} alt="Pokój" className="room-image" />
                        </div>
                        <div className="room-details">
                            {(accommodation?.standard_pokoju || 'Brak danych')},<br />
                            numer {(accommodation?.numer_pokoju || '-')},<br />
                            {(accommodation?.akademik_adres || 'Brak aktywnego zakwaterowania')}
                        </div>
                    </div>
                </div>

                <div className="card panel-fault">
                    <h3 className="card-title">Zgłoszenie usterki</h3>
                    <form className="fault-form" onSubmit={handleFaultSubmit}>
                        <input
                            type="number"
                            placeholder="Podaj ID pokoju"
                            value={faultForm.pokoj_id}
                            onChange={(e) => setFaultForm({ ...faultForm, pokoj_id: e.target.value })}
                            disabled={!accommodation?.pokoj_id}
                        />

                        <select
                            value={faultForm.priorytet}
                            onChange={(e) => setFaultForm({ ...faultForm, priorytet: e.target.value })}
                        >
                            <option value="" disabled>Wybierz kategorię usterki</option>
                            <option value="BardzoPilne">Bardzo pilne</option>
                            <option value="Pilne">Pilne</option>
                            <option value="Normalny">Normalny</option>
                            <option value="MozePoczekac">Może poczekać</option>
                        </select>

                        <textarea
                            placeholder="Opisz usterkę"
                            rows="8"
                            value={faultForm.opis_usterki}
                            onChange={(e) => setFaultForm({ ...faultForm, opis_usterki: e.target.value })}
                        ></textarea>

                        <button type="submit" className="primary-btn mt-auto">Zgłoś usterkę</button>
                    </form>

                    <hr />
                    <h4>Dodaj komentarz do usterki</h4>
                    <form className="fault-form" onSubmit={handleCommentSubmit}>
                        <select
                            value={commentForm.faultId}
                            onChange={(e) => setCommentForm({ ...commentForm, faultId: e.target.value })}
                        >
                            <option value="" disabled>Wybierz usterkę</option>
                            {faults.map((fault) => (
                                <option key={fault.id} value={fault.id}>
                                    #{fault.id} - {fault.opis_usterki || fault.status}
                                </option>
                            ))}
                        </select>
                        <textarea
                            placeholder="Treść komentarza"
                            rows="4"
                            value={commentForm.tresc}
                            onChange={(e) => setCommentForm({ ...commentForm, tresc: e.target.value })}
                        ></textarea>
                        <button type="submit" className="primary-btn mt-auto">Dodaj komentarz</button>
                    </form>
                </div>

            </div>
        </div>
    );
};

export default Dashboard;

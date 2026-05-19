import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';
import roomImg from '../assets/room.png';
import { apiFetch, readJsonOrText } from '../api';
import AppHeader from './AppHeader';

const mapPayment = (payment) => ({
    id: payment.numer_rachunku ?? payment.id ?? `${payment.data || payment.date}-${payment.opis || payment.desc}`,
    date: payment.data_wystawienia || payment.data || payment.date || '',
    desc: payment.okres_rozliczeniowy || payment.dodatkowe_uwagi || payment.opis || payment.desc || '',
    amount: Number(payment.kwota ?? payment.amount ?? 0),
    status: payment.czy_oplacone === true || payment.oplacone === true || payment.status === 'OPŁACONE' ? 'OPŁACONE' : 'NIEOPŁACONE',
});

const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('pl-PL');
};

const Dashboard = () => {
    const navigate = useNavigate();
    const [userData, setUserData] = useState({ name: 'Mieszkańcu' });
    const [payments, setPayments] = useState([]);
    const [billsMessage, setBillsMessage] = useState('');
    const [accommodation, setAccommodation] = useState(null);
    const [accommodationMessage, setAccommodationMessage] = useState('');
    const [faults, setFaults] = useState([]);
    const [faultForm, setFaultForm] = useState({ pokoj_id: '', priorytet: '', opis_usterki: '' });
    const [activeFaultTab, setActiveFaultTab] = useState('new');
    const [selectedFault, setSelectedFault] = useState(null);
    const [faultComments, setFaultComments] = useState([]);
    const [commentDraft, setCommentDraft] = useState('');
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const currentUserRole = useMemo(() => (sessionStorage.getItem('userRole') || '').toLowerCase(), []);

    const loadFaults = async () => {
        const response = await apiFetch('/usterki/moje');
        if (!response.ok) {
            if (response.status === 404) {
                setFaults([]);
                return;
            }
            throw new Error('Nie udało się pobrać usterek.');
        }
        const data = await readJsonOrText(response);
        const items = Array.isArray(data) ? data : data?.items || [];
        setFaults(items);
    };

    const loadComments = async (faultId) => {
        setCommentsLoading(true);
        try {
            const response = await apiFetch(`/komentarze/usterka/${faultId}`);
            if (!response.ok) {
                if (response.status === 404) {
                    setFaultComments([]);
                    return;
                }
                throw new Error('Nie udało się pobrać komentarzy.');
            }
            const data = await readJsonOrText(response);
            const items = Array.isArray(data) ? data : data?.items || [];
            setFaultComments(items);
        } catch (err) {
            console.error('Comments load error:', err);
            setFaultComments([]);
        } finally {
            setCommentsLoading(false);
        }
    };

    const openFaultDetails = async (fault) => {
        setSelectedFault(fault);
        setCommentDraft('');
        await loadComments(fault.id);
    };

    useEffect(() => {
        let mounted = true;

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

                if (!mounted) return;

                if (paymentsRes.ok) {
                    const data = await readJsonOrText(paymentsRes);
                    const items = Array.isArray(data) ? data : data?.rachunki || data?.items || [];
                    setPayments(items.map(mapPayment));
                    if (!items.length) setBillsMessage('Brak aktywnych rachunków.');
                } else if (paymentsRes.status === 404) {
                    setPayments([]);
                    setBillsMessage('Brak aktywnych rachunków.');
                } else if (paymentsRes.status === 401 || paymentsRes.status === 403) {
                    setError('Brak dostępu do rachunków. Zaloguj się ponownie.');
                } else {
                    setError('Nie udało się pobrać rachunków.');
                }

                if (residenceRes.ok) {
                    const data = await readJsonOrText(residenceRes);
                    const item = Array.isArray(data) ? data[0] : data;
                    if (item) {
                        setAccommodation(item);
                        setUserData({ name: item.mieszkaniec_nazwa || 'Mieszkańcu' });
                        setFaultForm((prev) => ({
                            ...prev,
                            pokoj_id: String(item.pokoj_id || ''),
                        }));
                    }
                } else if (residenceRes.status === 404) {
                    setAccommodation(null);
                    setAccommodationMessage('No active accommodation found.');
                } else if (residenceRes.status === 401 || residenceRes.status === 403) {
                    setError((prev) => prev || 'Brak dostępu do historii zakwaterowań.');
                } else {
                    setError((prev) => prev || 'Błąd serwera przy pobieraniu zakwaterowania.');
                }

                await loadFaults();
            } catch (err) {
                console.error('Dashboard load error:', err);
                if (mounted) setError('Nie udało się pobrać danych z API.');
            } finally {
                if (mounted) setLoading(false);
            }
        };

        loadDashboard();
        return () => {
            mounted = false;
        };
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
            setActiveFaultTab('list');
            alert('Usterka została zgłoszona.');
        } catch (err) {
            console.error('Fault submit error:', err);
            alert(err.message || 'Nie udało się zgłosić usterki');
        }
    };

    const handleCommentSubmit = async (e) => {
        e.preventDefault();
        if (!selectedFault || !commentDraft.trim()) {
            alert('Wpisz komentarz.');
            return;
        }
        try {
            const response = await apiFetch(`/komentarze/usterka/${selectedFault.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tresc: commentDraft.trim() }),
            });

            if (!response.ok) {
                const body = await readJsonOrText(response);
                alert(typeof body === 'string' ? body : body?.error || 'Nie udało się dodać komentarza');
                return;
            }
            setCommentDraft('');
            await loadComments(selectedFault.id);
        } catch (err) {
            console.error('Comment submit error:', err);
            alert(err.message || 'Nie udało się dodać komentarza');
        }
    };

    return (
        <div className="dashboard-wrapper">
            <AppHeader
                role={currentUserRole || 'Mieszkaniec'}
                greeting={`Witaj, ${userData.name}!`}
            />

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
                                    <td>{formatDate(payment.date)}</td>
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
                    <button className="primary-btn mt-auto" onClick={() => navigate('/history')}>
                        Zobacz rozliczenia
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
                                    <span className="timeline-date">{`od ${formatDate(accommodation.poczatek_zakwaterowania)}`}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="timeline-item">
                                <div className="timeline-content">{accommodationMessage || 'No active accommodation found.'}</div>
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
                            {accommodation ? (
                                <>
                                    Pokój: <strong>{accommodation.numer_pokoju || '-'}</strong><br />
                                    Wprowadzenie: {formatDate(accommodation.poczatek_zakwaterowania)}<br />
                                    Koniec umowy: {formatDate(accommodation.koniec_zakwaterowania)}
                                </>
                            ) : (
                                <span>{accommodationMessage || 'No active accommodation found.'}</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="card panel-fault">
                    <h3 className="card-title">Usterki</h3>
                    <div className="fault-tabs">
                        <button className={`secondary-btn ${activeFaultTab === 'new' ? 'active' : ''}`} onClick={() => setActiveFaultTab('new')}>
                            Zgłoś
                        </button>
                        <button className={`secondary-btn ${activeFaultTab === 'list' ? 'active' : ''}`} onClick={() => setActiveFaultTab('list')}>
                            Moje zgłoszenia
                        </button>
                    </div>

                    {activeFaultTab === 'new' ? (
                        <form className="fault-form" onSubmit={handleFaultSubmit}>
                            <input
                                type="number"
                                placeholder="ID pokoju"
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
                                rows="7"
                                value={faultForm.opis_usterki}
                                onChange={(e) => setFaultForm({ ...faultForm, opis_usterki: e.target.value })}
                            ></textarea>

                            <button type="submit" className="primary-btn mt-auto">Zgłoś usterkę</button>
                        </form>
                    ) : (
                        <div className="faults-list resident-faults-list">
                            {faults.length ? faults.map((fault) => (
                                <div
                                    key={fault.id}
                                    className="fault-item"
                                    onDoubleClick={() => openFaultDetails(fault)}
                                    title="Kliknij dwa razy, aby otworzyć szczegóły i czat"
                                >
                                    <strong>#{fault.id}</strong> • {fault.status}<br />
                                    <span>{fault.opis_usterki}</span>
                                </div>
                            )) : <div className="fault-item">Brak zgłoszonych usterek.</div>}
                        </div>
                    )}
                </div>
            </div>

            {selectedFault && (
                <div className="admin-modal-overlay" onClick={() => setSelectedFault(null)}>
                    <div className="admin-modal-content fault-modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2>Szczegóły usterki #{selectedFault.id}</h2>
                        <p><strong>Status:</strong> {selectedFault.status}</p>
                        <p><strong>Priorytet:</strong> {selectedFault.priorytet || '-'}</p>
                        <p><strong>Opis:</strong> {selectedFault.opis_usterki || '-'}</p>
                        <p><strong>Data zgłoszenia:</strong> {formatDate(selectedFault.data_zgloszenia)}</p>

                        <h3 className="chat-title">Czat usterki</h3>
                        <div className="fault-chat-timeline">
                            {commentsLoading ? <div>Ładowanie czatu...</div> : null}
                            {!commentsLoading && !faultComments.length ? <div>Brak komentarzy.</div> : null}
                            {faultComments.map((comment) => {
                                const isAdmin = (comment.autor_rola || '').toLowerCase().includes('admin');
                                return (
                                    <div key={comment.id} className={`chat-message ${isAdmin ? 'admin' : 'resident'}`}>
                                        <div className="chat-meta">
                                            <strong>{comment.autor_nazwa || `Użytkownik ${comment.autor_id}`}</strong>
                                            <span>{formatDate(comment.data_dodania)}</span>
                                        </div>
                                        <div>{comment.tresc}</div>
                                    </div>
                                );
                            })}
                        </div>

                        <form className="chat-form" onSubmit={handleCommentSubmit}>
                            <textarea
                                rows="3"
                                value={commentDraft}
                                onChange={(e) => setCommentDraft(e.target.value)}
                                placeholder="Napisz wiadomość..."
                            />
                            <div className="modal-buttons">
                                <button type="button" className="cancel-btn" onClick={() => setSelectedFault(null)}>Zamknij</button>
                                <button type="submit" className="confirm-btn">Wyślij</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;

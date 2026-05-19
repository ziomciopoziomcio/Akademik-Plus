import { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell,
    BarChart, Bar,
} from 'recharts';
import './AdminDashboard.css';
import { apiFetch, readJsonOrText } from '../api';
import AppHeader from './AppHeader';

const COLORS = {
    free: '#1b6392',
    pending: '#e87823',
    occupied: '#1b6e2d',
};

const removePolishChars = (text) => {
    if (!text) return '';
    const charMap = {
        'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
        'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N', 'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z',
    };
    return text.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (match) => charMap[match]);
};

const normalizeStats = (raw) => ({
    wszystkie_pokoje: Number(raw?.wszystkie_pokoje ?? raw?.wszystkiePokoje ?? 0),
    zajete_pokoje: Number(raw?.zajete_pokoje ?? raw?.zajetePokoje ?? 0),
    nieoplacone_rachunki: Number(raw?.nieoplacone_rachunki ?? raw?.nieoplaconeRachunki ?? 0),
    otwarte_usterki: Number(raw?.otwarte_usterki ?? raw?.otwarteUsterki ?? 0),
});

const faultDescription = (fault) => {
    const room = fault?.pokoj_id ? `Pokój ${fault.pokoj_id}` : 'Pokój nieznany';
    const desc = fault?.opis_usterki || 'Brak opisu';
    const status = fault?.status || 'Brak statusu';
    return `${room} - ${desc} (${status})`;
};

const formatDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString('pl-PL');
};

const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
    return date.toISOString().slice(0, 10);
};

const statusOptions = ['Przyjeto', 'Weryfikacja', 'W_trakcie_naprawy', 'Naprawiono', 'Zakonczono_bez_naprawy'];

const AdminDashboard = () => {
    const [adminName, setAdminName] = useState('Administratorze');
    const [stats, setStats] = useState(normalizeStats());
    const [faults, setFaults] = useState([]);
    const [selectedFault, setSelectedFault] = useState(null);
    const [faultComments, setFaultComments] = useState([]);
    const [commentDraft, setCommentDraft] = useState('');
    const [faultStatus, setFaultStatus] = useState('Przyjeto');

    const [activeModal, setActiveModal] = useState(null);
    const [users, setUsers] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [accommodations, setAccommodations] = useState([]);
    const [userRoleDraft, setUserRoleDraft] = useState({});
    const [roomStatusDraft, setRoomStatusDraft] = useState({});
    const [userForm, setUserForm] = useState({
        imie: '',
        nazwisko: '',
        email: '',
        numer_telefonu: '',
        username: '',
        password: '',
        rola: 'Mieszkaniec',
    });
    const [roomForm, setRoomForm] = useState({
        numer_pokoju: '',
        ile_osob: '2',
        pietro: '1',
        akademik_id: '1',
        status_pokoju: 'Dostepny',
    });
    const [accommodationForm, setAccommodationForm] = useState({
        mieszkaniec_id: '',
        pokoj_id: '',
        poczatek_zakwaterowania: '',
        koniec_zakwaterowania: '',
    });
    const [checkoutForm, setCheckoutForm] = useState({ id: '', koniec_zakwaterowania: '' });
    const [residentSearch, setResidentSearch] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const totalDebt = stats.nieoplacone_rachunki;
    const residentUsers = useMemo(() => users.filter((user) => user.rola === 'Mieszkaniec'), [users]);
    const occupiedRoomIds = useMemo(() => {
        const now = new Date();
        return new Set(accommodations.filter((item) => new Date(item.koniec_zakwaterowania) >= now).map((item) => item.pokoj_id));
    }, [accommodations]);
    const availableRooms = useMemo(
        () => rooms.filter((room) => room.status_pokoju === 'Dostepny' && !occupiedRoomIds.has(room.id)),
        [rooms, occupiedRoomIds],
    );

    const lineData = useMemo(() => {
        const total = Math.max(stats.wszystkie_pokoje, 1);
        const occupied = Math.round((stats.zajete_pokoje / total) * 100);
        const pending = Math.round((stats.otwarte_usterki / total) * 100);
        const free = Math.max(0, 100 - occupied - pending);
        return [{ name: 'teraz', free, pending, occupied }];
    }, [stats]);

    const pieData = useMemo(() => {
        const total = Math.max(stats.wszystkie_pokoje, 0);
        const occupied = Math.min(stats.zajete_pokoje, total);
        const free = Math.max(0, total - occupied);
        return [
            { name: 'Wolne', value: free, color: COLORS.free },
            { name: 'Zajęte', value: occupied, color: COLORS.occupied },
        ];
    }, [stats]);

    const barData = useMemo(() => {
        const total = Math.max(stats.wszystkie_pokoje, 1);
        return [
            { name: 'Pokoje zajęte', usage: Math.round((stats.zajete_pokoje / total) * 100) },
            { name: 'Pokoje wolne', usage: Math.round(((total - stats.zajete_pokoje) / total) * 100) },
        ];
    }, [stats]);

    const loadFaultComments = async (faultId) => {
        const response = await apiFetch(`/komentarze/usterka/${faultId}`);
        if (!response.ok) {
            setFaultComments([]);
            return;
        }
        const data = await readJsonOrText(response);
        setFaultComments(Array.isArray(data) ? data : data?.items || []);
    };

    const openFaultDetails = async (fault) => {
        setSelectedFault(fault);
        setFaultStatus(fault.status || 'Przyjeto');
        setCommentDraft('');
        await loadFaultComments(fault.id);
    };

    const loadMainData = async () => {
        const [statsRes, faultsRes] = await Promise.all([
            apiFetch('/statystyki'),
            apiFetch('/usterki'),
        ]);

        if (!statsRes.ok) {
            const body = await readJsonOrText(statsRes);
            throw new Error(typeof body === 'string' ? body : body?.error || 'Nie udało się pobrać statystyk.');
        }
        const statsData = await readJsonOrText(statsRes);
        setStats(normalizeStats(statsData));

        if (faultsRes.ok) {
            const faultsData = await readJsonOrText(faultsRes);
            setFaults(Array.isArray(faultsData) ? faultsData : faultsData?.items || []);
        } else if (faultsRes.status === 404) {
            setFaults([]);
        } else {
            const body = await readJsonOrText(faultsRes);
            throw new Error(typeof body === 'string' ? body : body?.error || 'Nie udało się pobrać usterek.');
        }
    };

    useEffect(() => {
        let mounted = true;

        const loadData = async () => {
            setLoading(true);
            setError('');
            try {
                await loadMainData();
                const role = sessionStorage.getItem('userRole') || '';
                if (mounted && role) {
                    setAdminName(role);
                }
            } catch (err) {
                console.error('Admin dashboard load error:', err);
                if (mounted) setError(err.message || 'Nie udało się pobrać danych panelu administratora.');
            } finally {
                if (mounted) setLoading(false);
            }
        };

        loadData();
        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        if (!successMessage) return undefined;
        const timeout = setTimeout(() => setSuccessMessage(''), 3000);
        return () => clearTimeout(timeout);
    }, [successMessage]);

    const loadUsers = async () => {
        const response = await apiFetch('/uzytkownicy');
        if (!response.ok) throw new Error('Nie udało się pobrać użytkowników.');
        const data = await readJsonOrText(response);
        const items = Array.isArray(data) ? data : data?.items || [];
        setUsers(items);
        setUserRoleDraft(Object.fromEntries(items.map((user) => [user.id, user.rola || 'Mieszkaniec'])));
    };

    const loadRooms = async () => {
        const response = await apiFetch('/pokoje');
        if (!response.ok) throw new Error('Nie udało się pobrać pokoi.');
        const data = await readJsonOrText(response);
        const items = Array.isArray(data) ? data : data?.items || [];
        setRooms(items);
        setRoomStatusDraft(Object.fromEntries(items.map((room) => [room.id, room.status_pokoju || 'Dostepny'])));
    };

    const loadAccommodations = async () => {
        const response = await apiFetch('/zakwaterowania');
        if (!response.ok) throw new Error('Nie udało się pobrać zakwaterowań.');
        const data = await readJsonOrText(response);
        setAccommodations(Array.isArray(data) ? data : data?.items || []);
    };

    const openQuickActionModal = async (modal) => {
        try {
            if (modal === 'users') await loadUsers();
            if (modal === 'rooms') await loadRooms();
            if (modal === 'accommodations') {
                await Promise.all([loadAccommodations(), loadUsers(), loadRooms()]);
            }
            setActiveModal(modal);
        } catch (err) {
            alert(err.message || 'Nie udało się pobrać danych dla akcji administracyjnej.');
        }
    };

    const handleFaultStatusUpdate = async () => {
        if (!selectedFault) return;
        const response = await apiFetch(`/usterki/${selectedFault.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: faultStatus }),
        });
        if (!response.ok) {
            const body = await readJsonOrText(response);
            alert(typeof body === 'string' ? body : body?.error || 'Nie udało się zaktualizować statusu usterki.');
            return;
        }

        setFaults((prev) => prev.map((fault) => (fault.id === selectedFault.id ? { ...fault, status: faultStatus } : fault)));
        setSelectedFault((prev) => (prev ? { ...prev, status: faultStatus } : prev));
    };

    const handleFaultCommentSubmit = async (e) => {
        e.preventDefault();
        if (!selectedFault || !commentDraft.trim()) {
            alert('Wpisz treść komentarza.');
            return;
        }
        const response = await apiFetch(`/komentarze/usterka/${selectedFault.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tresc: commentDraft.trim() }),
        });
        if (!response.ok) {
            const body = await readJsonOrText(response);
            alert(typeof body === 'string' ? body : body?.error || 'Nie udało się dodać komentarza.');
            return;
        }
        setCommentDraft('');
        await loadFaultComments(selectedFault.id);
    };

    const handleUpdateUserRole = async (userId) => {
        const response = await apiFetch(`/uzytkownicy/${userId}/rola`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rola: userRoleDraft[userId] }),
        });
        if (!response.ok) {
            const body = await readJsonOrText(response);
            alert(typeof body === 'string' ? body : body?.error || 'Nie udało się zaktualizować roli.');
            return;
        }
        setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, rola: userRoleDraft[userId] } : user)));
        setSuccessMessage('Rola użytkownika została zaktualizowana.');
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        const response = await apiFetch('/uzytkownicy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userForm),
        });
        if (!response.ok) {
            const body = await readJsonOrText(response);
            alert(typeof body === 'string' ? body : body?.error || 'Nie udało się utworzyć użytkownika.');
            return;
        }
        await loadUsers();
        setUserForm({
            imie: '',
            nazwisko: '',
            email: '',
            numer_telefonu: '',
            username: '',
            password: '',
            rola: 'Mieszkaniec',
        });
        setSuccessMessage(`Użytkownik ${userForm.imie} ${userForm.nazwisko} został dodany.`);
    };

    const handleDeleteUser = async (user) => {
        if (!window.confirm(`Usunąć użytkownika ${user.imie} ${user.nazwisko}?`)) return;
        const response = await apiFetch(`/uzytkownicy/${user.id}`, { method: 'DELETE' });
        if (!response.ok) {
            const body = await readJsonOrText(response);
            alert(typeof body === 'string' ? body : body?.error || 'Nie udało się usunąć użytkownika.');
            return;
        }
        await loadUsers();
        setSuccessMessage(`Użytkownik ${user.imie} ${user.nazwisko} został usunięty.`);
    };

    const handleUpdateRoomStatus = async (roomId) => {
        const response = await apiFetch(`/pokoje/${roomId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status_pokoju: roomStatusDraft[roomId] }),
        });
        if (!response.ok) {
            const body = await readJsonOrText(response);
            alert(typeof body === 'string' ? body : body?.error || 'Nie udało się zaktualizować statusu pokoju.');
            return;
        }
        setRooms((prev) => prev.map((room) => (room.id === roomId ? { ...room, status_pokoju: roomStatusDraft[roomId] } : room)));
        setSuccessMessage('Status pokoju został zaktualizowany.');
    };

    const handleCreateRoom = async (e) => {
        e.preventDefault();
        const response = await apiFetch('/pokoje', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                numer_pokoju: roomForm.numer_pokoju,
                ile_osob: Number(roomForm.ile_osob),
                pietro: Number(roomForm.pietro),
                akademik_id: Number(roomForm.akademik_id),
                status_pokoju: roomForm.status_pokoju,
            }),
        });
        if (!response.ok) {
            const body = await readJsonOrText(response);
            alert(typeof body === 'string' ? body : body?.error || 'Nie udało się utworzyć pokoju.');
            return;
        }
        await loadRooms();
        setRoomForm({ numer_pokoju: '', ile_osob: '2', pietro: '1', akademik_id: '1', status_pokoju: 'Dostepny' });
        setSuccessMessage(`Pokój ${roomForm.numer_pokoju} został dodany.`);
    };

    const handleDeleteRoom = async (room) => {
        if (!window.confirm(`Usunąć pokój ${room.numer_pokoju}?`)) return;
        const response = await apiFetch(`/pokoje/${room.id}`, { method: 'DELETE' });
        if (!response.ok) {
            const body = await readJsonOrText(response);
            alert(typeof body === 'string' ? body : body?.error || 'Nie udało się usunąć pokoju.');
            return;
        }
        await loadRooms();
        setSuccessMessage(`Pokój ${room.numer_pokoju} został usunięty.`);
    };

    const handleCreateAccommodation = async (e) => {
        e.preventDefault();
        if (!accommodationForm.mieszkaniec_id || !accommodationForm.pokoj_id) {
            alert('Wybierz mieszkańca i pokój z listy.');
            return;
        }
        const response = await apiFetch('/zakwaterowania', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mieszkaniec_id: Number(accommodationForm.mieszkaniec_id),
                pokoj_id: Number(accommodationForm.pokoj_id),
                poczatek_zakwaterowania: accommodationForm.poczatek_zakwaterowania,
                koniec_zakwaterowania: accommodationForm.koniec_zakwaterowania,
            }),
        });
        if (!response.ok) {
            const body = await readJsonOrText(response);
            alert(typeof body === 'string' ? body : body?.error || 'Nie udało się przypisać zakwaterowania.');
            return;
        }
        await Promise.all([loadAccommodations(), loadRooms()]);
        setAccommodationForm({ mieszkaniec_id: '', pokoj_id: '', poczatek_zakwaterowania: '', koniec_zakwaterowania: '' });
        setResidentSearch('');
        setSuccessMessage('Zakwaterowanie zostało przypisane.');
    };

    const handleCheckout = async (e) => {
        e.preventDefault();
        const response = await apiFetch(`/zakwaterowania/${checkoutForm.id}/checkout`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ koniec_zakwaterowania: checkoutForm.koniec_zakwaterowania }),
        });
        if (!response.ok) {
            const body = await readJsonOrText(response);
            alert(typeof body === 'string' ? body : body?.error || 'Nie udało się zapisać wymeldowania.');
            return;
        }
        await Promise.all([loadAccommodations(), loadRooms()]);
        setCheckoutForm({ id: '', koniec_zakwaterowania: '' });
        setSuccessMessage('Wymeldowanie zostało zapisane.');
    };

    const closeModal = () => setActiveModal(null);

    const residentOptionLabel = (user) => `${user.imie} ${user.nazwisko} (${user.email})`;

    const handleResidentInputChange = (value) => {
        setResidentSearch(value);
        const selected = residentUsers.find((user) => residentOptionLabel(user) === value);
        setAccommodationForm((prev) => ({ ...prev, mieszkaniec_id: selected ? String(selected.id) : '' }));
    };

    const handleGenerateReportPdf = () => {
        if (!startDate || !endDate) {
            alert('Proszę wybrać zakres dat od - do!');
            return;
        }

        const pdf = new jsPDF();
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(20);
        pdf.text('RAPORT ADMINISTRACYJNY', 20, 20);
        pdf.setFontSize(14);
        pdf.setTextColor(100, 100, 100);
        pdf.text('System Akademik+', 20, 30);
        pdf.setDrawColor(200, 200, 200);
        pdf.line(20, 35, 190, 35);
        pdf.setTextColor(0, 0, 0);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(12);
        pdf.text(`Okres raportu: ${startDate} do ${endDate}`, 20, 45);
        pdf.text(`Wygenerowano przez: ${removePolishChars(adminName)}`, 20, 52);
        pdf.text(`Wszystkie pokoje: ${stats.wszystkie_pokoje}`, 20, 65);
        pdf.text(`Zajęte pokoje: ${stats.zajete_pokoje}`, 20, 72);
        pdf.text(`Nieopłacone rachunki: ${stats.nieoplacone_rachunki}`, 20, 79);
        pdf.text(`Otwarte usterki: ${stats.otwarte_usterki}`, 20, 86);
        pdf.save(`Raport_${startDate}_${endDate}.pdf`);
    };

    return (
        <div className="admin-wrapper">
            <AppHeader role="Administrator" greeting={`Witaj, ${adminName}!`} />

            {error && <div className="error-message" role="alert">{error}</div>}
            {successMessage && <div className="success-message" role="status">{successMessage}</div>}
            {loading && <div className="loading-message">Ładowanie danych z API...</div>}

            <div className="admin-grid">
                <div className="admin-card line-card">
                    <h3 className="card-title">Raport obłożenia</h3>
                    <div className="recharts-container" style={{ width: '100%', height: 280, minHeight: 200 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={lineData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} tickMargin={10} />
                                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(tick) => `${tick}%`} />
                                <Tooltip />
                                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                                <Line type="linear" dataKey="free" stroke={COLORS.free} strokeWidth={3} dot={false} />
                                <Line type="linear" dataKey="pending" stroke={COLORS.pending} strokeWidth={3} dot={false} />
                                <Line type="linear" dataKey="occupied" stroke={COLORS.occupied} strokeWidth={3} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="admin-card pie-card">
                    <h3 className="card-title">Obłożenie bieżące</h3>
                    <div className="recharts-container" style={{ width: '100%', height: 220, minHeight: 160 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={0} outerRadius={80} dataKey="value" stroke="none">
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="admin-card faults-card">
                    <h3 className="card-title">Lista usterek</h3>
                    <div className="faults-list">
                        {faults.length ? faults.map((fault) => (
                            <div
                                key={fault.id}
                                className="fault-item"
                                onDoubleClick={() => openFaultDetails(fault)}
                                title="Kliknij dwa razy, aby otworzyć szczegóły i czat"
                            >
                                {faultDescription(fault)}
                            </div>
                        )) : <div>Brak usterek.</div>}
                    </div>
                    <div className="fault-hint">Dwuklik otwiera szczegóły i czat usterki.</div>
                </div>

                <div className="admin-card bar-chart-card">
                    <div className="bar-layout-wrapper">
                        <h3 className="card-title left-title">Statystyki<br/>wykorzystania<br/>pokoi</h3>
                        <div className="recharts-container" style={{ flexGrow: 1, width: '100%', height: 220, minHeight: 160 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={barData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(tick) => `${tick}%`} />
                                    <Tooltip cursor={{ fill: '#f8fafc' }} formatter={(value) => `${value}%`} />
                                    <Bar dataKey="usage" fill={COLORS.free} radius={[4, 4, 0, 0]} barSize={30} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <div className="admin-card actions-card">
                    <h3 className="card-title">Szybkie akcje</h3>
                    <div className="action-buttons">
                        <button className="primary-btn" onClick={() => openQuickActionModal('accommodations')}>Zarządzaj zakwaterowaniami</button>
                        <button className="primary-btn" onClick={() => openQuickActionModal('users')}>Zarządzaj użytkownikami</button>
                        <button className="primary-btn" onClick={() => openQuickActionModal('rooms')}>Zarządzaj pokojami</button>
                    </div>
                </div>

                <div className="admin-card finance-card">
                    <h3 className="card-title">Podsumowanie finansowe</h3>
                    <div className="finance-debt">
                        <span className="debt-label">nieopłacone rachunki:</span>
                        <span className="debt-amount">{totalDebt}</span>
                    </div>
                    <div className="date-pickers">
                        <input type="date" className="date-input" title="Okres od" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        <input type="date" className="date-input" title="Okres do" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </div>
                    <button className="primary-btn mt-auto" onClick={handleGenerateReportPdf}>
                        Wygeneruj raport PDF
                    </button>
                </div>
            </div>

            {selectedFault && (
                <div className="admin-modal-overlay" onClick={() => setSelectedFault(null)}>
                    <div className="admin-modal-content fault-modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2>Usterka #{selectedFault.id}</h2>
                        <p><strong>Pokój:</strong> {selectedFault.pokoj_id}</p>
                        <p><strong>Opis:</strong> {selectedFault.opis_usterki}</p>
                        <p><strong>Priorytet:</strong> {selectedFault.priorytet || '-'}</p>
                        <p><strong>Data zgłoszenia:</strong> {formatDateTime(selectedFault.data_zgloszenia)}</p>
                        <div className="form-group">
                            <label>Status:</label>
                            <select value={faultStatus} onChange={(e) => setFaultStatus(e.target.value)}>
                                {statusOptions.map((status) => (
                                    <option key={status} value={status}>{status}</option>
                                ))}
                            </select>
                        </div>
                        <button className="primary-btn" onClick={handleFaultStatusUpdate}>Zapisz status</button>

                        <h3 className="chat-title">Czat usterki</h3>
                        <div className="fault-chat-timeline">
                            {!faultComments.length ? <div>Brak komentarzy.</div> : null}
                            {faultComments.map((comment) => {
                                const isAdmin = (comment.autor_rola || '').toLowerCase().includes('admin');
                                return (
                                    <div key={comment.id} className={`chat-message ${isAdmin ? 'admin' : 'resident'}`}>
                                        <div className="chat-meta">
                                            <strong>{comment.autor_nazwa || `Użytkownik ${comment.autor_id}`}</strong>
                                            <span>{formatDateTime(comment.data_dodania)}</span>
                                        </div>
                                        <div>{comment.tresc}</div>
                                    </div>
                                );
                            })}
                        </div>

                        <form className="chat-form" onSubmit={handleFaultCommentSubmit}>
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

            {activeModal === 'users' && (
                <div className="admin-modal-overlay" onClick={closeModal}>
                    <div className="admin-modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2>Zarządzanie użytkownikami</h2>
                        <form onSubmit={handleCreateUser} className="modal-form-grid user-form-grid">
                            <input
                                required
                                placeholder="Imię"
                                value={userForm.imie}
                                onChange={(e) => setUserForm((prev) => ({ ...prev, imie: e.target.value }))}
                            />
                            <input
                                required
                                placeholder="Nazwisko"
                                value={userForm.nazwisko}
                                onChange={(e) => setUserForm((prev) => ({ ...prev, nazwisko: e.target.value }))}
                            />
                            <input
                                required
                                type="email"
                                placeholder="Email"
                                value={userForm.email}
                                onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))}
                            />
                            <input
                                required
                                placeholder="Numer telefonu"
                                value={userForm.numer_telefonu}
                                onChange={(e) => setUserForm((prev) => ({ ...prev, numer_telefonu: e.target.value }))}
                            />
                            <input
                                required
                                placeholder="Username"
                                value={userForm.username}
                                onChange={(e) => setUserForm((prev) => ({ ...prev, username: e.target.value }))}
                            />
                            <input
                                required
                                minLength={6}
                                type="password"
                                placeholder="Hasło"
                                value={userForm.password}
                                onChange={(e) => setUserForm((prev) => ({ ...prev, password: e.target.value }))}
                            />
                            <select
                                value={userForm.rola}
                                onChange={(e) => setUserForm((prev) => ({ ...prev, rola: e.target.value }))}
                            >
                                <option value="Mieszkaniec">Mieszkaniec</option>
                                <option value="Administrator">Administrator</option>
                            </select>
                            <button className="confirm-btn" type="submit">Dodaj użytkownika</button>
                        </form>
                        <div className="table-like-list">
                            {users.map((user) => (
                                <div className="list-row" key={user.id}>
                                    <div className="list-main">
                                        <strong>{user.imie} {user.nazwisko}</strong><br />
                                        <span>{user.email}</span>
                                        <div className="list-muted">Rola: {user.rola} • Tel: {user.numer_telefonu || '-'}</div>
                                    </div>
                                    <div className="row-actions">
                                        <select
                                            value={userRoleDraft[user.id] || user.rola || 'Mieszkaniec'}
                                            onChange={(e) => setUserRoleDraft((prev) => ({ ...prev, [user.id]: e.target.value }))}
                                        >
                                            <option value="Mieszkaniec">Mieszkaniec</option>
                                            <option value="Administrator">Administrator</option>
                                        </select>
                                        <button className="confirm-btn" onClick={() => handleUpdateUserRole(user.id)}>Zapisz rolę</button>
                                        <button className="danger-btn" onClick={() => handleDeleteUser(user)}>Usuń</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="modal-buttons">
                            <button type="button" className="cancel-btn" onClick={closeModal}>Zamknij</button>
                        </div>
                    </div>
                </div>
            )}

            {activeModal === 'rooms' && (
                <div className="admin-modal-overlay" onClick={closeModal}>
                    <div className="admin-modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2>Zarządzanie pokojami</h2>
                        <form onSubmit={handleCreateRoom} className="modal-form-grid room-form-grid">
                            <input
                                required
                                placeholder="Numer pokoju"
                                value={roomForm.numer_pokoju}
                                onChange={(e) => setRoomForm((prev) => ({ ...prev, numer_pokoju: e.target.value }))}
                            />
                            <input
                                required
                                type="number"
                                min="1"
                                placeholder="Liczba miejsc"
                                value={roomForm.ile_osob}
                                onChange={(e) => setRoomForm((prev) => ({ ...prev, ile_osob: e.target.value }))}
                            />
                            <input
                                required
                                type="number"
                                min="1"
                                placeholder="Piętro"
                                value={roomForm.pietro}
                                onChange={(e) => setRoomForm((prev) => ({ ...prev, pietro: e.target.value }))}
                            />
                            <input
                                required
                                type="number"
                                min="1"
                                placeholder="ID akademika"
                                value={roomForm.akademik_id}
                                onChange={(e) => setRoomForm((prev) => ({ ...prev, akademik_id: e.target.value }))}
                            />
                            <select
                                value={roomForm.status_pokoju}
                                onChange={(e) => setRoomForm((prev) => ({ ...prev, status_pokoju: e.target.value }))}
                            >
                                <option value="Dostepny">Dostepny</option>
                                <option value="W_remoncie">W_remoncie</option>
                            </select>
                            <button className="confirm-btn" type="submit">Dodaj pokój</button>
                        </form>
                        <div className="table-like-list">
                            {rooms.map((room) => (
                                <div className="list-row" key={room.id}>
                                    <div className="list-main">
                                        <strong>Pokój {room.numer_pokoju}</strong><br />
                                        <span>Status: {room.status_pokoju}</span>
                                        <div className="list-muted">Miejsca: {room.ile_osob} • Piętro: {room.pietro}</div>
                                    </div>
                                    <div className="row-actions">
                                        <select
                                            value={roomStatusDraft[room.id] || room.status_pokoju || 'Dostepny'}
                                            onChange={(e) => setRoomStatusDraft((prev) => ({ ...prev, [room.id]: e.target.value }))}
                                        >
                                            <option value="Dostepny">Dostepny</option>
                                            <option value="W_remoncie">W_remoncie</option>
                                        </select>
                                        <button className="confirm-btn" onClick={() => handleUpdateRoomStatus(room.id)}>Zapisz status</button>
                                        <button className="danger-btn" onClick={() => handleDeleteRoom(room)}>Usuń</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="modal-buttons">
                            <button type="button" className="cancel-btn" onClick={closeModal}>Zamknij</button>
                        </div>
                    </div>
                </div>
            )}

            {activeModal === 'accommodations' && (
                <div className="admin-modal-overlay" onClick={closeModal}>
                    <div className="admin-modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2>Zarządzanie zakwaterowaniami</h2>
                        <form onSubmit={handleCreateAccommodation} className="modal-form-grid">
                            <input
                                list="resident-options"
                                placeholder="Wyszukaj mieszkańca (imię, nazwisko, email)"
                                value={residentSearch}
                                onChange={(e) => handleResidentInputChange(e.target.value)}
                            />
                            <datalist id="resident-options">
                                {residentUsers.map((user) => (
                                    <option key={user.id} value={residentOptionLabel(user)} />
                                ))}
                            </datalist>
                            <select
                                required
                                value={accommodationForm.pokoj_id}
                                onChange={(e) => setAccommodationForm((prev) => ({ ...prev, pokoj_id: e.target.value }))}
                            >
                                <option value="">Wybierz dostępny pokój</option>
                                {availableRooms.map((room) => (
                                    <option key={room.id} value={room.id}>
                                        Pokój {room.numer_pokoju}
                                    </option>
                                ))}
                            </select>
                            <input
                                required
                                type="date"
                                value={accommodationForm.poczatek_zakwaterowania}
                                onChange={(e) => setAccommodationForm((prev) => ({ ...prev, poczatek_zakwaterowania: e.target.value }))}
                            />
                            <input
                                required
                                type="date"
                                value={accommodationForm.koniec_zakwaterowania}
                                onChange={(e) => setAccommodationForm((prev) => ({ ...prev, koniec_zakwaterowania: e.target.value }))}
                            />
                            <button className="confirm-btn" type="submit">Przypisz mieszkańca do pokoju</button>
                        </form>

                        <form onSubmit={handleCheckout} className="modal-form-grid checkout-form">
                            <input type="number" placeholder="ID zakwaterowania" value={checkoutForm.id} onChange={(e) => setCheckoutForm((prev) => ({ ...prev, id: e.target.value }))} />
                            <input type="date" value={checkoutForm.koniec_zakwaterowania} onChange={(e) => setCheckoutForm((prev) => ({ ...prev, koniec_zakwaterowania: e.target.value }))} />
                            <button className="confirm-btn" type="submit">Wymelduj</button>
                        </form>

                        <div className="table-like-list">
                            {accommodations.map((item) => (
                                <div className="list-row" key={item.id}>
                                    <div>
                                        <strong>#{item.id} • Pokój {item.numer_pokoju || item.pokoj_id}</strong><br />
                                        <span>{item.mieszkaniec_nazwa || `Mieszkaniec ${item.mieszkaniec_id}`}</span>
                                    </div>
                                    <div>
                                        {formatDate(item.poczatek_zakwaterowania)} - {formatDate(item.koniec_zakwaterowania)}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="modal-buttons">
                            <button type="button" className="cancel-btn" onClick={closeModal}>Zamknij</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;

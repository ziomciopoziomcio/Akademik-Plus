import { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import { useNavigate } from 'react-router-dom';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell,
    BarChart, Bar,
} from 'recharts';
import './AdminDashboard.css';
import { apiFetch, readJsonOrText, clearAuthToken } from '../api';

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

const AdminDashboard = () => {
    const navigate = useNavigate();

    const [adminName, setAdminName] = useState('Administratorze');
    const [stats, setStats] = useState(normalizeStats());
    const [faults, setFaults] = useState([]);
    const [selectedFault, setSelectedFault] = useState(null);
    const [activeModal, setActiveModal] = useState(null);

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [statusToSet, setStatusToSet] = useState('Naprawiono');

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const totalDebt = stats.nieoplacone_rachunki;

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

    useEffect(() => {
        let mounted = true;

        const loadData = async () => {
            setLoading(true);
            setError('');
            try {
                const [statsRes, faultsRes] = await Promise.all([
                    apiFetch('/statystyki'),
                    apiFetch('/usterki'),
                ]);

                if (!statsRes.ok) {
                    const body = await readJsonOrText(statsRes);
                    throw new Error(typeof body === 'string' ? body : body?.error || 'Nie udało się pobrać statystyk.');
                }
                const statsData = await readJsonOrText(statsRes);
                if (mounted) setStats(normalizeStats(statsData));

                if (faultsRes.ok) {
                    const faultsData = await readJsonOrText(faultsRes);
                    const items = Array.isArray(faultsData) ? faultsData : faultsData?.items || [];
                    if (mounted) setFaults(items);
                } else if (faultsRes.status === 404) {
                    if (mounted) setFaults([]);
                } else {
                    const body = await readJsonOrText(faultsRes);
                    throw new Error(typeof body === 'string' ? body : body?.error || 'Nie udało się pobrać usterek.');
                }

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

    const closeModal = () => setActiveModal(null);

    const handleResolveFault = async (e) => {
        e.preventDefault();
        if (!selectedFault) {
            alert('Wybierz usterkę z listy.');
            return;
        }
        try {
            const response = await apiFetch(`/usterki/${selectedFault}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: statusToSet }),
            });

            if (!response.ok) {
                const body = await readJsonOrText(response);
                alert(typeof body === 'string' ? body : body?.error || 'Nie udało się zaktualizować statusu usterki.');
                return;
            }

            setFaults((prev) => prev.map((fault) => (
                fault.id === selectedFault ? { ...fault, status: statusToSet } : fault
            )));
            closeModal();
            alert('Status usterki został zaktualizowany.');
        } catch (err) {
            console.error('Resolve fault error:', err);
            alert(err.message || 'Nie udało się zaktualizować statusu usterki.');
        }
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

    const handleLogout = () => {
        clearAuthToken();
        sessionStorage.removeItem('userRole');
        navigate('/');
    };

    return (
        <div className="admin-wrapper">
            <header className="admin-header">
                <h1 className="logo-text">Akademik+</h1>
                <h2 className="welcome-text">Witaj, {adminName}!</h2>
                <div className="header-actions">
                    <button className="secondary-btn" onClick={() => navigate('/history')}>Historia płatności</button>
                    <button className="secondary-btn" onClick={handleLogout}>Wyloguj</button>
                </div>
            </header>

            {error && <div className="error-message" role="alert">{error}</div>}
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
                                className={`fault-item ${selectedFault === fault.id ? 'selected' : ''}`}
                                onClick={() => setSelectedFault(fault.id)}
                            >
                                {faultDescription(fault)}
                            </div>
                        )) : <div>Brak usterek.</div>}
                    </div>
                    <button className="primary-btn mt-auto" onClick={() => setActiveModal('resolveFault')}>
                        Zmień status usterki
                    </button>
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
                        <button className="primary-btn" onClick={() => setActiveModal('resolveFault')}>Zmień status usterki</button>
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

            {activeModal === 'resolveFault' && (
                <div className="admin-modal-overlay">
                    <div className="admin-modal-content">
                        <form onSubmit={handleResolveFault}>
                            <h2>Zmiana statusu usterki</h2>
                            <p><strong>Wybrana usterka:</strong> {selectedFault ? faultDescription(faults.find((f) => f.id === selectedFault) || {}) : 'Brak wyboru'}</p>
                            <div className="form-group">
                                <label>Nowy status:</label>
                                <select value={statusToSet} onChange={(e) => setStatusToSet(e.target.value)}>
                                    <option value="Przyjeto">Przyjęto</option>
                                    <option value="Weryfikacja">Weryfikacja</option>
                                    <option value="W_trakcie_naprawy">W trakcie naprawy</option>
                                    <option value="Naprawiono">Naprawiono</option>
                                    <option value="Zakonczono_bez_naprawy">Zakończono bez naprawy</option>
                                </select>
                            </div>
                            <div className="modal-buttons">
                                <button type="button" className="cancel-btn" onClick={closeModal}>Anuluj</button>
                                <button type="submit" className="confirm-btn">Zapisz</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;

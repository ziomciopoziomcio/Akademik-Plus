import { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import './PaymentHistory.css';
import { apiFetch, readJsonOrText } from '../api';
import AppHeader from './AppHeader';

const removePolishChars = (text) => {
    if (!text) return '';
    const charMap = {
        'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
        'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N', 'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z',
    };
    return text.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (match) => charMap[match]);
};

const mapPayment = (payment) => ({
    id: payment.numer_rachunku ?? payment.id ?? `${payment.data || payment.date}-${payment.opis || payment.desc}`,
    date: payment.data_wystawienia || payment.data || payment.date || '',
    desc: payment.okres_rozliczeniowy || payment.opis || payment.desc || '',
    amount: Number(payment.kwota ?? payment.amount ?? 0),
    status: payment.czy_oplacone === true || payment.oplacone === true || payment.status === 'OPŁACONE' ? 'OPŁACONE' : 'NIEOPŁACONE',
});

const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('pl-PL');
};

const PaymentHistory = () => {
    const [payments, setPayments] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [emptyMessage, setEmptyMessage] = useState('');

    const role = useMemo(() => (sessionStorage.getItem('userRole') || '').toLowerCase(), []);
    const isAdmin = role.includes('admin');

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            try {
                const endpoint = isAdmin ? '/rachunki' : '/rachunki/moje';
                const response = await apiFetch(endpoint);
                if (!mounted) return;
                if (response.ok) {
                    const data = await readJsonOrText(response);
                    const items = Array.isArray(data) ? data : data?.rachunki || data?.items || [];
                    setPayments(items.map(mapPayment));
                    setEmptyMessage(items.length ? '' : 'Brak aktywnych rachunków.');
                    setError('');
                } else if (response.status === 404) {
                    setPayments([]);
                    setEmptyMessage('Brak aktywnych rachunków.');
                    setError('');
                } else if (response.status === 401 || response.status === 403) {
                    setError('Brak dostępu do historii płatności. Zaloguj się ponownie lub sprawdź uprawnienia.');
                } else {
                    setError('Nie udało się pobrać historii płatności.');
                }
            } catch (err) {
                console.error('Payment history load error:', err);
                if (mounted) setError('Nie udało się pobrać rachunków z API.');
            } finally {
                if (mounted) setLoading(false);
            }
        };
        load();
        return () => {
            mounted = false;
        };
    }, [isAdmin]);

    const handleGeneratePdf = (id) => {
        const payment = payments.find((p) => p.id === id);
        if (!payment) return;

        const pdf = new jsPDF();
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(22);
        pdf.text('Potwierdzenie platnosci', 20, 20);

        pdf.setFontSize(16);
        pdf.setTextColor(100, 100, 100);
        pdf.text('System Akademik+', 20, 30);

        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.5);
        pdf.line(20, 35, 190, 35);

        pdf.setTextColor(0, 0, 0);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(12);

        pdf.text(`Numer transakcji: #TXN-${payment.id}-AKD`, 20, 50);
        pdf.text(`Data wystawienia: ${formatDate(payment.date)}`, 20, 60);
        pdf.text(`Tytulem: ${removePolishChars(payment.desc)}`, 20, 70);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.text(`Kwota: ${payment.amount} PLN`, 20, 90);
        pdf.text('Status: ', 20, 100);

        pdf.setTextColor(payment.status === 'OPŁACONE' ? 0 : 200, payment.status === 'OPŁACONE' ? 150 : 0, 0);
        pdf.text(removePolishChars(payment.status), 40, 100);

        pdf.setTextColor(150, 150, 150);
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(10);
        pdf.text('Dokument wygenerowany automatycznie, nie wymaga podpisu.', 20, 130);
        pdf.save(`Rachunek_${payment.id}_${payment.date}.pdf`);
    };

    const handleOpenPaymentModal = () => setIsModalOpen(true);
    const handleCloseModal = () => setIsModalOpen(false);

    const handleConfirmPayment = () => {
        setIsProcessing(true);
        setTimeout(() => {
            setIsProcessing(false);
            setIsModalOpen(false);
            alert('Płatności są obsługiwane przez administrację.');
        }, 1000);
    };

    const handleTogglePaid = async (payment) => {
        const next = payment.status !== 'OPŁACONE';
        const response = await apiFetch(`/rachunki/${payment.id}/oplacone`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ czy_oplacone: next }),
        });
        if (!response.ok) {
            const body = await readJsonOrText(response);
            alert(typeof body === 'string' ? body : body?.error || 'Nie udało się zaktualizować rachunku.');
            return;
        }
        setPayments((prev) => prev.map((item) => (
            item.id === payment.id ? { ...item, status: next ? 'OPŁACONE' : 'NIEOPŁACONE' } : item
        )));
    };

    return (
        <div className="payment-page-wrapper">
            <AppHeader role={isAdmin ? 'Administrator' : 'Mieszkaniec'} greeting={isAdmin ? 'Panel rozliczeń administratora' : undefined} />

            {error && <div className="error-message" role="alert">{error}</div>}
            {loading && <div className="loading-message">Ładowanie rachunków z API...</div>}

            <div className="payment-expanded-card">
                <h2 className="payment-card-title">{isAdmin ? 'Globalna historia rachunków' : 'Historia opłat'}</h2>

                <div className="payment-table-wrapper">
                    <table className="payment-full-table">
                        <thead>
                        <tr>
                            <th>Data</th>
                            <th>Opis płatności</th>
                            <th>Kwota</th>
                            <th>Status</th>
                            <th>{isAdmin ? 'Kontrola' : 'Rachunek'}</th>
                        </tr>
                        </thead>
                        <tbody>
                        {payments.length ? payments.map((payment) => (
                            <tr key={payment.id}>
                                <td className="col-date">{formatDate(payment.date)}</td>
                                <td className="col-desc">{payment.desc}</td>
                                <td className="col-amount">{payment.amount} zł</td>
                                <td className="col-status">
                                    <span className={`status-badge ${payment.status === 'OPŁACONE' ? 'paid' : 'unpaid'}`}>
                                        {payment.status}
                                    </span>
                                </td>
                                <td className="col-action">
                                    {isAdmin ? (
                                        <button className="pdf-btn" onClick={() => handleTogglePaid(payment)}>
                                            Oznacz jako {payment.status === 'OPŁACONE' ? 'NIEOPŁACONE' : 'OPŁACONE'}
                                        </button>
                                    ) : (
                                        <button className="pdf-btn" onClick={() => handleGeneratePdf(payment.id)}>
                                            Wygeneruj rachunek PDF
                                        </button>
                                    )}
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan="5">{emptyMessage || 'Brak rachunków.'}</td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>

                {!isAdmin ? (
                    <button className="payment-main-btn" onClick={handleOpenPaymentModal}>
                        Dokonaj płatności
                    </button>
                ) : null}
            </div>

            {isModalOpen && (
                <div className="payment-modal-overlay">
                    <div className="payment-modal-content">
                        <h2>Udawana bramka płatności</h2>
                        <p>Wybierz metodę płatności i zatwierdź.</p>

                        <div className="fake-payment-methods">
                            <label><input type="radio" name="method" defaultChecked /> BLIK</label>
                            <label><input type="radio" name="method" /> Karta płatnicza</label>
                            <label><input type="radio" name="method" /> Przelew online</label>
                        </div>

                        <div className="modal-buttons">
                            <button className="cancel-btn" onClick={handleCloseModal} disabled={isProcessing}>
                                Anuluj
                            </button>
                            <button className="confirm-btn" onClick={handleConfirmPayment} disabled={isProcessing}>
                                {isProcessing ? 'Przetwarzanie...' : 'Zapłać 700 zł'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PaymentHistory;

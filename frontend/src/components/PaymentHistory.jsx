import { useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import { useNavigate } from 'react-router-dom';
import './PaymentHistory.css';
import { apiFetch, readJsonOrText, clearAuthToken } from '../api';

const removePolishChars = (text) => {
    if (!text) return '';
    const charMap = {
        'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
        'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N', 'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z'
    };
    return text.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, match => charMap[match]);
};

const mapPayment = (payment) => ({
    id: payment.numer_rachunku ?? payment.id ?? `${payment.data || payment.date}-${payment.opis || payment.desc}`,
    date: payment.data_wystawienia || payment.data || payment.date || '',
    desc: payment.okres_rozliczeniowy || payment.opis || payment.desc || '',
    amount: Number(payment.kwota ?? payment.amount ?? 0),
    status: (payment.czy_oplacone === true || payment.oplacone === true || payment.status === 'OPŁACONE' ? 'OPŁACONE' : payment.status || 'NIEOPŁACONE').toString().toUpperCase(),
});

const PaymentHistory = () => {
    const navigate = useNavigate();
    const [payments, setPayments] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [emptyMessage, setEmptyMessage] = useState('');

    useEffect(() => {
        let mounted = true;

        const loadPayments = async () => {
            setLoading(true);
            setError('');
            setEmptyMessage('');

            try {
                const response = await apiFetch('/rachunki/moje');
                if (response.ok) {
                    const data = await readJsonOrText(response);
                    const items = Array.isArray(data) ? data : data?.rachunki || data?.items || [];
                    if (mounted) {
                        setPayments(items.map(mapPayment));
                        if (!items.length) setEmptyMessage('Brak aktywnych rachunków.');
                    }
                } else if (response.status === 404) {
                    if (mounted) {
                        setPayments([]);
                        setEmptyMessage('Brak aktywnych rachunków.');
                    }
                } else if (response.status === 401 || response.status === 403) {
                    if (mounted) setError('Brak dostępu do historii płatności. Zaloguj się ponownie lub sprawdź uprawnienia.');
                } else {
                    if (mounted) setError('Nie udało się pobrać historii płatności.');
                }
            } catch (err) {
                console.error('Payment history load error:', err);
                if (mounted) setError('Nie udało się pobrać rachunków z API.');
            } finally {
                if (mounted) setLoading(false);
            }
        };

        loadPayments();
        return () => {
            mounted = false;
        };
    }, []);

    const handleGeneratePdf = (id) => {
        const payment = payments.find(p => p.id === id);
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
        pdf.text(`Data wystawienia: ${payment.date}`, 20, 60);
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
        }, 1500);
    };

    const handleLogout = () => {
        clearAuthToken();
        sessionStorage.removeItem('userRole');
        navigate('/');
    };

    return (
        <div className="payment-page-wrapper">
            <header className="payment-header">
                <h1 className="payment-logo-text">Akademik+</h1>
                <div className="header-actions">
                    <button className="secondary-btn" onClick={() => navigate('/dashboard')}>Powrót do panelu</button>
                    <button className="secondary-btn" onClick={handleLogout}>Wyloguj</button>
                </div>
            </header>

            {error && <div className="error-message" role="alert">{error}</div>}
            {loading && <div className="loading-message">Ładowanie rachunków z API...</div>}

            <div className="payment-expanded-card">
                <h2 className="payment-card-title">Historia opłat</h2>

                <div className="payment-table-wrapper">
                    <table className="payment-full-table">
                        <thead>
                        <tr>
                            <th>Data</th>
                            <th>Opis płatności</th>
                            <th>Kwota</th>
                            <th>Status</th>
                            <th>Rachunek</th>
                        </tr>
                        </thead>
                        <tbody>
                        {payments.length ? payments.map((payment) => (
                            <tr key={payment.id}>
                                <td className="col-date">{payment.date}</td>
                                <td className="col-desc">{payment.desc}</td>
                                <td className="col-amount">{payment.amount} zł</td>
                                <td className="col-status">
                                    <span className={`status-badge ${payment.status === 'OPŁACONE' ? 'paid' : 'unpaid'}`}>
                                        {payment.status}
                                    </span>
                                </td>
                                <td className="col-action">
                                    <button className="pdf-btn" onClick={() => handleGeneratePdf(payment.id)}>
                                        Wygeneruj rachunek PDF
                                    </button>
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

                <button className="payment-main-btn" onClick={handleOpenPaymentModal}>
                    Dokonaj płatności
                </button>
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

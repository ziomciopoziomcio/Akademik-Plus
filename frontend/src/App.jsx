import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

import Login from './components/Login';
import AuthCode from './components/AuthCode';
import Dashboard from "./components/Dashboard";
import AdminDashboard from "./components/AdminDashboard";
import PaymentHistory from "./components/PaymentHistory";
import './App.css';

const PageWrapper = ({ children }) => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
    >
        {children}
    </motion.div>
);

function AnimatedApp() {
    const location = useLocation();

    return (
        <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
                <Route path="/" element={<PageWrapper><Login /></PageWrapper>} />
                <Route path="/auth" element={<PageWrapper><AuthCode /></PageWrapper>} />
                <Route path="/dashboard" element={<PageWrapper><Dashboard /></PageWrapper>} />
                <Route path="/admin" element={<PageWrapper><AdminDashboard /></PageWrapper>} />
                <Route path="/history" element={<PageWrapper><PaymentHistory /></PageWrapper>} />
            </Routes>
        </AnimatePresence>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <div className="App">
                <AnimatedApp />
            </div>
        </BrowserRouter>
    );
}

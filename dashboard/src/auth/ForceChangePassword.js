import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const ForceChangePassword = () => {
    const [form, setForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
    const [showOld, setShowOld] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const user = JSON.parse(localStorage.getItem('user') || '{}');

    useEffect(() => {
        // If user has already changed password, redirect to dashboard
        if (!user?.id || user?.password_changed === true) {
            redirectToDashboard(user?.role);
        }
    }, []);

    const redirectToDashboard = (role) => {
        if (role === 'Admin') window.location.href = '/admin/dashboard';
        else if (role === 'SuperResponder') window.location.href = '/super-responder/dashboard';
        else if (role === 'Responder') window.location.href = '/responder/dashboard';
        else window.location.href = '/login';
    };

    const getStrength = (pwd) => {
        let score = 0;
        if (pwd.length >= 8) score++;
        if (/[A-Z]/.test(pwd)) score++;
        if (/[0-9]/.test(pwd)) score++;
        if (/[^A-Za-z0-9]/.test(pwd)) score++;
        return score;
    };

    const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'];
    const strengthColor = ['', '#ef4444', '#f59e0b', '#3b82f6', '#22c55e'];
    const strength = getStrength(form.newPassword);

    const validate = () => {
        if (!form.oldPassword) return 'Please enter your current password.';
        if (form.newPassword.length < 8) return 'New password must be at least 8 characters.';
        if (form.newPassword === form.oldPassword) return 'New password must be different from the current password.';
        if (form.newPassword !== form.confirmPassword) return 'New password and confirm password do not match.';
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const err = validate();
        if (err) { setError(err); return; }

        setLoading(true);
        try {
            const res = await axios.post(`${API_URL}/users/change-first-password`, {
                userId: user.id,
                oldPassword: form.oldPassword,
                newPassword: form.newPassword,
            });

            if (res.data.success) {
                // Update localStorage to mark password as changed
                const updatedUser = { ...user, password_changed: true };
                localStorage.setItem('user', JSON.stringify(updatedUser));
                setSuccess(true);
                setTimeout(() => redirectToDashboard(user.role), 1800);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to change password. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={S.page}>
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes fadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
                @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
                .cp-card { animation: fadeUp 0.45s ease both; }
                .cp-input:focus { border-color: #3b82f6 !important; box-shadow: 0 0 0 3px rgba(59,130,246,0.15); }
                .cp-btn:hover:not(:disabled) { background: linear-gradient(135deg,#2563eb,#4f46e5) !important; transform: translateY(-1px); }
            `}</style>

            <div style={S.card} className="cp-card">
                {/* Header */}
                <div style={S.header}>
                    <div style={S.iconWrap}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            <circle cx="12" cy="16" r="1" fill="#f59e0b"/>
                        </svg>
                    </div>
                    <h2 style={S.title}>Change Your Password</h2>
                    <p style={S.subtitle}>
                        Welcome, <strong style={{ color: '#e2e8f0' }}>{user.fullName || 'User'}</strong>.<br />
                        For security, you must set a new password before accessing the system.
                    </p>
                    <div style={S.defaultHint}>
                        <span>🔑</span>
                        <span>Default password: <code style={S.code}>safecity1234</code></span>
                    </div>
                </div>

                {/* Success state */}
                {success ? (
                    <div style={S.successBox}>
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                        <p style={{ color: '#86efac', fontWeight: 600, marginTop: 12 }}>Password changed successfully!</p>
                        <p style={{ color: '#4ade80', fontSize: 13, marginTop: 4 }}>Redirecting to your dashboard…</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} noValidate>
                        {/* Error */}
                        {error && (
                            <div style={S.errorBox}>
                                <span>⚠️</span>
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Old Password */}
                        <div style={S.fieldGroup}>
                            <label style={S.label}>Current Password (Default)</label>
                            <div style={S.inputWrap}>
                                <input
                                    type={showOld ? 'text' : 'password'}
                                    className="cp-input"
                                    style={S.input}
                                    placeholder="Enter default password (safecity1234)"
                                    value={form.oldPassword}
                                    onChange={(e) => setForm({ ...form, oldPassword: e.target.value })}
                                    required
                                    autoComplete="current-password"
                                />
                                <button type="button" style={S.eyeBtn} onClick={() => setShowOld(!showOld)}>
                                    {showOld ? <EyeOffIcon /> : <EyeIcon />}
                                </button>
                            </div>
                        </div>

                        {/* New Password */}
                        <div style={S.fieldGroup}>
                            <label style={S.label}>New Password</label>
                            <div style={S.inputWrap}>
                                <input
                                    type={showNew ? 'text' : 'password'}
                                    className="cp-input"
                                    style={S.input}
                                    placeholder="Minimum 8 characters"
                                    value={form.newPassword}
                                    onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                                    required
                                    autoComplete="new-password"
                                />
                                <button type="button" style={S.eyeBtn} onClick={() => setShowNew(!showNew)}>
                                    {showNew ? <EyeOffIcon /> : <EyeIcon />}
                                </button>
                            </div>
                            {/* Strength bar */}
                            {form.newPassword.length > 0 && (
                                <div style={{ marginTop: 8 }}>
                                    <div style={S.strengthBar}>
                                        {[1, 2, 3, 4].map(i => (
                                            <div key={i} style={{
                                                ...S.strengthSegment,
                                                backgroundColor: i <= strength ? strengthColor[strength] : '#1e293b'
                                            }} />
                                        ))}
                                    </div>
                                    <span style={{ ...S.strengthLabel, color: strengthColor[strength] }}>
                                        {strengthLabel[strength]}
                                    </span>
                                </div>
                            )}
                            <div style={S.requirements}>
                                <Req met={form.newPassword.length >= 8} label="At least 8 characters" />
                                <Req met={/[A-Z]/.test(form.newPassword)} label="One uppercase letter" />
                                <Req met={/[0-9]/.test(form.newPassword)} label="One number" />
                                <Req met={/[^A-Za-z0-9]/.test(form.newPassword)} label="One special character" />
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div style={S.fieldGroup}>
                            <label style={S.label}>Confirm New Password</label>
                            <div style={S.inputWrap}>
                                <input
                                    type={showConfirm ? 'text' : 'password'}
                                    className="cp-input"
                                    style={{
                                        ...S.input,
                                        borderColor: form.confirmPassword && form.confirmPassword !== form.newPassword
                                            ? 'rgba(239,68,68,0.5)' : undefined
                                    }}
                                    placeholder="Re-enter new password"
                                    value={form.confirmPassword}
                                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                                    required
                                    autoComplete="new-password"
                                />
                                <button type="button" style={S.eyeBtn} onClick={() => setShowConfirm(!showConfirm)}>
                                    {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
                                </button>
                            </div>
                            {form.confirmPassword && form.confirmPassword !== form.newPassword && (
                                <span style={{ color: '#f87171', fontSize: 12, marginTop: 4, display: 'block' }}>
                                    Passwords do not match
                                </span>
                            )}
                            {form.confirmPassword && form.confirmPassword === form.newPassword && (
                                <span style={{ color: '#4ade80', fontSize: 12, marginTop: 4, display: 'block' }}>
                                    ✓ Passwords match
                                </span>
                            )}
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            className="cp-btn"
                            style={{ ...S.submitBtn, ...(loading ? S.submitDisabled : {}) }}
                            disabled={loading}
                        >
                            {loading ? (
                                <span style={S.spinRow}><span style={S.spinner} /> Changing Password…</span>
                            ) : (
                                <span style={S.spinRow}>
                                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                    </svg>
                                    Set New Password &amp; Continue
                                </span>
                            )}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

const Req = ({ met, label }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
        <span style={{ color: met ? '#4ade80' : '#475569', fontSize: 12 }}>{met ? '✓' : '○'}</span>
        <span style={{ color: met ? '#86efac' : '#475569', fontSize: 12 }}>{label}</span>
    </div>
);

const EyeIcon = () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
);
const EyeOffIcon = () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
);

const S = {
    page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', padding: '24px 16px', fontFamily: "'Inter','Segoe UI',sans-serif" },

    card: { width: '100%', maxWidth: '440px', backgroundColor: '#111827', border: '1px solid #1e293b', borderRadius: '24px', padding: '36px 32px', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' },

    header: { textAlign: 'center', marginBottom: '28px' },
    iconWrap: { width: 56, height: 56, borderRadius: '50%', backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' },
    title: { color: '#f1f5f9', fontSize: '22px', fontWeight: 700, margin: '0 0 8px 0' },
    subtitle: { color: '#64748b', fontSize: '13.5px', lineHeight: 1.6, margin: '0 0 14px 0' },
    defaultHint: { display: 'inline-flex', alignItems: 'center', gap: 8, backgroundColor: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: '7px 14px', color: '#94a3b8', fontSize: 12.5 },
    code: { backgroundColor: 'rgba(99,102,241,0.15)', color: '#a5b4fc', padding: '2px 7px', borderRadius: 6, fontFamily: 'monospace', fontWeight: 700 },

    errorBox: { display: 'flex', alignItems: 'flex-start', gap: 10, backgroundColor: 'rgba(239,68,68,0.08)', color: '#f87171', padding: '11px 14px', borderRadius: 12, marginBottom: 20, border: '1px solid rgba(239,68,68,0.2)', fontSize: 13.5, lineHeight: 1.5 },

    successBox: { textAlign: 'center', padding: '28px 0', animation: 'fadeIn 0.4s ease' },

    fieldGroup: { marginBottom: 20 },
    label: { display: 'block', color: '#94a3b8', fontSize: 13, fontWeight: 500, marginBottom: 8 },
    inputWrap: { position: 'relative', display: 'flex', alignItems: 'center' },
    input: { width: '100%', padding: '12px 44px 12px 14px', borderRadius: 12, border: '1.5px solid #1e293b', backgroundColor: '#0f172a', color: '#f1f5f9', fontSize: 14.5, outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s', boxSizing: 'border-box' },
    eyeBtn: { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', zIndex: 1 },

    strengthBar: { display: 'flex', gap: 4 },
    strengthSegment: { flex: 1, height: 4, borderRadius: 4, transition: 'background-color 0.3s' },
    strengthLabel: { fontSize: 11.5, fontWeight: 600, marginTop: 4, display: 'block' },
    requirements: { marginTop: 10, backgroundColor: 'rgba(15,23,42,0.6)', borderRadius: 10, padding: '10px 12px' },

    submitBtn: { width: '100%', padding: 13, background: 'linear-gradient(135deg,#3b82f6,#6366f1)', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 600, fontSize: 15, transition: 'all 0.2s', marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    submitDisabled: { opacity: 0.65, cursor: 'not-allowed' },
    spinRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
    spinner: { display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 },
};

export default ForceChangePassword;

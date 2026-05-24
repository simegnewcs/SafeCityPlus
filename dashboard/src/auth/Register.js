import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const Register = () => {
    const [formData, setFormData] = useState({ fullName: '', phone: '', password: '', confirmPassword: '' });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [touched, setTouched] = useState({});
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleBlur = (e) => {
        setTouched({ ...touched, [e.target.name]: true });
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match. Please re-enter them.');
            return;
        }
        setLoading(true);
        try {
            const { confirmPassword, ...payload } = formData;
            const res = await axios.post('http://localhost:5000/api/auth/register', payload);
            if (res.data.success) {
                setSuccess('Account created successfully! Redirecting to sign in…');
                setTimeout(() => navigate('/login'), 2000);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const phoneInvalid = touched.phone && formData.phone.length > 0 && !/^0[79]\d{8}$/.test(formData.phone);
    const passwordWeak = touched.password && formData.password.length > 0 && formData.password.length < 6;
    const confirmMismatch = touched.confirmPassword && formData.confirmPassword.length > 0 && formData.password !== formData.confirmPassword;

    const passwordStrength = (() => {
        const p = formData.password;
        if (!p) return null;
        let score = 0;
        if (p.length >= 8) score++;
        if (/[A-Z]/.test(p)) score++;
        if (/[0-9]/.test(p)) score++;
        if (/[^A-Za-z0-9]/.test(p)) score++;
        if (score <= 1) return { label: 'Weak', color: '#ef4444', width: '25%' };
        if (score === 2) return { label: 'Fair', color: '#f59e0b', width: '50%' };
        if (score === 3) return { label: 'Good', color: '#22c55e', width: '75%' };
        return { label: 'Strong', color: '#10b981', width: '100%' };
    })();

    return (
        <div style={styles.page}>
            {/* ── Left branded panel ── */}
            <div style={styles.leftPanel}>
                <div style={styles.leftInner}>
                    <div style={styles.logoRow}>
                        <div style={styles.logoIcon}>
                            <img src="/safecityplus.png" alt="SafeCity+ Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <span style={styles.logoText}>Safe City Plus</span>
                    </div>

                    <div style={styles.heroSection}>
                        <h1 style={styles.heroTitle}>Join the Command Network</h1>
                        <p style={styles.heroSub}>
                            Create your Admin account to start managing city safety operations and coordinating responders.
                        </p>
                    </div>

                    {/* Mind-map onboarding steps */}
                    <div style={styles.mindMap}>
                        {[
                            { n: '1', title: 'Create Your Account', desc: 'Fill in your name, phone, and a secure password.' },
                            { n: '2', title: 'Await Verification', desc: 'A super-admin reviews and activates your account.' },
                            { n: '3', title: 'Start Operations', desc: 'Log in and begin monitoring incidents immediately.' },
                        ].map((s, i) => (
                            <div key={s.n} style={styles.mindNode}>
                                <div style={styles.nodeColumn}>
                                    <div style={{...styles.nodeCircle, animationDelay: `${i * 0.18}s`}}>{s.n}</div>
                                    {i < 2 && <div style={styles.nodeConnector}></div>}
                                </div>
                                <div style={{...styles.nodeContent, animationDelay: `${i * 0.18 + 0.08}s`}}>
                                    <div style={styles.nodeTitle}>{s.title}</div>
                                    <div style={styles.nodeDesc}>{s.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={styles.roleSection}>
                        <div style={styles.roleRow}>
                            <div style={styles.roleNode}>A</div>
                            <div>
                                <div style={styles.roleLabel}>Admin</div>
                                <div style={styles.roleDesc}>Manage users, review all incidents, generate reports.</div>
                            </div>
                        </div>
                        <div style={styles.roleRow}>
                            <div style={{...styles.roleNode, backgroundColor: 'rgba(14,165,233,0.12)', borderColor: 'rgba(255,255,255,0.3)'}}>R</div>
                            <div>
                                <div style={styles.roleLabel}>Responder</div>
                                <div style={styles.roleDesc}>Added by Admin after account creation.</div>
                            </div>
                        </div>
                    </div>

                    <div style={styles.tipBox}>
                        <div style={styles.tipAccent}></div>
                        <span style={styles.tipText}>Use a strong password with at least 8 characters, including uppercase letters and numbers.</span>
                    </div>
                </div>
            </div>

            {/* ── Right form panel ── */}
            <div style={styles.rightPanel}>
                <div style={styles.formCard}>
                    <div style={styles.formHeader}>
                        <h2 style={styles.formTitle}>Create Admin Account</h2>
                        <p style={styles.formSub}>Fill in the details below to get started</p>
                    </div>

                    {error && (
                        <div style={styles.errorBox} role="alert">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink: 0, marginTop: '1px'}}>
                                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                            </svg>
                            <span>{error}</span>
                        </div>
                    )}

                    {success && (
                        <div style={styles.successBox} role="status">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink: 0, marginTop: '1px'}}>
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                            </svg>
                            <span>{success}</span>
                        </div>
                    )}

                    <form onSubmit={handleRegister} noValidate>
                        <div style={styles.fieldGroup}>
                            <label style={styles.label} htmlFor="reg-fullname">Full Name</label>
                            <input
                                id="reg-fullname"
                                name="fullName"
                                type="text"
                                autoComplete="name"
                                style={styles.input}
                                placeholder="e.g. Abebe Kebede"
                                value={formData.fullName}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                required
                            />
                        </div>

                        <div style={styles.fieldGroup}>
                            <label style={styles.label} htmlFor="reg-phone">Phone Number</label>
                            <input
                                id="reg-phone"
                                name="phone"
                                type="tel"
                                autoComplete="tel"
                                style={{...styles.input, ...(phoneInvalid ? styles.inputError : {})}}
                                placeholder="09xxxxxxxx or 07xxxxxxxx"
                                value={formData.phone}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                required
                            />
                            {phoneInvalid && <span style={styles.fieldError}>Enter a valid Ethiopian phone number (09... or 07...)</span>}
                        </div>

                        <div style={styles.fieldGroup}>
                            <label style={styles.label} htmlFor="reg-password">Password</label>
                            <div style={styles.passwordWrapper}>
                                <input
                                    id="reg-password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="new-password"
                                    style={{...styles.input, paddingRight: '44px', ...(passwordWeak ? styles.inputError : {})}}
                                    placeholder="Min. 6 characters"
                                    value={formData.password}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    required
                                />
                                <button type="button" style={styles.eyeBtn} onClick={() => setShowPassword(!showPassword)} tabIndex={-1} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                                    {showPassword ? (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
                                        </svg>
                                    ) : (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                                        </svg>
                                    )}
                                </button>
                            </div>
                            {passwordWeak && <span style={styles.fieldError}>Password must be at least 6 characters</span>}
                            {passwordStrength && formData.password && (
                                <div style={styles.strengthRow}>
                                    <div style={styles.strengthBar}>
                                        <div style={{...styles.strengthFill, width: passwordStrength.width, backgroundColor: passwordStrength.color}}></div>
                                    </div>
                                    <span style={{...styles.strengthLabel, color: passwordStrength.color}}>{passwordStrength.label}</span>
                                </div>
                            )}
                        </div>

                        <div style={styles.fieldGroup}>
                            <label style={styles.label} htmlFor="reg-confirm">Confirm Password</label>
                            <div style={styles.passwordWrapper}>
                                <input
                                    id="reg-confirm"
                                    name="confirmPassword"
                                    type={showConfirm ? 'text' : 'password'}
                                    autoComplete="new-password"
                                    style={{...styles.input, paddingRight: '44px', ...(confirmMismatch ? styles.inputError : {})}}
                                    placeholder="Re-enter your password"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    onBlur={handleBlur}
                                    required
                                />
                                <button type="button" style={styles.eyeBtn} onClick={() => setShowConfirm(!showConfirm)} tabIndex={-1} aria-label={showConfirm ? 'Hide password' : 'Show password'}>
                                    {showConfirm ? (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
                                        </svg>
                                    ) : (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                                        </svg>
                                    )}
                                </button>
                            </div>
                            {confirmMismatch && <span style={styles.fieldError}>Passwords do not match</span>}
                        </div>

                        <button
                            type="submit"
                            style={{...styles.submitBtn, ...(loading ? styles.submitBtnLoading : {})}}
                            disabled={loading}
                        >
                            {loading ? (
                                <span style={styles.spinnerRow}>
                                    <span style={styles.spinner}></span>
                                    Creating account…
                                </span>
                            ) : 'Create Account'}
                        </button>
                    </form>

                    <div style={styles.divider}>
                        <span style={styles.dividerLine}></span>
                        <span style={styles.dividerText}>Already have an account?</span>
                        <span style={styles.dividerLine}></span>
                    </div>

                    <Link to="/login" style={styles.loginLink}>
                        Sign In Instead
                    </Link>

                    <p style={styles.footerNote}>
                        By registering you agree to the Safe City Plus platform policies.
                    </p>
                </div>
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes nodeIn {
                    from { opacity: 0; transform: scale(0.4); }
                    to   { opacity: 1; transform: scale(1); }
                }
                @keyframes fadeSlide {
                    from { opacity: 0; transform: translateX(-10px); }
                    to   { opacity: 1; transform: translateX(0); }
                }
                @media (max-width: 768px) {
                    .auth-left { display: none !important; }
                    .auth-right { width: 100% !important; }
                }
            `}</style>
        </div>
    );
};

const styles = {
    page: {
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'row',
        backgroundColor: '#0f172a',
        fontFamily: "'Times New Roman', Times, serif",
    },

    /* ── Left panel — light blue/white theme ── */
    leftPanel: {
        flex: '0 0 48%',
        backgroundImage: `linear-gradient(160deg, rgba(3,105,161,0.88) 0%, rgba(14,165,233,0.82) 45%, rgba(56,189,248,0.78) 100%), url('https://images.unsplash.com/photo-1580674684081-7617fbf3d745?auto=format&fit=crop&w=1200&q=80')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 44px',
        position: 'relative',
        overflow: 'hidden',
    },
    leftInner: {
        maxWidth: '400px',
        width: '100%',
        position: 'relative',
        zIndex: 1,
    },
    logoRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '44px',
    },
    logoIcon: {
        width: '46px',
        height: '46px',
        borderRadius: '50%',
        backgroundColor: 'rgba(255,255,255,0.2)',
        border: '2px solid rgba(255,255,255,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    logoText: {
        color: '#ffffff',
        fontSize: '20px',
        fontWeight: '700',
        letterSpacing: '-0.3px',
        textShadow: '0 1px 3px rgba(0,0,0,0.15)',
    },
    heroSection: {
        marginBottom: '32px',
    },
    heroTitle: {
        color: '#ffffff',
        fontSize: '28px',
        fontWeight: '800',
        lineHeight: '1.2',
        margin: '0 0 10px 0',
        letterSpacing: '-0.4px',
        textShadow: '0 1px 4px rgba(0,0,0,0.1)',
    },
    heroSub: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: '14px',
        lineHeight: '1.65',
        margin: 0,
    },

    /* Mind-map numbered nodes */
    mindMap: {
        display: 'flex',
        flexDirection: 'column',
        marginBottom: '28px',
    },
    mindNode: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '16px',
    },
    nodeColumn: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        flexShrink: 0,
    },
    nodeCircle: {
        width: '34px',
        height: '34px',
        borderRadius: '50%',
        backgroundColor: '#ffffff',
        color: '#0369a1',
        fontSize: '14px',
        fontWeight: '800',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
        animation: 'nodeIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
        flexShrink: 0,
    },
    nodeConnector: {
        width: '2px',
        height: '28px',
        backgroundColor: 'rgba(255,255,255,0.35)',
        borderRadius: '1px',
        margin: '3px 0',
    },
    nodeContent: {
        paddingTop: '6px',
        paddingBottom: '20px',
        animation: 'fadeSlide 0.45s ease both',
    },
    nodeTitle: {
        color: '#ffffff',
        fontSize: '14px',
        fontWeight: '700',
        marginBottom: '3px',
        letterSpacing: '0.1px',
    },
    nodeDesc: {
        color: 'rgba(255,255,255,0.72)',
        fontSize: '12.5px',
        lineHeight: '1.55',
    },

    roleSection: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        marginBottom: '24px',
    },
    roleRow: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
    },
    roleNode: {
        width: '30px',
        height: '30px',
        borderRadius: '8px',
        backgroundColor: 'rgba(255,255,255,0.18)',
        border: '1px solid rgba(255,255,255,0.4)',
        color: '#ffffff',
        fontSize: '13px',
        fontWeight: '800',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        letterSpacing: '0.5px',
    },
    roleLabel: {
        color: '#ffffff',
        fontSize: '13px',
        fontWeight: '700',
        marginBottom: '2px',
    },
    roleDesc: {
        color: 'rgba(255,255,255,0.68)',
        fontSize: '12px',
        lineHeight: '1.5',
    },
    tipBox: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        backgroundColor: 'rgba(255,255,255,0.12)',
        border: '1px solid rgba(255,255,255,0.25)',
        borderRadius: '10px',
        padding: '13px 15px',
    },
    tipAccent: {
        width: '3px',
        minWidth: '3px',
        height: '36px',
        borderRadius: '2px',
        backgroundColor: '#ffffff',
        opacity: 0.6,
        marginTop: '1px',
    },
    tipText: { color: 'rgba(255,255,255,0.88)', fontSize: '12.5px', lineHeight: '1.65' },

    /* ── Right panel ── */
    rightPanel: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        backgroundColor: '#0f172a',
    },
    formCard: {
        width: '100%',
        maxWidth: '420px',
    },
    formHeader: {
        marginBottom: '28px',
    },
    formTitle: {
        color: '#f1f5f9',
        fontSize: '26px',
        fontWeight: '700',
        margin: '0 0 8px 0',
        letterSpacing: '-0.3px',
    },
    formSub: {
        color: '#64748b',
        fontSize: '14px',
        margin: 0,
    },
    errorBox: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        backgroundColor: 'rgba(239,68,68,0.08)',
        color: '#f87171',
        padding: '12px 14px',
        borderRadius: '10px',
        marginBottom: '20px',
        border: '1px solid rgba(239,68,68,0.25)',
        fontSize: '13.5px',
        lineHeight: '1.5',
    },
    successBox: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        backgroundColor: 'rgba(34,197,94,0.08)',
        color: '#4ade80',
        padding: '12px 14px',
        borderRadius: '10px',
        marginBottom: '20px',
        border: '1px solid rgba(34,197,94,0.25)',
        fontSize: '13.5px',
        lineHeight: '1.5',
    },
    fieldGroup: {
        marginBottom: '20px',
    },
    label: {
        display: 'block',
        color: '#cbd5e1',
        fontSize: '13.5px',
        fontWeight: '500',
        marginBottom: '8px',
        letterSpacing: '0.1px',
    },
    input: {
        width: '100%',
        padding: '11px 14px',
        borderRadius: '9px',
        border: '1.5px solid #1e293b',
        backgroundColor: '#1e293b',
        color: '#f1f5f9',
        fontSize: '14.5px',
        outline: 'none',
        transition: 'border-color 0.2s',
        boxSizing: 'border-box',
        lineHeight: '1.5',
    },
    inputError: {
        borderColor: 'rgba(239,68,68,0.6)',
    },
    fieldError: {
        display: 'block',
        color: '#f87171',
        fontSize: '12px',
        marginTop: '6px',
    },
    passwordWrapper: {
        position: 'relative',
    },
    eyeBtn: {
        position: 'absolute',
        right: '12px',
        top: '50%',
        transform: 'translateY(-50%)',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '4px',
        display: 'flex',
        alignItems: 'center',
    },
    strengthRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginTop: '8px',
    },
    strengthBar: {
        flex: 1,
        height: '4px',
        backgroundColor: '#1e293b',
        borderRadius: '2px',
        overflow: 'hidden',
    },
    strengthFill: {
        height: '100%',
        borderRadius: '2px',
        transition: 'width 0.3s, background-color 0.3s',
    },
    strengthLabel: {
        fontSize: '12px',
        fontWeight: '600',
        minWidth: '44px',
        textAlign: 'right',
    },
    submitBtn: {
        width: '100%',
        padding: '13px',
        backgroundColor: '#3b82f6',
        color: '#fff',
        border: 'none',
        borderRadius: '9px',
        cursor: 'pointer',
        fontWeight: '600',
        fontSize: '15px',
        letterSpacing: '0.2px',
        transition: 'background-color 0.2s, opacity 0.2s',
        marginTop: '4px',
    },
    submitBtnLoading: {
        opacity: 0.7,
        cursor: 'not-allowed',
    },
    spinnerRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
    },
    spinner: {
        display: 'inline-block',
        width: '16px',
        height: '16px',
        border: '2px solid rgba(255,255,255,0.3)',
        borderTopColor: '#fff',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
    },
    divider: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        margin: '24px 0 20px',
    },
    dividerLine: {
        flex: 1,
        height: '1px',
        backgroundColor: '#1e293b',
    },
    dividerText: {
        color: '#475569',
        fontSize: '12.5px',
        whiteSpace: 'nowrap',
    },
    loginLink: {
        display: 'block',
        width: '100%',
        padding: '12px',
        backgroundColor: 'transparent',
        color: '#93c5fd',
        border: '1.5px solid #1e3a5f',
        borderRadius: '9px',
        cursor: 'pointer',
        fontWeight: '500',
        fontSize: '14px',
        textAlign: 'center',
        textDecoration: 'none',
        transition: 'border-color 0.2s, color 0.2s',
        boxSizing: 'border-box',
    },
    footerNote: {
        color: '#334155',
        fontSize: '12px',
        textAlign: 'center',
        marginTop: '24px',
        lineHeight: '1.5',
    },
};

export default Register;
import React, { useState } from 'react';
import axios from 'axios';

const Login = () => {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [touched, setTouched] = useState({});
    const [focusedField, setFocusedField] = useState('');

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
    const handleBlur = (e) => { setTouched({ ...touched, [e.target.name]: true }); setFocusedField(''); };
    const handleFocus = (e) => setFocusedField(e.target.name);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await axios.post('http://localhost:5000/api/auth/login', formData);
            if (res.data.success) {
                // Fetch full profile to ensure responder_type and all fields are present
                let userData = res.data.user;
                try {
                    const profileRes = await axios.get(`http://localhost:5000/api/users/${userData.id}`);
                    if (profileRes.data?.id) {
                        userData = {
                            ...userData,
                            responder_type: profileRes.data.responder_type || userData.responder_type || null,
                            full_name: profileRes.data.full_name || userData.fullName,
                        };
                    }
                } catch {}
                localStorage.setItem('user', JSON.stringify(userData));
                const { role, password_changed } = userData;

                // Force password change on first login (password_changed === false)
                if (password_changed === false) {
                    window.location.href = '/change-password';
                    return;
                }

                if (role === 'Admin') window.location.href = '/admin/dashboard';
                else if (role === 'SuperResponder') window.location.href = '/super-responder/dashboard';
                else if (role === 'Responder') window.location.href = '/responder/dashboard';
                else setError('Access denied. This portal is for authorized personnel only.');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Sign in failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    const emailInvalid = touched.email && formData.email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);

    return (
        <div style={S.page}>
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes fadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
                .login-card { animation: fadeUp 0.5s ease both; }
                .login-input:focus { border-color: #3b82f6 !important; box-shadow: 0 0 0 3px rgba(59,130,246,0.15); }
                .login-btn:hover:not(:disabled) { background: linear-gradient(135deg,#2563eb,#4f46e5) !important; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(59,130,246,0.35); }
                .login-btn:active:not(:disabled) { transform: translateY(0); }
                .login-image-panel { display: flex; }
                .login-mobile-logo { display: none; }
                @media (max-width: 768px) {
                    .login-image-panel { display: none !important; }
                    .login-form-panel { flex: 1 !important; width: 100% !important; padding: 32px 20px !important; min-height: 100vh; }
                    .login-card { width: 100% !important; max-width: 100% !important; padding: 28px 22px !important; border-radius: 20px !important; box-shadow: none !important; }
                    .login-mobile-logo { display: flex !important; }
                }
                @media (max-width: 480px) {
                    .login-form-panel { padding: 20px 16px !important; }
                    .login-card { padding: 24px 16px !important; border-radius: 16px !important; }
                }
            `}</style>

            {/* ── Left: Form panel ── */}
            <div className="login-form-panel" style={S.formPanel}>
                {/* Mobile logo */}
                <div className="login-mobile-logo" style={S.mobileLogo}>
                    <div style={S.mobileLogoCircle}>
                        <img src="/safecityplus.png" alt="SafeCity+" style={{width:'100%',height:'100%',objectFit:'cover'}} />
                    </div>
                    <span style={S.mobileLogoName}>SafeCity+</span>
                </div>

                <div className="login-card" style={S.card}>
                    {/* Card header */}
                    <div style={S.cardHeader}>
                        <div style={S.cardBadge}>🔐 Secure Portal</div>
                        <h2 style={S.cardTitle}>Welcome back</h2>
                        <p style={S.cardSub}>Sign in to access your dashboard</p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div style={S.errorBox} role="alert">
                            <span style={S.errorIcon}>⚠️</span>
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleLogin} noValidate>
                        {/* Email */}
                        <div style={S.fieldGroup}>
                            <label style={S.label} htmlFor="login-email">Email Address</label>
                            <div style={S.inputWrap}>
                                <span style={S.inputIcon}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={focusedField==='email'?'#3b82f6':'#475569'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                                    </svg>
                                </span>
                                <input
                                    id="login-email" name="email" type="email" autoComplete="email"
                                    className="login-input"
                                    style={{...S.input, ...(emailInvalid ? S.inputErr : {})}}
                                    placeholder="you@example.com"
                                    value={formData.email}
                                    onChange={handleChange} onBlur={handleBlur} onFocus={handleFocus}
                                    required
                                />
                            </div>
                            {emailInvalid && <span style={S.fieldErr}>Enter a valid email address</span>}
                        </div>

                        {/* Password */}
                        <div style={S.fieldGroup}>
                            <label style={S.label} htmlFor="login-password">Password</label>
                            <div style={S.inputWrap}>
                                <span style={S.inputIcon}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={focusedField==='password'?'#3b82f6':'#475569'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                    </svg>
                                </span>
                                <input
                                    id="login-password" name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    className="login-input"
                                    style={{...S.input, paddingRight:'44px'}}
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={handleChange} onBlur={handleBlur} onFocus={handleFocus}
                                    required
                                />
                                <button type="button" style={S.eyeBtn} onClick={() => setShowPassword(!showPassword)} tabIndex={-1} aria-label={showPassword?'Hide':'Show'}>
                                    {showPassword ? (
                                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
                                        </svg>
                                    ) : (
                                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            className="login-btn"
                            style={{...S.submitBtn, ...(loading ? S.submitDisabled : {})}}
                            disabled={loading}
                        >
                            {loading ? (
                                <span style={S.spinRow}>
                                    <span style={S.spinner} />
                                    Signing in…
                                </span>
                            ) : (
                                <span style={S.spinRow}>
                                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
                                    </svg>
                                    Sign In
                                </span>
                            )}
                        </button>
                    </form>

                    {/* Footer */}
                    <div style={S.cardFooter}>
                        <div style={S.divider}><div style={S.divLine}/><span style={S.divText}>secure access</span><div style={S.divLine}/></div>
                        <div style={S.securityRow}>
                            <span style={S.securityItem}>🔒 SSL Encrypted</span>
                            <span style={S.securityItem}>👁️ Access Logged</span>
                            <span style={S.securityItem}>🛡️ 2FA Ready</span>
                        </div>
                        <p style={S.footNote}>Authorized personnel only. All sessions are monitored.</p>
                    </div>
                </div>
            </div>

            {/* ── Right: Image panel ── */}
            <div className="login-image-panel" style={S.imagePanel}>
                <img src="/sidelogin.png" alt="SafeCity+ Visual" style={S.sideImage} />
            </div>
        </div>
    );
};

const S = {
    page: { minHeight:'100vh', display:'flex', flexDirection:'row', backgroundColor:'#0f172a', fontFamily:"'Inter','Segoe UI',sans-serif" },

    /* Left: form panel */
    formPanel: { flex:'0 0 50%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 32px', backgroundColor:'#0f172a', minHeight:'100vh', boxSizing:'border-box' },

    /* Right: image panel */
    imagePanel: { flex:'0 0 50%', position:'relative', overflow:'hidden' },
    sideImage: { width:'100%', height:'100%', objectFit:'cover', objectPosition:'center', display:'block' },

    mobileLogo: { alignItems:'center', gap:'10px', marginBottom:'28px' },
    mobileLogoCircle: { width:'40px', height:'40px', borderRadius:'50%', overflow:'hidden', border:'2px solid rgba(99,102,241,0.5)', flexShrink:0 },
    mobileLogoName: { color:'#f1f5f9', fontSize:'18px', fontWeight:'800' },

    card: { width:'100%', maxWidth:'420px', backgroundColor:'#111827', border:'1px solid #1e293b', borderRadius:'24px', padding:'36px 32px', boxShadow:'0 25px 60px rgba(0,0,0,0.4)' },

    cardHeader: { marginBottom:'28px', textAlign:'center' },
    cardBadge: { display:'inline-block', backgroundColor:'rgba(99,102,241,0.1)', color:'#818cf8', border:'1px solid rgba(99,102,241,0.2)', borderRadius:'20px', padding:'4px 12px', fontSize:'12px', fontWeight:'600', marginBottom:'14px' },
    cardTitle: { color:'#f1f5f9', fontSize:'24px', fontWeight:'700', margin:'0 0 6px 0', letterSpacing:'-0.3px' },
    cardSub: { color:'#64748b', fontSize:'13.5px', margin:0 },

    errorBox: { display:'flex', alignItems:'flex-start', gap:'10px', backgroundColor:'rgba(239,68,68,0.08)', color:'#f87171', padding:'12px 14px', borderRadius:'12px', marginBottom:'20px', border:'1px solid rgba(239,68,68,0.2)', fontSize:'13.5px', lineHeight:'1.5' },
    errorIcon: { fontSize:'15px', flexShrink:0, marginTop:'1px' },

    fieldGroup: { marginBottom:'20px' },
    label: { display:'block', color:'#94a3b8', fontSize:'13px', fontWeight:'500', marginBottom:'8px', letterSpacing:'0.2px' },
    inputWrap: { position:'relative', display:'flex', alignItems:'center' },
    inputIcon: { position:'absolute', left:'13px', display:'flex', alignItems:'center', zIndex:1, pointerEvents:'none' },
    input: { width:'100%', padding:'12px 14px 12px 40px', borderRadius:'12px', border:'1.5px solid #1e293b', backgroundColor:'#0f172a', color:'#f1f5f9', fontSize:'14.5px', outline:'none', transition:'border-color 0.2s, box-shadow 0.2s', boxSizing:'border-box', lineHeight:'1.5' },
    inputErr: { borderColor:'rgba(239,68,68,0.5)' },
    fieldErr: { display:'block', color:'#f87171', fontSize:'12px', marginTop:'5px' },
    eyeBtn: { position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', padding:'4px', display:'flex', alignItems:'center', zIndex:1 },

    submitBtn: { width:'100%', padding:'13px', background:'linear-gradient(135deg,#3b82f6,#6366f1)', color:'#fff', border:'none', borderRadius:'12px', cursor:'pointer', fontWeight:'600', fontSize:'15px', letterSpacing:'0.2px', transition:'all 0.2s', marginTop:'6px', display:'flex', alignItems:'center', justifyContent:'center' },
    submitDisabled: { opacity:0.65, cursor:'not-allowed', transform:'none', boxShadow:'none' },
    spinRow: { display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' },
    spinner: { display:'inline-block', width:'16px', height:'16px', border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.7s linear infinite', flexShrink:0 },

    cardFooter: { marginTop:'24px' },
    divider: { display:'flex', alignItems:'center', gap:'10px', margin:'0 0 16px 0' },
    divLine: { flex:1, height:'1px', backgroundColor:'#1e293b' },
    divText: { color:'#334155', fontSize:'11px', whiteSpace:'nowrap', letterSpacing:'1px', textTransform:'uppercase' },
    securityRow: { display:'flex', justifyContent:'center', gap:'16px', flexWrap:'wrap', marginBottom:'14px' },
    securityItem: { color:'#475569', fontSize:'11.5px' },
    footNote: { color:'#334155', fontSize:'11.5px', textAlign:'center', margin:0, lineHeight:'1.5' },
};

export default Login;
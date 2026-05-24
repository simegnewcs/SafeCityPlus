import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const BAHIR_DAR_BG = '/sidelogin.png';

const HomePage = () => {
    const [scrolled, setScrolled] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 40);
        window.addEventListener('scroll', onScroll);
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <div style={styles.root}>

            {/* ── Navbar ── */}
            <nav style={{ ...styles.navbar, ...(scrolled ? styles.navbarScrolled : {}) }}>
                <div style={styles.navInner}>
                    {/* Brand */}
                    <div style={styles.brand}>
                        <div style={styles.brandIcon}>
                            <img src="/safecityplus.png" alt="SafeCity+ Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <span style={{ ...styles.brandName, color: '#0f172a' }}>
                            Safe City Plus
                        </span>
                    </div>

                    {/* Desktop nav links */}
                    <div style={styles.navLinks}>
                        {['About', 'Features', 'Contact'].map((item) => (
                            <a key={item} href={`#${item.toLowerCase()}`}
                                style={{ ...styles.navLink, color: '#334155' }}>
                                {item}
                            </a>
                        ))}
                    </div>

                    {/* CTA buttons */}
                    <div style={styles.navActions}>
                        <Link to="/login" style={{
                            ...styles.btnOutline,
                            borderColor: '#0ea5e9',
                            color: '#0ea5e9',
                        }}>
                            Sign In
                        </Link>
                    </div>

                    {/* Hamburger (mobile) */}
                    <button style={styles.hamburger} onClick={() => setMenuOpen(!menuOpen)}
                        aria-label="Toggle menu">
                        <span style={{ ...styles.bar, backgroundColor: '#0f172a' }}></span>
                        <span style={{ ...styles.bar, backgroundColor: '#0f172a' }}></span>
                        <span style={{ ...styles.bar, backgroundColor: '#0f172a' }}></span>
                    </button>
                </div>

                {/* Mobile menu */}
                {menuOpen && (
                    <div style={styles.mobileMenu}>
                        {['About', 'Features', 'Contact'].map((item) => (
                            <a key={item} href={`#${item.toLowerCase()}`}
                                style={styles.mobileLink} onClick={() => setMenuOpen(false)}>
                                {item}
                            </a>
                        ))}
                        <Link to="/login" style={styles.mobileLink} onClick={() => setMenuOpen(false)}>Sign In</Link>
                    </div>
                )}
            </nav>

            {/* ── Hero Section ── */}
            <section style={styles.hero}>
                {/* Background image with overlay */}
                <div style={styles.heroBg}></div>
                <div style={styles.heroOverlay}></div>

                <div style={styles.heroContent}>
                    <div style={styles.heroBadge}>Bahir Dar City Safety Platform</div>
                    <h1 style={styles.heroTitle}>
                        Protecting Bahir Dar,<br />
                        <span style={styles.heroHighlight}>One Response at a Time</span>
                    </h1>
                    <p style={styles.heroSub}>
                        Safe City Plus is the unified command platform for real-time incident
                        monitoring, rapid dispatch, and city-wide safety coordination in Bahir Dar.
                    </p>
                    <div style={styles.heroCTAs}>
                        <Link to="/login" style={styles.heroBtnPrimary}>Sign In to Dashboard</Link>
                    </div>

                    {/* Stats row */}
                    <div style={styles.statsRow}>
                        {[
                            { value: '24/7', label: 'Live Monitoring' },
                            { value: '<3 min', label: 'Avg. Response Time' },
                            { value: '100%', label: 'City Coverage' },
                        ].map((s) => (
                            <div key={s.label} style={styles.statItem}>
                                <div style={styles.statValue}>{s.value}</div>
                                <div style={styles.statLabel}>{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Scroll indicator */}
                <div style={styles.scrollIndicator}>
                    <div style={styles.scrollDot}></div>
                </div>
            </section>

            {/* ── Features Section ── */}
            <section id="features" style={styles.featuresSection}>
                <div style={styles.sectionInner}>
                    <h2 style={styles.sectionTitle}>Platform Capabilities</h2>
                    <p style={styles.sectionSub}>Everything your command center needs in one place.</p>
                    <div style={styles.featuresGrid}>
                        {[
                            { n: '01', title: 'Live Incident Map', desc: 'Real-time geospatial view of all active incidents across Bahir Dar with severity indicators.' },
                            { n: '02', title: 'Instant Dispatch', desc: 'Assign responders to incidents in seconds with role-based access and status tracking.' },
                            { n: '03', title: 'CCTV Integration', desc: 'Live camera feeds embedded directly into the command dashboard for visual verification.' },
                            { n: '04', title: 'Analytics & Heatmaps', desc: 'Understand incident patterns, peak times, and response performance with visual analytics.' },
                            { n: '05', title: 'Role-based Access', desc: 'Separate Admin and Responder portals ensure the right people see the right information.' },
                            { n: '06', title: 'Audit & Logs', desc: 'Full incident history, user activity logs, and exportable reports for accountability.' },
                        ].map((f) => (
                            <div key={f.n} style={styles.featureCard}>
                                <div style={styles.featureNum}>{f.n}</div>
                                <div style={styles.featureTitle}>{f.title}</div>
                                <div style={styles.featureDesc}>{f.desc}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── About Section ── */}
            <section id="about" style={styles.aboutSection}>
                <div style={styles.sectionInner}>
                    <div style={styles.aboutGrid}>
                        <div>
                            <h2 style={{ ...styles.sectionTitle, textAlign: 'left' }}>About Safe City Plus</h2>
                            <p style={styles.aboutText}>
                                Safe City Plus is Bahir Dar's dedicated urban safety management system,
                                designed to bridge the gap between incident occurrence and effective response.
                                Built for Admins and Responders, it empowers city authorities with the tools
                                to act faster and coordinate smarter.
                            </p>
                            <p style={styles.aboutText}>
                                From live maps and camera feeds to analytics dashboards and role-managed
                                accounts, every feature is purpose-built for Bahir Dar's unique operational needs.
                            </p>
                        </div>
                        <div style={styles.aboutStats}>
                            {[
                                { value: 'Bahir Dar', label: 'City of Operation' },
                                { value: '2 Roles', label: 'Admin & Responder' },
                                { value: 'Real-time', label: 'Incident Updates' },
                            ].map((s) => (
                                <div key={s.label} style={styles.aboutStatCard}>
                                    <div style={styles.aboutStatValue}>{s.value}</div>
                                    <div style={styles.aboutStatLabel}>{s.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ── CTA Banner ── */}
            <section style={styles.ctaBanner}>
                <h2 style={styles.ctaTitle}>Ready to protect your city?</h2>
                <p style={styles.ctaSub}>Sign in with your credentials to access the command center.</p>
                <div style={styles.heroCTAs}>
                    <Link to="/login" style={styles.heroBtnPrimary}>Sign In</Link>
                </div>
            </section>

            {/* ── Footer ── */}
            <footer id="contact" style={styles.footer}>
                <div style={styles.footerInner}>
                    <div style={styles.footerBrand}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                            stroke="#0ea5e9" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        <span style={styles.footerBrandName}>Safe City Plus</span>
                    </div>
                    <p style={styles.footerNote}>
                        Bahir Dar Urban Safety Command Platform &mdash; Authorized personnel only.
                    </p>
                    <p style={styles.footerCopy}>&copy; {new Date().getFullYear()} Safe City Plus. All rights reserved.</p>
                </div>
            </footer>

            <style>{`
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(24px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes scrollBounce {
                    0%, 100% { transform: translateY(0); opacity: 1; }
                    50%      { transform: translateY(8px); opacity: 0.4; }
                }
                * { box-sizing: border-box; margin: 0; padding: 0; }
                html { scroll-behavior: smooth; }
                a { text-decoration: none; }
            `}</style>
        </div>
    );
};

const styles = {
    root: {
        fontFamily: "'Times New Roman', Times, serif",
        backgroundColor: '#f8fafc',
        color: '#0f172a',
    },

    /* ── Navbar ── */
    navbar: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        transition: 'box-shadow 0.3s',
        backgroundColor: '#ffffff',
        boxShadow: '0 1px 16px rgba(0,0,0,0.08)',
    },
    navbarScrolled: {
        boxShadow: '0 2px 20px rgba(0,0,0,0.12)',
    },
    navInner: {
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 32px',
        height: '68px',
        display: 'flex',
        alignItems: 'center',
        gap: '32px',
    },
    brand: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flex: 1,
    },
    brandIcon: {
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        backgroundColor: 'rgba(255,255,255,0.15)',
        border: '2px solid rgba(255,255,255,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    brandName: {
        fontSize: '17px',
        fontWeight: '700',
        letterSpacing: '-0.2px',
        fontFamily: "'Times New Roman', Times, serif",
    },
    navLinks: {
        display: 'flex',
        gap: '28px',
    },
    navLink: {
        fontSize: '14.5px',
        fontWeight: '500',
        transition: 'opacity 0.2s',
        fontFamily: "'Times New Roman', Times, serif",
    },
    navActions: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
    },
    btnOutline: {
        padding: '8px 20px',
        borderRadius: '8px',
        border: '1.5px solid',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'all 0.2s',
        fontFamily: "'Times New Roman', Times, serif",
    },
    btnFill: {
        padding: '8px 20px',
        borderRadius: '8px',
        backgroundColor: '#0ea5e9',
        color: '#ffffff',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'background 0.2s',
        fontFamily: "'Times New Roman', Times, serif",
    },
    hamburger: {
        display: 'none',
        flexDirection: 'column',
        gap: '5px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '4px',
    },
    bar: {
        width: '24px',
        height: '2px',
        borderRadius: '2px',
        display: 'block',
    },
    mobileMenu: {
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        padding: '16px 24px',
        gap: '4px',
    },
    mobileLink: {
        padding: '10px 0',
        fontSize: '15px',
        color: '#334155',
        borderBottom: '1px solid #f1f5f9',
        fontFamily: "'Times New Roman', Times, serif",
    },

    /* ── Hero ── */
    hero: {
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    heroBg: {
        position: 'absolute',
        inset: 0,
        backgroundImage: `url('${BAHIR_DAR_BG}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        zIndex: 0,
    },
    heroOverlay: {
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(170deg, rgba(3,7,18,0.38) 0%, rgba(7,20,48,0.32) 50%, rgba(15,23,42,0.45) 100%)',
        zIndex: 1,
    },
    heroContent: {
        position: 'relative',
        zIndex: 2,
        maxWidth: '760px',
        padding: '0 32px',
        textAlign: 'center',
        animation: 'fadeUp 0.9s ease both',
    },
    heroBadge: {
        display: 'inline-block',
        backgroundColor: 'rgba(14,165,233,0.18)',
        border: '1px solid rgba(56,189,248,0.55)',
        color: '#bae6fd',
        fontSize: '12.5px',
        fontWeight: '700',
        letterSpacing: '1.5px',
        textTransform: 'uppercase',
        padding: '6px 18px',
        borderRadius: '20px',
        marginBottom: '24px',
        backdropFilter: 'blur(6px)',
        textShadow: '0 1px 4px rgba(0,0,0,0.4)',
    },
    heroTitle: {
        color: '#ffffff',
        fontSize: 'clamp(32px, 5vw, 60px)',
        fontWeight: '900',
        lineHeight: '1.15',
        marginBottom: '20px',
        letterSpacing: '-0.5px',
        textShadow: '0 2px 20px rgba(0,0,0,0.7), 0 4px 40px rgba(0,0,0,0.5)',
    },
    heroHighlight: {
        color: '#38bdf8',
        textShadow: '0 0 30px rgba(56,189,248,0.5)',
    },
    heroSub: {
        color: 'rgba(255,255,255,0.92)',
        fontSize: '17px',
        lineHeight: '1.75',
        marginBottom: '36px',
        maxWidth: '580px',
        margin: '0 auto 36px',
        textShadow: '0 1px 8px rgba(0,0,0,0.6)',
        fontWeight: '400',
    },
    heroCTAs: {
        display: 'flex',
        gap: '14px',
        justifyContent: 'center',
        flexWrap: 'wrap',
        marginBottom: '52px',
    },
    heroBtnPrimary: {
        padding: '14px 32px',
        backgroundColor: '#0ea5e9',
        color: '#ffffff',
        borderRadius: '10px',
        fontWeight: '700',
        fontSize: '15px',
        letterSpacing: '0.2px',
        boxShadow: '0 4px 18px rgba(14,165,233,0.45)',
        fontFamily: "'Times New Roman', Times, serif",
    },
    heroBtnSecondary: {
        padding: '13px 32px',
        backgroundColor: 'rgba(255,255,255,0.1)',
        color: '#ffffff',
        border: '1.5px solid rgba(255,255,255,0.4)',
        borderRadius: '10px',
        fontWeight: '600',
        fontSize: '15px',
        fontFamily: "'Times New Roman', Times, serif",
    },
    statsRow: {
        display: 'flex',
        gap: '0',
        justifyContent: 'center',
        borderTop: '1px solid rgba(255,255,255,0.15)',
        paddingTop: '28px',
        flexWrap: 'wrap',
    },
    statItem: {
        padding: '0 32px',
        borderRight: '1px solid rgba(255,255,255,0.15)',
        textAlign: 'center',
    },
    statValue: {
        color: '#38bdf8',
        fontSize: '26px',
        fontWeight: '800',
        lineHeight: '1',
        marginBottom: '6px',
        textShadow: '0 0 20px rgba(56,189,248,0.6)',
    },
    statLabel: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: '12px',
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
        textShadow: '0 1px 6px rgba(0,0,0,0.5)',
    },
    scrollIndicator: {
        position: 'absolute',
        bottom: '32px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2,
        width: '24px',
        height: '40px',
        border: '2px solid rgba(255,255,255,0.4)',
        borderRadius: '12px',
        display: 'flex',
        justifyContent: 'center',
        paddingTop: '6px',
    },
    scrollDot: {
        width: '4px',
        height: '8px',
        backgroundColor: '#38bdf8',
        borderRadius: '2px',
        animation: 'scrollBounce 1.6s ease-in-out infinite',
    },

    /* ── Features ── */
    featuresSection: {
        padding: '96px 32px',
        backgroundColor: '#ffffff',
    },
    sectionInner: {
        maxWidth: '1100px',
        margin: '0 auto',
    },
    sectionTitle: {
        fontSize: '32px',
        fontWeight: '800',
        color: '#0f172a',
        textAlign: 'center',
        marginBottom: '12px',
        letterSpacing: '-0.4px',
    },
    sectionSub: {
        color: '#64748b',
        fontSize: '16px',
        textAlign: 'center',
        marginBottom: '56px',
    },
    featuresGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
        gap: '24px',
    },
    featureCard: {
        padding: '28px 26px',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        backgroundColor: '#f8fafc',
        transition: 'box-shadow 0.2s, transform 0.2s',
    },
    featureNum: {
        fontSize: '12px',
        fontWeight: '800',
        color: '#0ea5e9',
        letterSpacing: '1px',
        marginBottom: '12px',
        textTransform: 'uppercase',
    },
    featureTitle: {
        fontSize: '16px',
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: '8px',
    },
    featureDesc: {
        fontSize: '14px',
        color: '#64748b',
        lineHeight: '1.65',
    },

    /* ── About ── */
    aboutSection: {
        padding: '96px 32px',
        backgroundColor: '#f0f9ff',
    },
    aboutGrid: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '60px',
        alignItems: 'center',
    },
    aboutText: {
        color: '#475569',
        fontSize: '15px',
        lineHeight: '1.75',
        marginBottom: '16px',
    },
    aboutStats: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
    },
    aboutStatCard: {
        padding: '20px 24px',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #bae6fd',
        borderLeft: '4px solid #0ea5e9',
    },
    aboutStatValue: {
        fontSize: '20px',
        fontWeight: '800',
        color: '#0369a1',
        marginBottom: '4px',
    },
    aboutStatLabel: {
        fontSize: '13px',
        color: '#64748b',
    },

    /* ── CTA Banner ── */
    ctaBanner: {
        padding: '80px 32px',
        background: 'linear-gradient(135deg, #0369a1 0%, #0ea5e9 100%)',
        textAlign: 'center',
    },
    ctaTitle: {
        color: '#ffffff',
        fontSize: '30px',
        fontWeight: '800',
        marginBottom: '12px',
    },
    ctaSub: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: '16px',
        marginBottom: '32px',
    },

    /* ── Footer ── */
    footer: {
        backgroundColor: '#0f172a',
        padding: '40px 32px',
        textAlign: 'center',
    },
    footerInner: {
        maxWidth: '600px',
        margin: '0 auto',
    },
    footerBrand: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        marginBottom: '12px',
    },
    footerBrandName: {
        color: '#f1f5f9',
        fontSize: '16px',
        fontWeight: '700',
    },
    footerNote: {
        color: '#475569',
        fontSize: '13px',
        marginBottom: '8px',
    },
    footerCopy: {
        color: '#334155',
        fontSize: '12px',
    },
};

export default HomePage;

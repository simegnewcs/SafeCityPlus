import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Login = () => {
    const [formData, setFormData] = useState({ phone: '', password: '' });
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const res = await axios.post('http://localhost:5000/api/auth/login', formData);
            if (res.data.success) {
                // መረጃውን ሴቭ እናደርጋለን
                localStorage.setItem('user', JSON.stringify(res.data.user));
                
                // በ Role መሰረት መከፋፈል
                if (res.data.user.role === 'Admin') {
                    navigate('/admin-dashboard');
                } else if (res.data.user.role === 'Responder') {
                    navigate('/responder-dashboard');
                } else {
                    setError('ይቅርታ፣ ይህ ገጽ ለተራ ተጠቃሚዎች አልተፈቀደም።');
                }
            }
        } catch (err) {
            setError(err.response?.data?.message || 'መግባት አልተቻለም፣ እባክዎ እንደገና ይሞክሩ');
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <h2 style={styles.title}>Safe City Plus</h2>
                <p style={styles.subtitle}>Web Command Center</p>

                {error && <div style={styles.errorBox}>{error}</div>}

                <form onSubmit={handleLogin}>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Phone Number</label>
                        <input 
                            name="phone"
                            type="text" 
                            style={styles.input}
                            placeholder="09..."
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Password</label>
                        <input 
                            name="password"
                            type="password" 
                            style={styles.input}
                            placeholder="••••••••"
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <button type="submit" style={styles.button}>Sign In</button>
                </form>
            </div>
        </div>
    );
};

const styles = {
    container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
    card: { backgroundColor: '#1e293b', padding: '40px', borderRadius: '15px', width: '100%', maxWidth: '400px', border: '1px solid #334155' },
    title: { color: '#fff', textAlign: 'center', fontSize: '28px', margin: '0 0 10px 0' },
    subtitle: { color: '#64748b', textAlign: 'center', marginBottom: '30px' },
    inputGroup: { marginBottom: '20px' },
    label: { display: 'block', color: '#cbd5e1', marginBottom: '8px' },
    input: { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', outline: 'none' },
    button: { width: '100%', padding: '14px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
    errorBox: { backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '10px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #ef4444', fontSize: '14px' }
};

export default Login;
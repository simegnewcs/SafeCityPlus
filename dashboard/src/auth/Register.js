import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Register = () => {
    const [formData, setFormData] = useState({ fullName: '', phone: '', password: '' });
    const navigate = useNavigate();

    const handleRegister = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post('http://localhost:5000/api/auth/register', formData);
            if (res.data.success) {
                alert("ተመዝግበዋል! አሁን መግባት ይችላሉ።");
                navigate('/login');
            }
        } catch (err) {
            alert(err.response?.data?.message || "ስህተት ተፈጥሯል");
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <h2 style={styles.title}>Register Admin</h2>
                <form onSubmit={handleRegister}>
                    <input 
                        style={styles.input}
                        placeholder="Full Name"
                        onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                    />
                    <input 
                        style={styles.input}
                        placeholder="Phone Number"
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    />
                    <input 
                        type="password"
                        style={styles.input}
                        placeholder="Password"
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                    />
                    <button type="submit" style={styles.button}>Register</button>
                </form>
            </div>
        </div>
    );
};

// Styles (Login ጋር ተመሳሳይ ስለሆነ እዚህ አላደጋገምኩትም)
const styles = {
    container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
    card: { backgroundColor: '#1e293b', padding: '40px', borderRadius: '15px', width: '100%', maxWidth: '400px' },
    input: { width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff' },
    button: { width: '100%', padding: '14px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold' },
    title: { color: '#fff', textAlign: 'center', marginBottom: '25px' }
};

export default Register;
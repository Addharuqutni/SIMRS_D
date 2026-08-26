import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, LogIn, AlertCircle, Shield, FileText, Pill, Activity } from 'lucide-react';
import { signIn } from '../../lib/auth-client';
import styles from './login.module.css';

export function LoginPage() {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [remember, setRemember] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');

        if (!username.trim() || !password.trim()) {
            setError('Username dan password harus diisi');
            return;
        }

        setLoading(true);

        const emailToLogin = username.includes('@') ? username : `${username}@simrs.com`;

        try {
            const result = await signIn.email({
                email: emailToLogin,
                password: password,
                rememberMe: remember
            });

            if (result.error) {
                setError(result.error.message || 'Login gagal, periksa email dan password.');
            } else {
                navigate('/dashboard');
            }
        } catch {
            setError('Koneksi ke server bermasalah');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.loginPage}>
            {/* Left — Brand Panel */}
            <div className={styles.brandPanel}>
                <div className={styles.brandContent}>
                    <img src="/logo.jpg" alt="SIMRS Logo" style={{
                        display: 'block', margin: '0 auto 24px auto', height: '140px', width: 'auto', mixBlendMode: 'multiply'
                    }} />
                    <h1 className={styles.brandTitle}> SIMRS Tipe D</h1>
                    <p className={styles.brandSubtitle}>Sistem Informasi Manajemen Rumah Sakit</p>
                    <p className={styles.brandDesc}>
                        Platform digital terintegrasi untuk mengelola layanan kesehatan rumah sakit tipe D —
                        dari pendaftaran hingga klaim BPJS.
                    </p>

                    <div className={styles.brandFeatures}>
                        <div className={styles.brandFeatureItem}>
                            <div className={`${styles.brandFeatureIcon} ${styles.blue}`}>
                                <Shield size={18} />
                            </div>
                            <span className={styles.brandFeatureText}>Bridging VClaim BPJS & SEP Otomatis</span>
                        </div>
                        <div className={styles.brandFeatureItem}>
                            <div className={`${styles.brandFeatureIcon} ${styles.green}`}>
                                <FileText size={18} />
                            </div>
                            <span className={styles.brandFeatureText}>Rekam Medis Elektronik (SOAP) + ICD-10</span>
                        </div>
                        <div className={styles.brandFeatureItem}>
                            <div className={`${styles.brandFeatureIcon} ${styles.purple}`}>
                                <Pill size={18} />
                            </div>
                            <span className={styles.brandFeatureText}>E-Prescribing & Manajemen Farmasi</span>
                        </div>
                        <div className={styles.brandFeatureItem}>
                            <div className={`${styles.brandFeatureIcon} ${styles.amber}`}>
                                <Activity size={18} />
                            </div>
                            <span className={styles.brandFeatureText}>Dashboard Analitik & Laporan Real-time</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right — Login Form */}
            <div className={styles.formPanel}>
                <div className={styles.formWrapper}>
                    <div className={styles.formHeader}>
                        <h2 className={styles.formTitle}>Selamat Datang</h2>
                        <p className={styles.formSubtitle}>Masuk ke akun SIMRS Anda</p>
                    </div>

                    {error && (
                        <div className={styles.errorMsg}>
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel} htmlFor="username">Username</label>
                            <div className={styles.inputWrapper}>
                                <input
                                    id="username"
                                    type="text"
                                    className={styles.formInput}
                                    placeholder="Masukkan username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    autoComplete="username"
                                    autoFocus
                                />
                                <User size={18} className={styles.inputIcon} />
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.formLabel} htmlFor="password">Password</label>
                            <div className={styles.inputWrapper}>
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    className={styles.formInput}
                                    placeholder="Masukkan password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="current-password"
                                />
                                <User size={18} className={styles.inputIcon} style={{ display: 'none' }} />
                                <Lock size={18} className={styles.inputIcon} />
                                <button
                                    type="button"
                                    className={styles.passwordToggle}
                                    onClick={() => setShowPassword(!showPassword)}
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <div className={styles.formOptions}>
                            <label className={styles.checkboxLabel}>
                                <input
                                    type="checkbox"
                                    className={styles.checkbox}
                                    checked={remember}
                                    onChange={(e) => setRemember(e.target.checked)}
                                />
                                Ingat saya
                            </label>
                            <button type="button" className={styles.forgotLink}>
                                Lupa password?
                            </button>
                        </div>

                        <button type="submit" className={styles.loginBtn} disabled={loading}>
                            {loading ? (
                                <span className={styles.spinner} />
                            ) : (
                                <>
                                    <LogIn size={18} />
                                    Masuk
                                </>
                            )}
                        </button>
                    </form>

                    {/* <div className={styles.formFooter}>
                        <p className={styles.footerText}>
                            <strong>Demo Logins:</strong><br />
                            <span style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', textAlign: 'left', marginTop: '8px' }}>
                                <span>1. admin / admin123!</span>
                                <span>2. dokter / dokter123!</span>
                                <span>3. perawat / perawat123!</span>
                                <span>4. farmasi / farmasi123!</span>
                                <span>5. kasir / kasir123!</span>
                            </span>
                        </p>
                        <p className={styles.footerVersion} style={{ marginTop: '16px' }}>SIMRS v1.0.0 — 2026</p>
                    </div> */}
                </div>
            </div>
        </div >
    );
}

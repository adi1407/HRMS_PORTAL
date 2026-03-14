import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import useAuthStore from '../store/authStore';
import api from '../utils/api';

const schema = z.object({
  email:    z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const [geoCoords, setGeoCoords] = useState(null);

  // Silently capture GPS for audit logging — login is never blocked by location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGeoCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => {}
      );
    }
  }, []);

  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (data) => {
    setLoading(true);
    setServerError('');
    try {
      const res = await api.post('/auth/login', { ...data, lat: geoCoords?.lat, lon: geoCoords?.lon });
      setAuth(res.data.user, res.data.accessToken);
      navigate('/dashboard');
    } catch (err) {
      setServerError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-left">
        <div className="login-brand">
          <img src="/logo.svg" alt="Adiverse" className="login-brand-logo" />
          <h1 className="login-brand-name">Adiverse</h1>
          <p className="login-brand-tagline">Human Resource Management System</p>
        </div>
        <div className="login-features">
          <div className="login-feature"><span>📶</span> Office WiFi-Based Attendance</div>
          <div className="login-feature"><span>👤</span> Face Recognition Check-In</div>
          <div className="login-feature"><span>💰</span> Auto Salary Deduction &amp; Payslips</div>
          <div className="login-feature"><span>📊</span> Real-time Reports &amp; Analytics</div>
        </div>
      </div>

      <div className="login-right">
        <div className="login-card">
          <h2 className="login-title">Welcome Back</h2>
          <p className="login-subtitle">Sign in to your HRMS account</p>

          {serverError && (
            <div className="alert alert--error">{serverError}</div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="login-form">
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                {...register('email')}
                type="email"
                className={`form-input${errors.email ? ' form-input--error' : ''}`}
                placeholder="admin@hrms.com"
                autoComplete="email"
              />
              {errors.email && <span className="form-error">{errors.email.message}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                {...register('password')}
                type="password"
                className={`form-input${errors.password ? ' form-input--error' : ''}`}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
              {errors.password && <span className="form-error">{errors.password.message}</span>}
            </div>

            <button type="submit" className="btn btn--primary btn--full" disabled={loading}>
              {loading ? <span className="btn-spinner"></span> : 'Sign In'}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}

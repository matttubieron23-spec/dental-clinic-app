import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { BrandLogo, CLINIC_INFO } from './PublicSite';
import { Button, Card, tokens } from './ui';

export default function StaffVerify({ email: initialEmail, onVerified, onBackToLogin }) {
  // Read from prop or fallback to URL query params
  const [email, setEmail] = useState(() => {
    if (initialEmail) return initialEmail;
    const params = new URLSearchParams(window.location.search);
    return params.get('email') || '';
  });

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [secondsLeft, setSecondsLeft] = useState(600); // 10 minutes
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(
    'Please verify your email to activate your account. Enter the 6-digit code sent to your inbox.'
  );

  const inputRefs = useRef([]);

  useEffect(() => {
    if (!email) {
      const params = new URLSearchParams(window.location.search);
      const urlEmail = params.get('email');
      if (urlEmail) setEmail(urlEmail);
    }
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const formatCountdown = (totalSec) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleDigitChange = (index, rawVal) => {
    const val = rawVal.replace(/\D/g, '');
    setError('');

    if (!val) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }

    if (val.length > 1) {
      const chars = val.slice(0, 6).split('');
      const next = [...digits];
      chars.forEach((ch, idx) => {
        if (index + idx < 6) next[index + idx] = ch;
      });
      setDigits(next);
      const nextFocus = Math.min(5, index + chars.length);
      inputRefs.current[nextFocus]?.focus();
      return;
    }

    const next = [...digits];
    next[index] = val;
    setDigits(next);

    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = ['', '', '', '', '', ''];
    pasted.split('').forEach((ch, idx) => {
      next[idx] = ch;
    });
    setDigits(next);
    setError('');
    const focusIndex = Math.min(5, pasted.length);
    inputRefs.current[focusIndex]?.focus();
  };

  const codeString = digits.join('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');

    if (!email) {
      setError('Missing staff email address. Please return to login.');
      return;
    }

    if (codeString.length < 6) {
      setError('Please enter all 6 digits of your OTP code.');
      return;
    }

    setVerifying(true);
    try {
      const res = await api('/auth/verify-otp', {
        method: 'POST',
        body: { email, code: codeString },
      });

      if (res?.token && res?.user) {
        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify(res.user));
        onVerified(res.user);
      } else {
        setNotice('Email verified successfully! You may now sign in.');
        setTimeout(() => onBackToLogin(), 1500);
      }
    } catch (err) {
      setError(err.message || 'Verification failed. Please check the code and try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleResendCode = async () => {
    if (!email) {
      setError('Cannot resend: missing email address.');
      return;
    }
    setResending(true);
    setError('');
    setNotice('');
    try {
      const res = await api('/auth/resend-otp', {
        method: 'POST',
        body: { email },
      });
      setDigits(['', '', '', '', '', '']);
      setSecondsLeft(600);
      setNotice(res.message || 'A new 6-digit OTP code has been sent to your email.');
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(err.message || 'Failed to resend code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F6F9] p-4 sm:p-6">
      <Card className="w-full max-w-md p-7 sm:p-8">
        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="flex items-center gap-3">
              <BrandLogo />
              <div>
                <h1 className="text-lg font-bold tracking-tight text-slate-900">
                  Verify Staff Account
                </h1>
                <p className="text-xs font-medium text-slate-500">
                  {CLINIC_INFO.shortName} · Staff Portal
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={onBackToLogin}
              className="!h-9 !min-h-0 !px-3 !py-1.5 !text-xs shrink-0"
            >
              ← Back to Login
            </Button>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3.5 text-xs text-blue-950">
            <p className="font-medium text-slate-600">Verification code sent to:</p>
            <p className="mt-0.5 break-all font-mono font-bold text-blue-700">{email || 'your email'}</p>
          </div>

          {notice && (
            <div
              role="status"
              className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs font-semibold text-amber-900"
            >
              {notice}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-700"
            >
              {error}
            </div>
          )}

          <div>
            <label className={`${tokens.label} text-center`}>
              6-Digit Verification Code <span className="text-red-500">*</span>
            </label>
            <div
              className="mt-2 flex items-center justify-center gap-2 sm:gap-2.5"
              onPaste={handlePaste}
            >
              {digits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => (inputRefs.current[idx] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  aria-label={`Digit ${idx + 1}`}
                  className="h-12 w-11 rounded-xl border border-slate-300 bg-slate-50/60 text-center font-mono text-xl font-bold text-slate-900 shadow-2xs transition-all focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/15 sm:h-14 sm:w-12"
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-xs">
            <span className="font-medium text-slate-600">
              {secondsLeft > 0 ? (
                <>
                  Code expires in{' '}
                  <strong className="font-mono font-bold text-slate-900">
                    {formatCountdown(secondsLeft)}
                  </strong>
                </>
              ) : (
                <span className="font-bold text-red-600">OTP code has expired</span>
              )}
            </span>

            <Button
              type="button"
              variant="link"
              disabled={resending}
              onClick={handleResendCode}
            >
              {resending ? 'Sending...' : 'Resend Code'}
            </Button>
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={verifying || codeString.length < 6}
            className="w-full"
          >
            {verifying ? 'Verifying OTP...' : 'Verify & Open Dashboard'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
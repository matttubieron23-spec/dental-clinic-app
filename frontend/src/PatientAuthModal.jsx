import { useEffect, useRef, useState } from 'react';
import { patientApi, setPatientSession } from './api';
import { CLINIC_SETTINGS, todayManila } from './config';
import { BrandLogo, CLINIC_INFO } from './PublicSite';
import { Button, Card, InputField, Stepper, tokens } from './ui';

export const SECURITY_QUESTIONS = [
  "What is your mother's maiden name?",
  "What was the name of your first pet?",
  "Who was your first love?",
  "What city were you born in?",
];

const QUESTIONS = [
  { id: 'good_health', label: '1. Are you in good health?' },
  { id: 'medical_treatment', label: '2. Are you currently under medical treatment?' },
  { id: 'serious_illness', label: '3. Have you ever had a serious illness or operation?' },
  { id: 'hospitalized', label: '4. Have you ever been hospitalized?' },
  { id: 'taking_medication', label: '5. Are you taking any prescription or non-prescription medication?' },
  { id: 'tobacco', label: '6. Do you use tobacco products?' },
  { id: 'alcohol', label: '7. Do you drink alcoholic beverages?' },
  { id: 'dangerous_drugs', label: '8. Have you ever used dangerous drugs?' },
  { id: 'allergies_exist', label: '9. Are you allergic to any medications, foods, or latex?' },
];

const COMMON_CONDITIONS = [
  'High Blood Pressure',
  'Low Blood Pressure',
  'Diabetes',
  'Heart Disease',
  'Heart Murmur',
  'Asthma',
  'Bleeding Problems',
  'Hepatitis / Liver Disease',
  'Kidney Disease',
  'Thyroid Problem',
  'Epilepsy / Seizures',
  'Rheumatic Fever',
];

const isPhilippinePhone = (p = '') =>
  /^(09\d{9}|\+639\d{9}|639\d{9})$/.test(String(p).replace(/[\s\-()]/g, ''));

function calculateAge(bdate) {
  if (!bdate) return null;
  const [y, m, d] = String(bdate).slice(0, 10).split('-').map(Number);
  if (!y) return null;
  const now = new Date();
  let age = now.getFullYear() - y;
  const mo = now.getMonth() + 1 - (m || 1);
  if (mo < 0 || (mo === 0 && now.getDate() < (d || 1))) age--;
  return age;
}

// Reusable Eye Icon Component
function EyeIcon({ visible, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={visible ? 'Hide password' : 'Show password'}
      className="absolute right-3 top-[34px] text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
    >
      {visible ? (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
          />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
        </svg>
      )}
    </button>
  );
}

export default function PatientAuthModal({
  initialView = 'login',
  onClose,
  onSuccess,
}) {
  // Views: 'login' | 'register' | 'verify' | 'forgot' | 'reset' | 'recover' | 'claim' | 'claim_password'
  const [view, setView] = useState(initialView);
  const [regStep, setRegStep] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Claim Account State
  const [claimEmail, setClaimEmail] = useState('');
  const [claimDob, setClaimDob] = useState('');
  const [claimToken, setClaimToken] = useState('');
  const [claimPassword, setClaimPassword] = useState('');
  const [claimConfirmPassword, setClaimConfirmPassword] = useState('');
  const [claimSecQuestion, setClaimSecQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [claimSecAnswer, setClaimSecAnswer] = useState('');
  const [showClaimPass, setShowClaimPass] = useState(false);
  const [showClaimConfirm, setShowClaimConfirm] = useState(false);

  // Registration State
  const [regForm, setRegForm] = useState({
    email: '',
    password: '',
    confirm_password: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    birth_date: '',
    sex: 'female',
    civil_status: 'Single',
    occupation: '',
    phone: '',
    address: '',
    barangay: '',
    city: 'Legazpi City',
    province: 'Albay',
    guardian_name: '',
    guardian_phone: '',
    security_question: SECURITY_QUESTIONS[0],
    security_answer: '',
    allergies: '',
    medications: '',
    is_pregnant: false,
    answers: {},
    selected_conditions: [],
    terms_accepted: false,
    privacy_accepted: false,
  });

  // 6-Digit OTP State
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyPurpose, setVerifyPurpose] = useState('signup'); // 'signup' | 'password_reset' | 'claim_account'
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [secondsLeft, setSecondsLeft] = useState(600);
  const otpRefs = useRef([]);

  // Traditional Email Reset State
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Account Recovery via Security Questions State
  const [recoveryStep, setRecoveryStep] = useState('lookup'); // 'lookup' | 'challenge' | 'set_password'
  const [recoveryForm, setRecoveryForm] = useState({
    first_name: '',
    last_name: '',
    birth_date: '',
  });
  const [recoveredPatientId, setRecoveredPatientId] = useState('');
  const [recoveredQuestion, setRecoveredQuestion] = useState('');
  const [recoveryAnswerInput, setRecoveryAnswerInput] = useState('');
  const [recNewPassword, setRecNewPassword] = useState('');
  const [recConfirmPassword, setRecConfirmPassword] = useState('');
  const [showRecPass, setShowRecPass] = useState(false);
  const [showRecConfirm, setShowRecConfirm] = useState(false);

  useEffect(() => {
    if (view !== 'verify' || secondsLeft <= 0) return;
    const t = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [view, secondsLeft]);

  useEffect(() => {
    if (view === 'verify') {
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    }
  }, [view]);

  const age = calculateAge(regForm.birth_date);
  const isMinor = age !== null && age < 18;

  const formatCountdown = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // ---------------------------------------------------------------------------
  // 1. LOGIN
  // ---------------------------------------------------------------------------
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');

    if (!loginEmail.trim() || !loginPassword) {
      setError('Please enter both your email address and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await patientApi('/api/patient/auth/login', {
        method: 'POST',
        body: {
          email: loginEmail.trim().toLowerCase(),
          password: loginPassword,
        },
      });
      setPatientSession(res.token, res.patient);
      onSuccess?.(res.patient);
    } catch (err) {
      if (
        err.data?.needs_verification === true ||
        err.data?.requiresVerification === true ||
        err.message?.toLowerCase().includes('verify your email')
      ) {
        setVerifyEmail(loginEmail.trim().toLowerCase());
        setVerifyPurpose('signup');
        setOtpDigits(['', '', '', '', '', '']);
        setSecondsLeft(600);
        setNotice('Please enter the 6-digit verification code sent to your email.');
        setView('verify');
        return;
      }
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 2. ACCOUNT CLAIMING (FOR STAFF-CREATED PATIENTS)
  // ---------------------------------------------------------------------------
  const handleClaimInitiate = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');

    if (!claimEmail.trim() || !claimDob) {
      setError('Please enter your email and registered date of birth.');
      return;
    }

    setLoading(true);
    try {
      await patientApi('/api/patient/auth/claim/initiate', {
        method: 'POST',
        body: {
          email: claimEmail.trim().toLowerCase(),
          birth_date: claimDob,
        },
      });

      setVerifyEmail(claimEmail.trim().toLowerCase());
      setVerifyPurpose('claim_account');
      setOtpDigits(['', '', '', '', '', '']);
      setSecondsLeft(600);
      setNotice('A 6-digit verification code was sent to your email. Enter it below to proceed:');
      setView('verify');
    } catch (err) {
      setError(err.message || 'No clinic record found matching this email and date of birth.');
    } finally {
      setLoading(false);
    }
  };

  const handleClaimFinalizeSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!claimPassword || claimPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (claimPassword !== claimConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await patientApi('/api/patient/auth/claim/complete', {
        method: 'POST',
        body: {
          claim_token: claimToken,
          password: claimPassword,
          confirm_password: claimConfirmPassword,
          security_question: claimSecQuestion,
          security_answer: claimSecAnswer.trim() || undefined,
        },
      });

      setPatientSession(res.token, res.patient);
      onSuccess?.(res.patient);
    } catch (err) {
      setError(err.message || 'Failed to complete account claiming.');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 3. REGISTRATION
  // ---------------------------------------------------------------------------
  const validateStep0 = async () => {
    const errs = {};
    const cleanEmail = regForm.email.trim().toLowerCase();

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      errs.email = 'Please enter a valid email address.';
    }
    if (!regForm.password || regForm.password.length < 8) {
      errs.password = 'Password must be at least 8 characters long.';
    }
    if (regForm.password !== regForm.confirm_password) {
      errs.confirm_password = 'Passwords do not match.';
    }
    if (!regForm.first_name.trim()) {
      errs.first_name = 'First name is required.';
    }
    if (!regForm.last_name.trim()) {
      errs.last_name = 'Last name is required.';
    }
    if (!regForm.birth_date) {
      errs.birth_date = 'Date of birth is required.';
    } else if (regForm.birth_date > todayManila()) {
      errs.birth_date = 'Date of birth cannot be in the future.';
    }

    if (!regForm.security_question) {
      errs.security_question = 'Please select a security question.';
    }
    if (!regForm.security_answer.trim() || regForm.security_answer.trim().length < 2) {
      errs.security_answer = 'Security answer must be at least 2 characters long.';
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return false;
    }

    setLoading(true);
    try {
      const check = await patientApi('/api/patient/auth/check-email', {
        method: 'POST',
        body: { email: cleanEmail },
      });
      if (check?.exists) {
        setFieldErrors({
          email: 'An account with this email already exists. Please log in.',
        });
        return false;
      }
    } catch {
      // Continue if network allows
    } finally {
      setLoading(false);
    }

    setFieldErrors({});
    return true;
  };

  const validateStep1 = () => {
    const errs = {};
    if (!regForm.phone.trim() || !isPhilippinePhone(regForm.phone)) {
      errs.phone = 'Enter a valid Philippine mobile number (e.g. 0917 123 4567).';
    }
    if (isMinor) {
      if (!regForm.guardian_name.trim()) {
        errs.guardian_name = 'Parent or guardian name is required for patients under 18.';
      }
      if (!regForm.guardian_phone.trim() || !isPhilippinePhone(regForm.guardian_phone)) {
        errs.guardian_phone = 'Valid Philippine mobile number is required for the guardian.';
      }
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return false;
    }
    setFieldErrors({});
    return true;
  };

  const handleNextStep = async () => {
    setError('');
    if (regStep === 0) {
      const ok = await validateStep0();
      if (ok) setRegStep(1);
    } else if (regStep === 1) {
      const ok = validateStep1();
      if (ok) setRegStep(2);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const errs = {};
    QUESTIONS.forEach((q) => {
      const ans = regForm.answers[q.id];
      if (ans?.choice === 'yes' && (!ans.details || !ans.details.trim())) {
        errs[q.id] = 'Please provide details for this "Yes" answer.';
      }
    });

    if (!regForm.terms_accepted) {
      errs.terms_accepted = 'You must agree to the Terms and Conditions.';
    }
    if (!regForm.privacy_accepted) {
      errs.privacy_accepted = 'You must agree to the Data Privacy Policy (RA 10173).';
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setError('Please complete all required fields and consent checkboxes highlighted below.');
      return;
    }

    setFieldErrors({});
    setLoading(true);
    try {
      const cleanEmail = regForm.email.trim().toLowerCase();
      await patientApi('/api/patient/auth/register', {
        method: 'POST',
        body: {
          email: cleanEmail,
          password: regForm.password,
          first_name: regForm.first_name.trim(),
          middle_name: regForm.middle_name.trim() || null,
          last_name: regForm.last_name.trim(),
          birth_date: regForm.birth_date,
          sex: regForm.sex,
          civil_status: regForm.civil_status,
          occupation: regForm.occupation.trim() || null,
          phone: regForm.phone.trim(),
          address: regForm.address.trim() || null,
          barangay: regForm.barangay.trim() || null,
          city: regForm.city.trim() || null,
          province: regForm.province.trim() || null,
          guardian_name: isMinor ? regForm.guardian_name.trim() : null,
          guardian_phone: isMinor ? regForm.guardian_phone.trim() : null,
          security_question: regForm.security_question,
          security_answer: regForm.security_answer.trim(),
          terms_accepted: regForm.terms_accepted,
          privacy_accepted: regForm.privacy_accepted,
          medical_history: {
            allergies: regForm.allergies.trim() || null,
            medications: regForm.medications.trim() || null,
            is_pregnant: regForm.sex === 'female' ? regForm.is_pregnant : false,
            answers: {
              ...regForm.answers,
              selected_conditions: regForm.selected_conditions,
            },
          },
        },
      });

      setVerifyEmail(cleanEmail);
      setVerifyPurpose('signup');
      setOtpDigits(['', '', '', '', '', '']);
      setSecondsLeft(600);
      setNotice('Account created! Please enter the 6-digit verification code sent to your email.');
      setView('verify');
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 4. OTP VERIFICATION
  // ---------------------------------------------------------------------------
  const handleOtpDigitChange = (idx, raw) => {
    const clean = raw.replace(/\D/g, '');
    setError('');
    if (!clean) {
      const next = [...otpDigits];
      next[idx] = '';
      setOtpDigits(next);
      return;
    }
    if (clean.length > 1) {
      const chars = clean.slice(0, 6).split('');
      const next = [...otpDigits];
      chars.forEach((c, i) => {
        if (idx + i < 6) next[idx + i] = c;
      });
      setOtpDigits(next);
      otpRefs.current[Math.min(5, idx + chars.length)]?.focus();
      return;
    }
    const next = [...otpDigits];
    next[idx] = clean;
    setOtpDigits(next);
    if (idx < 5) otpRefs.current[idx + 1]?.focus();
  };

  const handleOtpKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !otpDigits[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = ['', '', '', '', '', ''];
    pasted.split('').forEach((c, i) => {
      next[i] = c;
    });
    setOtpDigits(next);
    otpRefs.current[Math.min(5, pasted.length)]?.focus();
  };

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    const code = otpDigits.join('');
    if (code.length < 6) {
      setError('Please enter all 6 digits.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await patientApi('/api/patient/auth/verify-code', {
        method: 'POST',
        body: {
          email: verifyEmail,
          code,
          purpose: verifyPurpose,
        },
      });

      if (verifyPurpose === 'signup') {
        setPatientSession(res.token, res.patient);
        onSuccess?.(res.patient);
      } else if (verifyPurpose === 'claim_account') {
        setClaimToken(res.claim_token);
        setNotice('Code verified! Please create your password below to activate your account:');
        setView('claim_password');
      } else {
        setResetToken(res.reset_token || '');
        setNotice('Code verified! Enter your new password below.');
        setView('reset');
      }
    } catch (err) {
      setError(err.message || 'Invalid verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const res = await patientApi('/api/patient/auth/resend-code', {
        method: 'POST',
        body: {
          email: verifyEmail,
          purpose: verifyPurpose,
        },
      });
      setOtpDigits(['', '', '', '', '', '']);
      setSecondsLeft(600);
      setNotice(res.message || 'A new 6-digit code has been sent.');
      otpRefs.current[0]?.focus();
    } catch (err) {
      setError(err.message || 'Failed to resend code.');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 5. TRADITIONAL FORGOT & RESET PASSWORD
  // ---------------------------------------------------------------------------
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    const clean = loginEmail.trim().toLowerCase();
    if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setError('Please enter your registered email address.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await patientApi('/api/patient/auth/forgot-password', {
        method: 'POST',
        body: { email: clean },
      });
      setVerifyEmail(clean);
      setVerifyPurpose('password_reset');
      setOtpDigits(['', '', '', '', '', '']);
      setSecondsLeft(600);
      setNotice(res.message || 'Enter the 6-digit reset code sent to your email.');
      setView('verify');
    } catch (err) {
      setError(err.message || 'Failed to request password reset.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!newPassword || newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await patientApi('/api/patient/auth/reset-password', {
        method: 'POST',
        body: {
          email: verifyEmail,
          reset_token: resetToken,
          new_password: newPassword,
        },
      });
      setNotice(res.message || 'Password updated! You may now log in.');
      setView('login');
    } catch (err) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 6. ACCOUNT RECOVERY (IDENTITY LOOKUP -> CHALLENGE -> SET PASSWORD)
  // ---------------------------------------------------------------------------
  const handleRecoveryLookupSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!recoveryForm.first_name.trim() || !recoveryForm.last_name.trim() || !recoveryForm.birth_date) {
      setError('Please provide your legal first name, last name, and date of birth.');
      return;
    }

    setLoading(true);
    try {
      const res = await patientApi('/api/patient/auth/recover/lookup', {
        method: 'POST',
        body: {
          first_name: recoveryForm.first_name.trim(),
          last_name: recoveryForm.last_name.trim(),
          birth_date: recoveryForm.birth_date,
        },
      });

      setRecoveredPatientId(res.patient_id);
      setRecoveredQuestion(res.security_question);
      setRecoveryAnswerInput('');
      setRecoveryStep('challenge');
    } catch (err) {
      setError(err.message || 'No registered patient account found matching these details.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecoveryChallengeSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!recoveryAnswerInput.trim()) {
      setError('Please enter your confidential answer.');
      return;
    }

    setLoading(true);
    try {
      await patientApi('/api/patient/auth/recover/verify', {
        method: 'POST',
        body: {
          patient_id: recoveredPatientId,
          security_answer: recoveryAnswerInput.trim(),
        },
      });

      setRecNewPassword('');
      setRecConfirmPassword('');
      setShowRecPass(false);
      setShowRecConfirm(false);
      setRecoveryStep('set_password');
    } catch (err) {
      setError(err.message || 'Incorrect security answer.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecoveryResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!recNewPassword || recNewPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }
    if (recNewPassword !== recConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await patientApi('/api/patient/auth/recover/reset-password', {
        method: 'POST',
        body: {
          patient_id: recoveredPatientId,
          security_answer: recoveryAnswerInput.trim(),
          new_password: recNewPassword,
        },
      });

      setNotice(res.message || 'Password reset successfully! Please log in.');
      setError('');
      if (res.email) setLoginEmail(res.email);
      setLoginPassword('');
      setView('login');
    } catch (err) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-xs overflow-y-auto"
    >
      <Card
        noPadding
        className={`my-8 w-full ${
          view === 'register' ? 'max-w-2xl' : 'max-w-md'
        } max-h-[92vh] overflow-y-auto p-6 sm:p-8`}
      >
        {/* Top Modal Header */}
        <div className="mb-6 flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <BrandLogo />
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">
                {view === 'login' && 'Patient Portal Login'}
                {view === 'claim' && 'Claim Patient Account'}
                {view === 'claim_password' && 'Create Your Password'}
                {view === 'register' && 'Create Patient Account'}
                {view === 'verify' && 'Verify Your Email'}
                {view === 'forgot' && 'Reset Your Password'}
                {view === 'reset' && 'Set New Password'}
                {view === 'recover' && 'Recover & Reset Password'}
              </h2>
              <p className="text-xs font-semibold text-slate-600">
                {CLINIC_INFO.name}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {notice && (
          <div
            role="status"
            className="mb-5 rounded-[10px] border border-emerald-300 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-900"
          >
            {notice}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-[10px] border border-red-300 bg-red-50 p-3.5 text-xs font-semibold text-red-700"
          >
            {error}
          </div>
        )}

        {/* ================================================================= */}
        {/* VIEW 1: PATIENT LOGIN WITH "CLAIM ACCOUNT" LINK */}
        {/* ================================================================= */}
        {view === 'login' && (
          <form onSubmit={handleLoginSubmit} noValidate className="space-y-6">
            <div className="space-y-4">
              <InputField
                label="Email Address"
                type="email"
                required
                placeholder="you@example.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
              />

              <div className="space-y-2">
                <InputField
                  label="Password"
                  type="password"
                  required
                  placeholder="Enter your password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
                <div className="flex items-center justify-between text-xs">
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => {
                      setError('');
                      setNotice('');
                      setRecoveryStep('lookup');
                      setRecoveryForm({ first_name: '', last_name: '', birth_date: '' });
                      setView('recover');
                    }}
                  >
                    Forgot password / email?
                  </Button>
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => {
                      setError('');
                      setNotice('');
                      setView('forgot');
                    }}
                  >
                    Reset via OTP
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <Button
                type="submit"
                variant="primary"
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Signing in...' : 'Log In'}
              </Button>

              {/* FIRST TIME HERE? CLAIM ACCOUNT */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-center text-xs">
                <span className="font-medium text-slate-700">First time here? </span>
                <Button
                  type="button"
                  variant="link"
                  onClick={() => {
                    setError('');
                    setNotice('');
                    setClaimEmail(loginEmail || '');
                    setClaimDob('');
                    setView('claim');
                  }}
                  className="font-bold text-blue-700 underline"
                >
                  Claim your account →
                </Button>
              </div>

              <div className="border-t border-slate-200 pt-4 text-center text-xs font-medium text-slate-600">
                New patient at Smile Avenue?{' '}
                <Button
                  type="button"
                  variant="link"
                  onClick={() => {
                    setError('');
                    setNotice('');
                    setRegStep(0);
                    setView('register');
                  }}
                >
                  Create an account
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* ================================================================= */}
        {/* VIEW 2: CLAIM ACCOUNT FORM (EMAIL + DOB) */}
        {/* ================================================================= */}
        {view === 'claim' && (
          <form onSubmit={handleClaimInitiate} noValidate className="space-y-5">
            <p className="text-xs font-medium text-slate-600 leading-relaxed">
              If your dental record was registered at the clinic, enter your email and registered date of birth below to verify your identity and set your password.
            </p>

            <InputField
              label="Registered Email Address"
              type="email"
              required
              placeholder="you@example.com"
              value={claimEmail}
              onChange={(e) => setClaimEmail(e.target.value)}
            />

            <InputField
              label="Date of Birth"
              type="date"
              required
              max={todayManila()}
              value={claimDob}
              onChange={(e) => setClaimDob(e.target.value)}
            />

            <div className="flex items-center justify-between gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setError('');
                  setNotice('');
                  setView('login');
                }}
              >
                ← Back to Login
              </Button>
              <Button type="submit" variant="primary" disabled={loading}>
                {loading ? 'Checking...' : 'Send Claim Code →'}
              </Button>
            </div>
          </form>
        )}

        {/* ================================================================= */}
        {/* VIEW 3: SET PASSWORD FOR CLAIMED ACCOUNT */}
        {/* ================================================================= */}
        {view === 'claim_password' && (
          <form onSubmit={handleClaimFinalizeSubmit} noValidate className="space-y-4">
            <div className="rounded-[10px] border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs font-semibold text-emerald-950">
              ✓ Identity verified! Please create a password to complete claiming your patient portal account.
            </div>

            <div className="relative">
              <InputField
                label="New Password"
                type={showClaimPass ? 'text' : 'password'}
                required
                placeholder="At least 8 characters"
                value={claimPassword}
                onChange={(e) => setClaimPassword(e.target.value)}
              />
              <EyeIcon
                visible={showClaimPass}
                onClick={() => setShowClaimPass(!showClaimPass)}
              />
            </div>

            <div className="relative">
              <InputField
                label="Confirm Password"
                type={showClaimConfirm ? 'text' : 'password'}
                required
                placeholder="Re-enter password"
                value={claimConfirmPassword}
                onChange={(e) => setClaimConfirmPassword(e.target.value)}
              />
              <EyeIcon
                visible={showClaimConfirm}
                onClick={() => setShowClaimConfirm(!showClaimConfirm)}
              />
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-3">
              <InputField
                label="Security Question (For Account Recovery)"
                as="select"
                value={claimSecQuestion}
                onChange={(e) => setClaimSecQuestion(e.target.value)}
              >
                {SECURITY_QUESTIONS.map((q) => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </InputField>

              <InputField
                label="Secret Answer"
                placeholder="Type your secret answer"
                value={claimSecAnswer}
                onChange={(e) => setClaimSecAnswer(e.target.value)}
              />
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Activating Account...' : 'Set Password & Log In'}
              </Button>
            </div>
          </form>
        )}

        {/* ================================================================= */}
        {/* VIEW 4: MULTI-STEP PATIENT REGISTRATION */}
        {/* ================================================================= */}
        {view === 'register' && (
          <form onSubmit={handleRegisterSubmit} noValidate className="space-y-6">
            <Stepper
              steps={['1. Account & Identity', '2. Contact & Address', '3. Medical & Consent']}
              currentStep={regStep}
            />

            {/* STEP 0: ACCOUNT & LEGAL IDENTITY */}
            {regStep === 0 && (
              <div className="space-y-6 pt-2">
                <div className="space-y-4 rounded-[12px] border border-slate-200 bg-slate-50/70 p-5">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-blue-800">
                    Account Login Credentials
                  </h3>
                  <InputField
                    label="Email Address"
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={regForm.email}
                    onChange={(e) => {
                      setRegForm({ ...regForm, email: e.target.value });
                      setFieldErrors({ ...fieldErrors, email: undefined });
                    }}
                    error={fieldErrors.email}
                  />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <InputField
                      label="Password"
                      type="password"
                      required
                      placeholder="At least 8 characters"
                      value={regForm.password}
                      onChange={(e) => {
                        setRegForm({ ...regForm, password: e.target.value });
                        setFieldErrors({ ...fieldErrors, password: undefined });
                      }}
                      error={fieldErrors.password}
                    />
                    <InputField
                      label="Confirm Password"
                      type="password"
                      required
                      placeholder="Re-enter password"
                      value={regForm.confirm_password}
                      onChange={(e) => {
                        setRegForm({ ...regForm, confirm_password: e.target.value });
                        setFieldErrors({ ...fieldErrors, confirm_password: undefined });
                      }}
                      error={fieldErrors.confirm_password}
                    />
                  </div>
                </div>

                <div className="space-y-4 rounded-[12px] border border-slate-200 bg-slate-50/70 p-5">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-blue-800">
                    Patient Legal Identity
                  </h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <InputField
                      label="First Name"
                      required
                      placeholder="e.g. Maria"
                      value={regForm.first_name}
                      onChange={(e) => {
                        setRegForm({ ...regForm, first_name: e.target.value });
                        setFieldErrors({ ...fieldErrors, first_name: undefined });
                      }}
                      error={fieldErrors.first_name}
                    />
                    <InputField
                      label="Middle Name"
                      placeholder="Optional"
                      value={regForm.middle_name}
                      onChange={(e) =>
                        setRegForm({ ...regForm, middle_name: e.target.value })
                      }
                    />
                    <InputField
                      label="Last Name"
                      required
                      placeholder="e.g. Santos"
                      value={regForm.last_name}
                      onChange={(e) => {
                        setRegForm({ ...regForm, last_name: e.target.value });
                        setFieldErrors({ ...fieldErrors, last_name: undefined });
                      }}
                      error={fieldErrors.last_name}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <InputField
                      label="Date of Birth"
                      type="date"
                      required
                      max={todayManila()}
                      value={regForm.birth_date}
                      onChange={(e) => {
                        setRegForm({ ...regForm, birth_date: e.target.value });
                        setFieldErrors({ ...fieldErrors, birth_date: undefined });
                      }}
                      error={fieldErrors.birth_date}
                    />
                    <InputField
                      label="Gender / Sex"
                      as="select"
                      required
                      value={regForm.sex}
                      onChange={(e) => setRegForm({ ...regForm, sex: e.target.value })}
                    >
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                      <option value="other">Other</option>
                    </InputField>
                  </div>
                </div>

                <div className="space-y-4 rounded-[12px] border border-blue-200 bg-blue-50/60 p-5">
                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-blue-900">
                      🔐 Account Recovery Security Question
                    </h3>
                    <p className="mt-1 text-[11px] font-medium text-slate-600">
                      Choose a secret question and answer to recover and reset your password if you ever lose access to your account.
                    </p>
                  </div>

                  <InputField
                    label="Security Question"
                    as="select"
                    required
                    value={regForm.security_question}
                    onChange={(e) => {
                      setRegForm({ ...regForm, security_question: e.target.value });
                      setFieldErrors({ ...fieldErrors, security_question: undefined });
                    }}
                    error={fieldErrors.security_question}
                  >
                    {SECURITY_QUESTIONS.map((q) => (
                      <option key={q} value={q}>
                        {q}
                      </option>
                    ))}
                  </InputField>

                  <InputField
                    label="Confidential Answer"
                    type="text"
                    required
                    placeholder="Type your answer here..."
                    value={regForm.security_answer}
                    onChange={(e) => {
                      setRegForm({ ...regForm, security_answer: e.target.value });
                      setFieldErrors({ ...fieldErrors, security_answer: undefined });
                    }}
                    error={fieldErrors.security_answer}
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setView('login')}
                  >
                    ← Back to Login
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={loading}
                    onClick={handleNextStep}
                  >
                    {loading ? 'Checking...' : 'Next: Contact Info →'}
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 1: CONTACT, ADDRESS & GUARDIAN DETAILS */}
            {regStep === 1 && (
              <div className="space-y-6 pt-2">
                <div className="space-y-4 rounded-[12px] border border-slate-200 bg-slate-50/70 p-5">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-blue-800">
                    Contact &amp; Address Details
                  </h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <InputField
                      label="Mobile Number (PH)"
                      type="tel"
                      required
                      placeholder="0917 123 4567"
                      value={regForm.phone}
                      onChange={(e) => {
                        setRegForm({ ...regForm, phone: e.target.value });
                        setFieldErrors({ ...fieldErrors, phone: undefined });
                      }}
                      error={fieldErrors.phone}
                    />
                    <InputField
                      label="Occupation"
                      placeholder="e.g. Teacher, Student"
                      value={regForm.occupation}
                      onChange={(e) =>
                        setRegForm({ ...regForm, occupation: e.target.value })
                      }
                    />
                  </div>

                  <InputField
                    label="House / Unit No. & Street Address"
                    placeholder="e.g. 123 Rizal St."
                    value={regForm.address}
                    onChange={(e) =>
                      setRegForm({ ...regForm, address: e.target.value })
                    }
                  />

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <InputField
                      label="Barangay"
                      placeholder="e.g. Bitano"
                      value={regForm.barangay}
                      onChange={(e) =>
                        setRegForm({ ...regForm, barangay: e.target.value })
                      }
                    />
                    <InputField
                      label="City / Municipality"
                      placeholder="Legazpi City"
                      value={regForm.city}
                      onChange={(e) =>
                        setRegForm({ ...regForm, city: e.target.value })
                      }
                    />
                    <InputField
                      label="Province"
                      placeholder="Albay"
                      value={regForm.province}
                      onChange={(e) =>
                        setRegForm({ ...regForm, province: e.target.value })
                      }
                    />
                  </div>
                </div>

                {isMinor && (
                  <div className="space-y-4 rounded-[12px] border border-amber-300 bg-amber-50/70 p-5">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-950">
                      Parent / Legal Guardian (Required for Under 18)
                    </h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <InputField
                        label="Parent / Guardian Full Name"
                        required
                        placeholder="e.g. Roberto Santos"
                        value={regForm.guardian_name}
                        onChange={(e) => {
                          setRegForm({ ...regForm, guardian_name: e.target.value });
                          setFieldErrors({ ...fieldErrors, guardian_name: undefined });
                        }}
                        error={fieldErrors.guardian_name}
                      />
                      <InputField
                        label="Guardian Mobile Number (PH)"
                        type="tel"
                        required
                        placeholder="0917 123 4567"
                        value={regForm.guardian_phone}
                        onChange={(e) => {
                          setRegForm({ ...regForm, guardian_phone: e.target.value });
                          setFieldErrors({ ...fieldErrors, guardian_phone: undefined });
                        }}
                        error={fieldErrors.guardian_phone}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setRegStep(0)}
                  >
                    ← Back
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleNextStep}
                  >
                    Next: Medical History →
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2: MEDICAL HISTORY & RA 10173 CONSENT */}
            {regStep === 2 && (
              <div className="space-y-6 pt-2">
                <div className="space-y-3 rounded-[12px] border border-slate-200 bg-slate-50/70 p-5">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-blue-800">
                    Medical History Questionnaire
                  </h3>
                  {QUESTIONS.map((q) => {
                    const ans = regForm.answers[q.id] || { choice: 'no', details: '' };
                    const qErr = fieldErrors[q.id];
                    return (
                      <div
                        key={q.id}
                        className="rounded-[10px] border border-slate-200 bg-[#FFFFFF] p-3.5 space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-800">{q.label}</span>
                          <div className="flex items-center gap-4 text-xs font-bold">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                checked={ans.choice === 'yes'}
                                onChange={() =>
                                  setRegForm({
                                    ...regForm,
                                    answers: {
                                      ...regForm.answers,
                                      [q.id]: { ...ans, choice: 'yes' },
                                    },
                                  })
                                }
                                className="h-4 w-4 accent-blue-600"
                              />
                              Yes
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                checked={ans.choice === 'no'}
                                onChange={() => {
                                  setRegForm({
                                    ...regForm,
                                    answers: {
                                      ...regForm.answers,
                                      [q.id]: { choice: 'no', details: '' },
                                    },
                                  });
                                  setFieldErrors({ ...fieldErrors, [q.id]: undefined });
                                }}
                                className="h-4 w-4 accent-blue-600"
                              />
                              No
                            </label>
                          </div>
                        </div>

                        {ans.choice === 'yes' && (
                          <InputField
                            label="Required Details"
                            required
                            placeholder="Please specify details..."
                            value={ans.details || ''}
                            onChange={(e) => {
                              setRegForm({
                                ...regForm,
                                answers: {
                                  ...regForm.answers,
                                  [q.id]: { ...ans, details: e.target.value },
                                },
                              });
                              setFieldErrors({ ...fieldErrors, [q.id]: undefined });
                            }}
                            error={qErr}
                          />
                        )}
                      </div>
                    );
                  })}

                  <div className="pt-2">
                    <span className={tokens.label}>Existing Medical Conditions</span>
                    <div className="grid grid-cols-2 gap-2 rounded-[10px] border border-slate-200 bg-[#FFFFFF] p-3 text-xs font-medium text-slate-800">
                      {COMMON_CONDITIONS.map((cond) => (
                        <label key={cond} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={regForm.selected_conditions.includes(cond)}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...regForm.selected_conditions, cond]
                                : regForm.selected_conditions.filter((x) => x !== cond);
                              setRegForm({ ...regForm, selected_conditions: next });
                            }}
                            className="h-4 w-4 rounded accent-blue-600"
                          />
                          {cond}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-[12px] border border-blue-200 bg-blue-50/50 p-5 text-xs">
                  <h3 className="font-extrabold uppercase tracking-wider text-blue-900">
                    Terms &amp; Data Privacy Consent (RA 10173)
                  </h3>
                  <label className="flex items-start gap-2.5 font-semibold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={regForm.terms_accepted}
                      onChange={(e) => {
                        setRegForm({ ...regForm, terms_accepted: e.target.checked });
                        setFieldErrors({ ...fieldErrors, terms_accepted: undefined });
                      }}
                      className="mt-0.5 h-4 w-4 rounded accent-blue-600"
                    />
                    <span>
                      I agree to the Clinic Terms &amp; Conditions and appointment policies (
                      {CLINIC_SETTINGS.termsVersion}). <span className="text-red-600">*</span>
                    </span>
                  </label>
                  {fieldErrors.terms_accepted && (
                    <p className={tokens.error}>{fieldErrors.terms_accepted}</p>
                  )}

                  <label className="flex items-start gap-2.5 font-semibold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={regForm.privacy_accepted}
                      onChange={(e) => {
                        setRegForm({ ...regForm, privacy_accepted: e.target.checked });
                        setFieldErrors({ ...fieldErrors, privacy_accepted: undefined });
                      }}
                      className="mt-0.5 h-4 w-4 rounded accent-blue-600"
                    />
                    <span>
                      I consent to the collection and processing of my personal and dental health data under Republic Act No. 10173 (Data Privacy Act of 2012).{' '}
                      <span className="text-red-600">*</span>
                    </span>
                  </label>
                  {fieldErrors.privacy_accepted && (
                    <p className={tokens.error}>{fieldErrors.privacy_accepted}</p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setRegStep(1)}
                  >
                    ← Back
                  </Button>
                  <Button type="submit" variant="primary" disabled={loading}>
                    {loading ? 'Creating Account...' : 'Register & Send OTP'}
                  </Button>
                </div>
              </div>
            )}
          </form>
        )}

        {/* ================================================================= */}
        {/* VIEW 5: 6-DIGIT EMAIL OTP VERIFICATION */}
        {/* ================================================================= */}
        {view === 'verify' && (
          <form onSubmit={handleVerifySubmit} noValidate className="space-y-6">
            <div className="rounded-[10px] border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-950">
              <p className="font-semibold">Verification code sent to:</p>
              <p className="mt-0.5 break-all font-mono font-bold text-blue-800">
                {verifyEmail}
              </p>
            </div>

            <div>
              <label className={`${tokens.label} text-center`}>
                Enter 6-Digit Verification Code <span className="text-red-600">*</span>
              </label>
              <div
                className="mt-2 flex items-center justify-center gap-2 sm:gap-2.5"
                onPaste={handleOtpPaste}
              >
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (otpRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    aria-label={`Digit ${idx + 1}`}
                    className="h-12 w-11 rounded-[10px] border border-[#64748B] bg-[#FFFFFF] text-center font-mono text-xl font-extrabold text-slate-900 shadow-2xs transition-all focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/25 sm:h-14 sm:w-12"
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-xs">
              <span className="font-medium text-slate-700">
                {secondsLeft > 0 ? (
                  <>
                    Code expires in{' '}
                    <strong className="font-mono font-bold text-slate-900">
                      {formatCountdown(secondsLeft)}
                    </strong>
                  </>
                ) : (
                  <span className="font-bold text-red-600">Code expired</span>
                )}
              </span>

              <Button
                type="button"
                variant="link"
                disabled={loading}
                onClick={handleResendOtp}
              >
                Resend Code
              </Button>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setView(verifyPurpose === 'claim_account' ? 'claim' : 'login')}
              >
                ← Back
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={loading || otpDigits.join('').length < 6}
                className="flex-1"
              >
                {loading ? 'Verifying...' : 'Verify Code'}
              </Button>
            </div>
          </form>
        )}

        {/* ================================================================= */}
        {/* VIEW 6: FORGOT PASSWORD */}
        {/* ================================================================= */}
        {view === 'forgot' && (
          <form onSubmit={handleForgotSubmit} noValidate className="space-y-6">
            <p className="text-xs font-medium leading-relaxed text-slate-600">
              Enter your registered email address and we will send you a 6-digit verification code to reset your password.
            </p>

            <InputField
              label="Registered Email Address"
              type="email"
              required
              placeholder="you@example.com"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
            />

            <div className="flex items-center justify-between gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setView('login')}
              >
                ← Back to Login
              </Button>
              <Button type="submit" variant="primary" disabled={loading}>
                {loading ? 'Sending...' : 'Send Reset Code'}
              </Button>
            </div>
          </form>
        )}

        {/* ================================================================= */}
        {/* VIEW 7: SET NEW PASSWORD (OTP RESET) */}
        {/* ================================================================= */}
        {view === 'reset' && (
          <form onSubmit={handleResetPasswordSubmit} noValidate className="space-y-6">
            <div className="space-y-4">
              <InputField
                label="New Password"
                type="password"
                required
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <InputField
                label="Confirm New Password"
                type="password"
                required
                placeholder="Re-enter new password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Updating Password...' : 'Save New Password'}
            </Button>
          </form>
        )}

        {/* ================================================================= */}
        {/* VIEW 8: ACCOUNT RECOVERY & PASSWORD RESET VIA SECURITY QUESTIONS */}
        {/* ================================================================= */}
        {view === 'recover' && (
          <div className="space-y-6">
            {recoveryStep === 'lookup' && (
              <form onSubmit={handleRecoveryLookupSubmit} noValidate className="space-y-4">
                <p className="text-xs font-medium text-slate-600 leading-relaxed">
                  Enter your registered legal name and date of birth to locate your account and answer your security question.
                </p>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <InputField
                    label="First Name"
                    required
                    placeholder="e.g. Maria"
                    value={recoveryForm.first_name}
                    onChange={(e) => setRecoveryForm({ ...recoveryForm, first_name: e.target.value })}
                  />

                  <InputField
                    label="Last Name"
                    required
                    placeholder="e.g. Santos"
                    value={recoveryForm.last_name}
                    onChange={(e) => setRecoveryForm({ ...recoveryForm, last_name: e.target.value })}
                  />
                </div>

                <InputField
                  label="Date of Birth"
                  type="date"
                  required
                  max={todayManila()}
                  value={recoveryForm.birth_date}
                  onChange={(e) => setRecoveryForm({ ...recoveryForm, birth_date: e.target.value })}
                />

                <div className="flex items-center justify-between pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setError('');
                      setNotice('');
                      setView('login');
                    }}
                  >
                    ← Back to Login
                  </Button>

                  <Button type="submit" variant="primary" disabled={loading}>
                    {loading ? 'Finding Account...' : 'Continue →'}
                  </Button>
                </div>
              </form>
            )}

            {recoveryStep === 'challenge' && (
              <form onSubmit={handleRecoveryChallengeSubmit} noValidate className="space-y-4">
                <div className="rounded-[10px] border border-blue-200 bg-blue-50/70 p-4 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800">
                    Security Question
                  </span>
                  <p className="text-sm font-bold text-slate-900">{recoveredQuestion}</p>
                </div>

                <InputField
                  label="Your Confidential Answer"
                  type="text"
                  required
                  autoFocus
                  placeholder="Type your secret answer"
                  value={recoveryAnswerInput}
                  onChange={(e) => setRecoveryAnswerInput(e.target.value)}
                />

                <div className="flex items-center justify-between pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setError('');
                      setRecoveryStep('lookup');
                    }}
                  >
                    ← Back
                  </Button>

                  <Button type="submit" variant="primary" disabled={loading}>
                    {loading ? 'Verifying...' : 'Verify Answer →'}
                  </Button>
                </div>
              </form>
            )}

            {recoveryStep === 'set_password' && (
              <form onSubmit={handleRecoveryResetPasswordSubmit} noValidate className="space-y-4">
                <div className="rounded-[10px] border border-emerald-200 bg-emerald-50/60 p-4 text-xs font-semibold text-emerald-950">
                  ✓ Identity verified! Please set a new password for your account below.
                </div>

                {/* New Password with Eye Icon */}
                <div className="relative">
                  <InputField
                    label="New Password"
                    type={showRecPass ? 'text' : 'password'}
                    required
                    placeholder="At least 8 characters"
                    value={recNewPassword}
                    onChange={(e) => setRecNewPassword(e.target.value)}
                  />
                  <EyeIcon
                    visible={showRecPass}
                    onClick={() => setShowRecPass(!showRecPass)}
                  />
                </div>

                {/* Confirm Password with Eye Icon */}
                <div className="relative">
                  <InputField
                    label="Confirm New Password"
                    type={showRecConfirm ? 'text' : 'password'}
                    required
                    placeholder="Re-enter your new password"
                    value={recConfirmPassword}
                    onChange={(e) => setRecConfirmPassword(e.target.value)}
                  />
                  <EyeIcon
                    visible={showRecConfirm}
                    onClick={() => setShowRecConfirm(!showRecConfirm)}
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setError('');
                      setRecoveryStep('challenge');
                    }}
                  >
                    ← Back
                  </Button>

                  <Button type="submit" variant="primary" disabled={loading}>
                    {loading ? 'Updating Password...' : 'Save New Password'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
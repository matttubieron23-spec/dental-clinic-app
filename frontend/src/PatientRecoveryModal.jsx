import { useState } from 'react';
import { patientApi } from './api';
import { todayManila } from './config';
import { Button, InputField, Modal } from './ui';

export default function PatientRecoveryModal({ isOpen, onClose, onSwitchToLogin }) {
  // Steps: 'lookup' (Name & DOB) -> 'challenge' (Security Question) -> 'success' (Reveals Masked Email)
  const [step, setStep] = useState('lookup');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Lookup Form State
  const [lookupForm, setLookupForm] = useState({
    first_name: '',
    last_name: '',
    birth_date: '',
  });

  // Step 2: Challenge State
  const [patientId, setPatientId] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');

  // Step 3: Success State
  const [maskedEmail, setMaskedEmail] = useState('');

  if (!isOpen) return null;

  const handleResetModal = () => {
    setStep('lookup');
    setLoading(false);
    setError('');
    setLookupForm({ first_name: '', last_name: '', birth_date: '' });
    setPatientId('');
    setSecurityQuestion('');
    setSecurityAnswer('');
    setMaskedEmail('');
  };

  const handleClose = () => {
    handleResetModal();
    onClose();
  };

  // Step 1 Submit: Lookup Patient by Legal Name & Birthday
  const handleLookupSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!lookupForm.first_name.trim() || !lookupForm.last_name.trim() || !lookupForm.birth_date) {
      setError('Please fill out your legal first name, last name, and date of birth.');
      return;
    }

    setLoading(true);
    try {
      const res = await patientApi('/patient/auth/recover/lookup', {
        method: 'POST',
        body: {
          first_name: lookupForm.first_name.trim(),
          last_name: lookupForm.last_name.trim(),
          birth_date: lookupForm.birth_date,
        },
      });

      setPatientId(res.patient_id);
      setSecurityQuestion(res.security_question);
      setStep('challenge');
    } catch (err) {
      setError(err.message || 'No matching patient account found.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2 Submit: Verify Answer with Bcrypt
  const handleChallengeSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!securityAnswer.trim()) {
      setError('Please provide your security answer.');
      return;
    }

    setLoading(true);
    try {
      const res = await patientApi('/patient/auth/recover/verify', {
        method: 'POST',
        body: {
          patient_id: patientId,
          security_answer: securityAnswer.trim(),
        },
      });

      setMaskedEmail(res.masked_email);
      setStep('success');
    } catch (err) {
      setError(err.message || 'Incorrect security answer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        step === 'lookup'
          ? 'Recover Account'
          : step === 'challenge'
          ? 'Security Verification'
          : 'Account Found'
      }
      subtitle={
        step === 'lookup'
          ? 'Locate your account using your legal personal identity.'
          : step === 'challenge'
          ? 'Answer your saved secret question to confirm ownership.'
          : 'Verification successful.'
      }
      onClose={handleClose}
    >
      <div className="space-y-4">
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-700"
          >
            {error}
          </div>
        )}

        {/* STEP 1: IDENTITY LOOKUP */}
        {step === 'lookup' && (
          <form onSubmit={handleLookupSubmit} noValidate className="space-y-4">
            <p className="text-xs font-medium text-slate-600 leading-relaxed">
              Enter the legal name and date of birth registered with your Smile Avenue patient chart.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InputField
                label="First Name"
                required
                placeholder="e.g. Maria"
                value={lookupForm.first_name}
                onChange={(e) => setLookupForm({ ...lookupForm, first_name: e.target.value })}
              />

              <InputField
                label="Last Name"
                required
                placeholder="e.g. Santos"
                value={lookupForm.last_name}
                onChange={(e) => setLookupForm({ ...lookupForm, last_name: e.target.value })}
              />
            </div>

            <InputField
              label="Date of Birth"
              type="date"
              required
              max={todayManila()}
              value={lookupForm.birth_date}
              onChange={(e) => setLookupForm({ ...lookupForm, birth_date: e.target.value })}
            />

            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  handleClose();
                  onSwitchToLogin?.();
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

        {/* STEP 2: SECURITY QUESTION CHALLENGE */}
        {step === 'challenge' && (
          <form onSubmit={handleChallengeSubmit} noValidate className="space-y-4">
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800">
                Security Question
              </span>
              <p className="text-sm font-bold text-slate-900">{securityQuestion}</p>
            </div>

            <InputField
              label="Your Secret Answer"
              type="text"
              required
              autoFocus
              placeholder="Enter your answer"
              value={securityAnswer}
              onChange={(e) => setSecurityAnswer(e.target.value)}
            />

            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setError('');
                  setStep('lookup');
                }}
              >
                ← Back
              </Button>

              <Button type="submit" variant="primary" disabled={loading}>
                {loading ? 'Checking Answer...' : 'Verify Identity'}
              </Button>
            </div>
          </form>
        )}

        {/* STEP 3: RECOVERY SUCCESS & MASKED EMAIL */}
        {step === 'success' && (
          <div className="space-y-5 text-center py-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-xl font-bold">
              ✓
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">
                Identity Confirmed
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Your registered Patient Portal account is linked to:
              </p>
              <div className="mt-3 inline-block rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 font-mono text-sm font-extrabold text-emerald-800 shadow-2xs">
                {maskedEmail}
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
              You can now log in using this email address or use the &ldquo;Forgot Password&rdquo; option to reset your credentials.
            </p>

            <div className="pt-2">
              <Button
                type="button"
                variant="primary"
                className="w-full"
                onClick={() => {
                  handleClose();
                  onSwitchToLogin?.();
                }}
              >
                Go to Login
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
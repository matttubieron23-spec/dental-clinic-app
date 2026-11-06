import { useEffect, useState } from 'react';
import { api } from './api';
import { Badge, Button, Card, EmptyState, InputField, Modal } from './ui';

export default function StaffManagement() {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create Staff Form State
  const [newStaff, setNewStaff] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    role: 'Receptionist',
  });
  const [creating, setCreating] = useState(false);

  // Reset Password Modal State
  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  // Deactivate Staff Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Danger Zone: System Purge Modal State
  const [purgeModalOpen, setPurgeModalOpen] = useState(false);
  const [confirmDeleteInput, setConfirmDeleteInput] = useState('');
  const [purging, setPurging] = useState(false);

  const loadStaff = async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await api('api/staff/users');
      setStaffList(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(err.message || 'Failed to load clinic staff accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newStaff.first_name.trim() || !newStaff.last_name.trim()) {
      setError('First name and last name are required.');
      return;
    }
    if (!newStaff.email.trim()) {
      setError('Email address is required.');
      return;
    }
    if (!newStaff.password || newStaff.password.length < 6) {
      setError('Temporary password must be at least 6 characters.');
      return;
    }

    setCreating(true);
    try {
      const res = await api('api/staff/users', {
        method: 'POST',
        body: newStaff,
      });
      setSuccess(res.message || 'Staff account created and verification OTP sent.');
      setNewStaff({
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        role: 'Receptionist',
      });
      await loadStaff();
    } catch (err) {
      setError(err.message || 'Failed to create staff account.');
    } finally {
      setCreating(false);
    }
  };

  const handleRoleChange = async (staffId, nextRole) => {
    setError('');
    setSuccess('');
    try {
      const res = await api(`api/staff/users/${staffId}/role`, {
        method: 'PUT',
        body: { role: nextRole },
      });
      setSuccess(res.message || 'Role updated.');
      await loadStaff();
    } catch (err) {
      setError(err.message || 'Failed to update role.');
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!resetTarget) return;
    if (!newPassword || newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }

    setResetting(true);
    setError('');
    try {
      const res = await api(`api/staff/users/${resetTarget.id}/password`, {
        method: 'PUT',
        body: { new_password: newPassword },
      });
      setSuccess(res.message || 'Password updated.');
      setResetTarget(null);
      setNewPassword('');
    } catch (err) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setResetting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    try {
      const res = await api(`api/staff/users/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      setSuccess(res.message || 'Staff account deactivated.');
      setDeleteTarget(null);
      await loadStaff();
    } catch (err) {
      setError(err.message || 'Failed to deactivate staff account.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  // Danger Zone: System Purge Submit Handler
  const handleSystemPurgeSubmit = async (e) => {
    e.preventDefault();
    if (confirmDeleteInput.trim() !== 'DELETE ALL') {
      setError('Please type "DELETE ALL" exactly to confirm.');
      return;
    }

    setPurging(true);
    setError('');
    try {
      await api('api/admin/reset-system', { method: 'POST' });

      // Clear all authentication credentials
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      sessionStorage.clear();

      // Store redirect notice and send to login
      sessionStorage.setItem('reset_notice', 'System reset successful. Please log in.');
      window.location.href = '/staff';
    } catch (err) {
      setError(err.message || 'Failed to purge clinic data.');
      setPurging(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200/80 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Settings &amp; Staff Management
        </h1>
        <p className="mt-0.5 text-sm font-medium text-slate-500">
          Create clinic staff accounts, assign Role-Based Access Control (Admin, Dentist, Receptionist), and manage credentials.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700"
        >
          {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800"
        >
          {success}
        </div>
      )}

      {/* 1. ADD NEW STAFF MEMBER CARD */}
      <Card className="p-6 sm:p-8">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="text-base font-bold text-slate-900">Add New Staff Member</h2>
          <p className="text-xs font-medium text-slate-500">
            A 6-digit email verification OTP will be sent to the staff member&apos;s email upon creation.
          </p>
        </div>

        <form onSubmit={handleCreateStaff} noValidate className="mt-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <InputField
              label="First Name"
              required
              placeholder="e.g. Jane"
              value={newStaff.first_name}
              onChange={(e) =>
                setNewStaff({ ...newStaff, first_name: e.target.value })
              }
            />
            <InputField
              label="Last Name"
              required
              placeholder="e.g. Smith"
              value={newStaff.last_name}
              onChange={(e) =>
                setNewStaff({ ...newStaff, last_name: e.target.value })
              }
            />
            <InputField
              label="Email Address"
              type="email"
              required
              placeholder="staff@clinic.com"
              value={newStaff.email}
              onChange={(e) =>
                setNewStaff({ ...newStaff, email: e.target.value })
              }
            />
            <InputField
              label="Temporary Password"
              type="password"
              required
              placeholder="Min. 6 characters"
              value={newStaff.password}
              onChange={(e) =>
                setNewStaff({ ...newStaff, password: e.target.value })
              }
            />
            <InputField
              label="Assigned Role"
              as="select"
              value={newStaff.role}
              onChange={(e) =>
                setNewStaff({ ...newStaff, role: e.target.value })
              }
            >
              <option value="Receptionist">Receptionist</option>
              <option value="Dentist">Dentist</option>
              <option value="Admin">Admin</option>
            </InputField>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" variant="primary" disabled={creating}>
              {creating ? 'Creating & Sending OTP...' : 'Create Staff Account'}
            </Button>
          </div>
        </form>
      </Card>

      {/* 2. ACTIVE STAFF DIRECTORY TABLE */}
      <Card noPadding className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Authorized Clinic Personnel ({staffList.length})
            </h2>
            <p className="text-xs font-medium text-slate-500">
              Manage active roles, email verification status, and password resets.
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={loadStaff}>
            ↻ Refresh
          </Button>
        </div>

        {loading ? (
          <p className="p-10 text-center text-xs font-medium text-slate-500">
            Loading staff accounts...
          </p>
        ) : staffList.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No active staff accounts found"
              description="Use the form above to add dentists and receptionists."
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {staffList.map((member) => {
              const isSelf = member.id === currentUser?.id;
              return (
                <div
                  key={member.id}
                  className="flex flex-col justify-between gap-4 px-6 py-4 sm:flex-row sm:items-center"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {member.first_name} {member.last_name}
                      </span>
                      {isSelf && (
                        <Badge tone="info">You</Badge>
                      )}
                      <Badge status={member.role}>{member.role}</Badge>
                      <Badge status={member.is_verified ? 'approved' : 'pending'}>
                        {member.is_verified ? 'Verified' : 'OTP Pending'}
                      </Badge>
                    </div>
                    <p className="text-xs font-medium text-slate-500">{member.email}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <select
                      aria-label={`Change role for ${member.first_name}`}
                      value={member.role}
                      disabled={isSelf}
                      onChange={(e) => handleRoleChange(member.id, e.target.value)}
                      className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 focus:border-blue-600 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <option value="Admin">Admin</option>
                      <option value="Dentist">Dentist</option>
                      <option value="Receptionist">Receptionist</option>
                    </select>

                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setNewPassword('');
                        setResetTarget(member);
                      }}
                      className="!h-9 !min-h-0 !px-3 !py-1.5 !text-xs"
                    >
                      Reset Password
                    </Button>

                    <Button
                      type="button"
                      variant="danger"
                      disabled={isSelf}
                      onClick={() => setDeleteTarget(member)}
                      className="!h-9 !min-h-0 !px-3 !py-1.5 !text-xs"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* 3. DANGER ZONE: PURGE SYSTEM DATA */}
      {currentUser?.role === 'Admin' && (
        <Card noPadding className="border-2 border-red-300 bg-red-50/20 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚠️</span>
                <h2 className="text-base font-bold text-red-950">
                  Danger Zone: Purge System Data
                </h2>
              </div>
              <p className="text-xs text-slate-600 max-w-xl leading-relaxed">
                Permanently delete all patient records, medical charts, appointments, and financial history. All staff accounts except yours will also be removed.
              </p>
            </div>

            <Button
              type="button"
              variant="danger"
              onClick={() => {
                setConfirmDeleteInput('');
                setError('');
                setPurgeModalOpen(true);
              }}
            >
              Purge System Data
            </Button>
          </div>
        </Card>
      )}

      {/* MODAL: RESET STAFF PASSWORD */}
      {resetTarget && (
        <Modal
          title="Reset Staff Password"
          subtitle={`${resetTarget.first_name} ${resetTarget.last_name} (${resetTarget.email})`}
          onClose={() => setResetTarget(null)}
        >
          <form onSubmit={handleResetPasswordSubmit} noValidate className="space-y-4">
            <InputField
              label="New Password"
              type="password"
              required
              placeholder="At least 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />

            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setResetTarget(null)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={resetting}>
                {resetting ? 'Updating...' : 'Update Password'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL: CONFIRM REMOVE STAFF */}
      {deleteTarget && (
        <Modal
          title="Remove Staff Account"
          subtitle={`Deactivate access for ${deleteTarget.first_name} ${deleteTarget.last_name}?`}
          onClose={() => setDeleteTarget(null)}
        >
          <div className="space-y-5">
            <p className="text-xs font-medium leading-relaxed text-slate-600">
              This will immediately revoke portal login access for{' '}
              <strong>{deleteTarget.email}</strong> while preserving historical audit logs and clinical records.
            </p>
            <div className="flex justify-end gap-2.5">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={deleting}
                onClick={handleConfirmDelete}
              >
                {deleting ? 'Removing...' : 'Yes, Remove Access'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: CONFIRM PURGE SYSTEM DATA */}
      {purgeModalOpen && (
        <Modal
          title="⚠️ Purge System Data"
          subtitle="Are you sure? This will delete all patients, appointments, and financial records. This action CANNOT be undone."
          onClose={() => !purging && setPurgeModalOpen(false)}
        >
          <form onSubmit={handleSystemPurgeSubmit} className="space-y-4">
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-950 leading-relaxed space-y-2">
              <p className="font-bold">The following data will be permanently purged:</p>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-red-900">
                <li>All patient demographics, medical histories, and portal logins</li>
                <li>All odontogram tooth records and dental chart procedures</li>
                <li>All payment ledger entries, charges, discounts, and receipts</li>
                <li>All clinic appointments and pending online requests</li>
                <li>All staff accounts (except your current logged-in Admin account)</li>
              </ul>
            </div>

            <div>
              <InputField
                label='To confirm, type "DELETE ALL" in uppercase:'
                type="text"
                required
                autoFocus
                placeholder="DELETE ALL"
                value={confirmDeleteInput}
                onChange={(e) => setConfirmDeleteInput(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="secondary"
                disabled={purging}
                onClick={() => setPurgeModalOpen(false)}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                variant="danger"
                disabled={purging || confirmDeleteInput.trim() !== 'DELETE ALL'}
              >
                {purging ? 'Purging All Data...' : 'Permanently Delete Everything'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
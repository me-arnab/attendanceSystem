import React, { useState } from 'react';
import { authService } from '../../services/authService';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { KeyRound, ShieldCheck, Check, X, Lock, AlertCircle } from 'lucide-react';

export const ChangePasswordPage: React.FC = () => {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  // Live password requirement evaluations
  const requirements = [
    { label: 'At least 8 characters long', met: newPassword.length >= 8 },
    { label: 'One uppercase letter (A-Z)', met: /[A-Z]/.test(newPassword) },
    { label: 'One lowercase letter (a-z)', met: /[a-z]/.test(newPassword) },
    { label: 'One numeric digit (0-9)', met: /\d/.test(newPassword) },
    { label: 'One special character (!@#$%^&*...)', met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(newPassword) },
    {
      label: 'Different from current password',
      met: Boolean(newPassword && currentPassword && newPassword !== currentPassword),
    },
    {
      label: 'Passwords match',
      met: Boolean(newPassword && confirmPassword && newPassword === confirmPassword),
    },
  ];

  const allPolicyMet = requirements.slice(0, 5).every((r) => r.met);
  const passwordsMatch = newPassword === confirmPassword;
  const isDifferentFromCurrent = newPassword !== currentPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setClientError(null);

    if (!currentPassword) {
      setClientError('Current password is required.');
      return;
    }

    if (!allPolicyMet) {
      setClientError('Please ensure your new password satisfies all security criteria below.');
      return;
    }

    if (!isDifferentFromCurrent) {
      setClientError('New password cannot be identical to your current password.');
      return;
    }

    if (!passwordsMatch) {
      setClientError('New password and confirmation do not match.');
      return;
    }

    setLoading(true);
    try {
      await authService.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      success('Your password has been changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setClientError(null);
    } catch (err: any) {
      toastError(err.message || 'Failed to change password. Please check your current password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Security & Password"
        subtitle="Manage your personal account credentials and security authentication."
      />

      <Card>
        <div className="flex items-center gap-3 pb-4 mb-6 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-700">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Change Account Password</h3>
            <p className="text-xs text-slate-500">
              Authenticated as <span className="font-semibold text-slate-700">{user?.fullName}</span> ({user?.email})
            </p>
          </div>
        </div>

        {clientError && (
          <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <span>{clientError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Current Password"
            type="password"
            placeholder="Enter your current password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            helperText="Required to verify account ownership"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="New Password"
              type="password"
              placeholder="••••••••"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />

            <Input
              label="Confirm New Password"
              type="password"
              placeholder="••••••••"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          {/* Password Security Policy & Realtime Checklist */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand-700" />
              <span className="text-xs font-bold text-slate-800">Password Security Requirements</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
              {requirements.map((req, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-2 transition-colors ${
                    req.met ? 'text-emerald-700 font-medium' : 'text-slate-500'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] ${
                      req.met
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                        : 'bg-slate-200 text-slate-400'
                    }`}
                  >
                    {req.met ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : '•'}
                  </div>
                  <span className="truncate">{req.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <Button
              type="button"
              variant="outline"
              disabled={loading || (!currentPassword && !newPassword && !confirmPassword)}
              onClick={() => {
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setClientError(null);
              }}
            >
              Reset Form
            </Button>

            <Button
              type="submit"
              isLoading={loading}
              disabled={!currentPassword || !newPassword || !confirmPassword}
            >
              Update Password
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

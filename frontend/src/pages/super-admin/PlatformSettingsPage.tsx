import React, { useEffect, useState } from 'react';
import { superAdminService } from '../../services/superAdminService';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import { usePlatformConfig } from '../../context/PlatformConfigContext';
import { Settings, Shield, Bell, CheckCircle } from 'lucide-react';

export const PlatformSettingsPage: React.FC = () => {
  const { updateLocalConfig, refreshPlatformConfig } = usePlatformConfig();
  const [settings, setSettings] = useState({
    platformName: '',
    systemAnnouncement: '',
    maintenanceMode: false,
    allowSelfRegistration: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { success, error } = useToast();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await superAdminService.getPlatformSettings();
        setSettings(data);
      } catch (err: any) {
        error(err.message || 'Failed to load platform settings');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await superAdminService.updatePlatformSettings(settings);
      setSettings(updated);
      updateLocalConfig(updated);
      await refreshPlatformConfig();
      success('Platform settings successfully updated.');
    } catch (err: any) {
      error(err.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading platform configuration..." />;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Platform Settings"
        subtitle="Global platform-wide configuration and security defaults."
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
            <Settings className="w-5 h-5 text-brand-700" />
            <h3 className="text-base font-semibold text-slate-900">General Platform Information</h3>
          </div>

          <div className="space-y-4">
            <Input
              label="Platform Branding Name"
              value={settings.platformName}
              onChange={(e) => setSettings({ ...settings, platformName: e.target.value })}
              required
            />

            <Input
              label="System-wide Announcement / Banner"
              value={settings.systemAnnouncement}
              onChange={(e) => setSettings({ ...settings, systemAnnouncement: e.target.value })}
              helperText="Broadcasted across all client dashboards for scheduled updates or maintenance"
            />
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
            <Shield className="w-5 h-5 text-brand-700" />
            <h3 className="text-base font-semibold text-slate-900">Tenant Registration Policies</h3>
          </div>

          <div className="space-y-4">
            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-900 focus:ring-brand-700"
                checked={settings.allowSelfRegistration}
                onChange={(e) =>
                  setSettings({ ...settings, allowSelfRegistration: e.target.checked })
                }
              />
              <div>
                <span className="text-sm font-semibold text-slate-900">
                  Allow Public Tenant Registration
                </span>
                <p className="text-xs text-slate-500 mt-0.5">
                  When enabled, external organizations can sign up for demo companies without Super Admin pre-approval.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-900 focus:ring-brand-700"
                checked={settings.maintenanceMode}
                onChange={(e) =>
                  setSettings({ ...settings, maintenanceMode: e.target.checked })
                }
              />
              <div>
                <span className="text-sm font-semibold text-slate-900">Platform Maintenance Mode</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  Temporarily restricts API write actions for routine maintenance.
                </p>
              </div>
            </label>
          </div>
        </Card>

        <div className="flex justify-end pt-2">
          <Button type="submit" size="lg" isLoading={saving}>
            Save Platform Settings
          </Button>
        </div>
      </form>
    </div>
  );
};

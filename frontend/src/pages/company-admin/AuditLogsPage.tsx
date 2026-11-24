import React, { useEffect, useState } from 'react';
import { companyService } from '../../services/companyService';
import { AuditLog } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { Card } from '../../components/ui/Card';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';
import { useToast } from '../../context/ToastContext';
import { ClipboardList, Shield, User, Clock, FileText } from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { error } = useToast();

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await companyService.getAuditLogs();
        setLogs(data);
      } catch (err: any) {
        error(err.message || 'Failed to load audit logs');
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const getActionBadge = (action: string) => {
    if (action.includes('CREATED')) {
      return <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">{action}</span>;
    }
    if (action.includes('DEACTIVATED') || action.includes('SUSPENDED')) {
      return <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded">{action}</span>;
    }
    if (action.includes('CORRECTION')) {
      return <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded">{action}</span>;
    }
    return <span className="bg-slate-100 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded">{action}</span>;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance & Audit Trail"
        subtitle="Immutable audit log of all administrative actions, employee updates, and attendance overrides."
      />

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <LoadingSpinner message="Retrieving audit records..." />
        ) : logs.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No audit entries logged yet"
              description="Actions performed by company admins will automatically be recorded here."
              icon={<ClipboardList className="w-8 h-8 text-slate-400" />}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-6 font-semibold">Timestamp</th>
                  <th className="py-3.5 px-6 font-semibold">Actor</th>
                  <th className="py-3.5 px-6 font-semibold">Action</th>
                  <th className="py-3.5 px-6 font-semibold">Entity</th>
                  <th className="py-3.5 px-6 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-xs">
                {logs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-6 text-slate-500 font-sans">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-6 font-sans">
                      <div className="font-semibold text-slate-900">{log.actorName}</div>
                      <div className="text-[11px] text-slate-400">{log.actorRole}</div>
                    </td>
                    <td className="py-3.5 px-6 font-sans">{getActionBadge(log.action)}</td>
                    <td className="py-3.5 px-6 font-sans">
                      <span className="font-semibold text-slate-800">{log.entityType}</span>
                    </td>
                    <td className="py-3.5 px-6 text-[11px] text-slate-600 max-w-md truncate">
                      {JSON.stringify(log.details || {})}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

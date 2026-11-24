import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Access Denied</h1>
      <p className="text-sm text-slate-500 max-w-sm mt-2 mb-6">
        You do not have permission to access this portal or resource. Please check your role credentials.
      </p>
      <Button icon={<ArrowLeft className="w-4 h-4" />} onClick={() => navigate('/login')}>
        Return to Login
      </Button>
    </div>
  );
};

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
      <h1 className="text-6xl font-bold text-brand-900">404</h1>
      <h2 className="text-xl font-bold text-slate-900 mt-2">Page Not Found</h2>
      <p className="text-sm text-slate-500 max-w-sm mt-1 mb-6">
        The requested URL was not found on this system.
      </p>
      <Button icon={<ArrowLeft className="w-4 h-4" />} onClick={() => navigate('/login')}>
        Return to Dashboard
      </Button>
    </div>
  );
};

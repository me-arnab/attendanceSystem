import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingSpinner: React.FC<{ message?: string; fullPage?: boolean }> = ({
  message = 'Loading data...',
  fullPage = false,
}) => {
  if (fullPage) {
    return (
      <div className="fixed inset-0 bg-slate-50/80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
        <Loader2 className="w-8 h-8 animate-spin text-brand-900 mb-3" />
        <p className="text-sm font-medium text-slate-600">{message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-brand-900 mb-2" />
      <p className="text-xs text-slate-500">{message}</p>
    </div>
  );
};

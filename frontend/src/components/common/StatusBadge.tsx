import React from 'react';
import { Badge, BadgeVariant } from '../ui/Badge';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const normalized = (status || '').toUpperCase();

  let variant: BadgeVariant = 'neutral';
  let label = status;

  switch (normalized) {
    case 'ACTIVE':
      variant = 'success';
      label = 'Active';
      break;
    case 'SUSPENDED':
      variant = 'danger';
      label = 'Suspended';
      break;
    case 'INACTIVE':
      variant = 'neutral';
      label = 'Inactive';
      break;
    case 'PRESENT':
      variant = 'success';
      label = 'Present';
      break;
    case 'LATE':
      variant = 'warning';
      label = 'Late';
      break;
    case 'ABSENT':
      variant = 'danger';
      label = 'Absent';
      break;
    case 'INCOMPLETE':
      variant = 'info';
      label = 'Incomplete';
      break;
    default:
      variant = 'neutral';
      label = status;
  }

  return (
    <Badge variant={variant} size={size}>
      {label}
    </Badge>
  );
};

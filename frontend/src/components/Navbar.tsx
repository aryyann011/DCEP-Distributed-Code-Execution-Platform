import { KeyRound } from 'lucide-react';
import type { NavbarProps, ConnectionStatus } from '../types';

const STATUS_CONFIG: Record<ConnectionStatus, { color: string; label: string }> = {
  connected:    { color: 'bg-success',  label: 'Connected' },
  disconnected: { color: 'bg-muted',    label: 'Disconnected' },
  connecting:   { color: 'bg-warning',  label: 'Connecting…' },
};

export default function Navbar({ connectionStatus }: NavbarProps) {
  const status = STATUS_CONFIG[connectionStatus];

  return (
    <nav className="h-[52px] flex items-center justify-between px-5 border-b border-border shrink-0">
      <div className="flex items-center gap-2 text-[13px] select-none">
        <span className="font-semibold text-primary tracking-tight">DCEP</span>
        <span className="text-border-hover">/</span>
        <span className="text-secondary">Execution Engine</span>
        <span className="text-border-hover">/</span>
        <span className="text-muted">Dashboard</span>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className={`w-[6px] h-[6px] rounded-full ${status.color}`} />
          <span className="text-[12px] text-secondary">{status.label}</span>
        </div>
      </div>
    </nav>
  );
}

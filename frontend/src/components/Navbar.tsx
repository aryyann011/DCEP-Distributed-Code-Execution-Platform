import { KeyRound } from 'lucide-react';
import type { NavbarProps, ConnectionStatus } from '../types';

const STATUS_CONFIG: Record<ConnectionStatus, { color: string; label: string }> = {
  connected:    { color: 'bg-success',  label: 'Connected' },
  disconnected: { color: 'bg-muted',    label: 'Disconnected' },
  connecting:   { color: 'bg-warning',  label: 'Connecting…' },
};

export default function Navbar({ connectionStatus, apiKey, onApiKeyChange }: NavbarProps) {
  const status = STATUS_CONFIG[connectionStatus];

  return (
    <nav className="h-[52px] flex items-center justify-between px-5 border-b border-border shrink-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[13px] select-none">
        <span className="font-semibold text-primary tracking-tight">DCEP</span>
        <span className="text-border-hover">/</span>
        <span className="text-secondary">Execution Engine</span>
        <span className="text-border-hover">/</span>
        <span className="text-muted">Dashboard</span>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-6">
        {/* WebSocket indicator */}
        <div className="flex items-center gap-2">
          <div className={`w-[6px] h-[6px] rounded-full ${status.color}`} />
          <span className="text-[12px] text-secondary">{status.label}</span>
        </div>

        {/* API Key input */}
        <div className="relative">
          <KeyRound size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            type="password"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder="API Key"
            spellCheck={false}
            className="
              h-[30px] w-[160px] pl-8 pr-3
              bg-transparent text-[12px] text-primary font-mono
              border border-border rounded-md
              placeholder:text-muted
              focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/15
              transition-colors duration-150
            "
          />
        </div>
      </div>
    </nav>
  );
}

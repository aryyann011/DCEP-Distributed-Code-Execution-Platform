import { useRef, useEffect } from 'react';
import { Clock, HardDrive, Terminal } from 'lucide-react';
import type { ExecutionLogsProps, Verdict } from '../types';

/* ── Verdict styling ── */

const VERDICT_STYLE: Record<Verdict, { bg: string; text: string; label: string }> = {
  PENDING:                { bg: '',                text: 'text-muted',   label: 'Pending' },
  RUNNING:                { bg: 'bg-accent-soft',  text: 'text-accent',  label: 'Running' },
  ACCEPTED:               { bg: 'bg-success-soft', text: 'text-success', label: 'Accepted' },
  WRONG_ANSWER:           { bg: 'bg-error-soft',   text: 'text-error',   label: 'Wrong Answer' },
  TIME_LIMIT_EXCEEDED:    { bg: 'bg-warning-soft', text: 'text-warning', label: 'TLE' },
  MEMORY_LIMIT_EXCEEDED:  { bg: 'bg-warning-soft', text: 'text-warning', label: 'MLE' },
  RUNTIME_ERROR:          { bg: 'bg-error-soft',   text: 'text-error',   label: 'Runtime Error' },
  COMPILE_ERROR:          { bg: 'bg-error-soft',   text: 'text-error',   label: 'Compile Error' },
  SYSTEM_ERROR:           { bg: 'bg-error-soft',   text: 'text-error',   label: 'System Error' },
};

const ERROR_VERDICTS: Verdict[] = [
  'WRONG_ANSWER', 'RUNTIME_ERROR', 'COMPILE_ERROR', 'SYSTEM_ERROR',
];

/* ── Component ── */

export default function ExecutionLogs({ result }: ExecutionLogsProps) {
  const { verdict, executionTime, memory, output } = result;
  const style = VERDICT_STYLE[verdict];
  const isIdle = verdict === 'PENDING';
  const isError = ERROR_VERDICTS.includes(verdict);

  /* Auto-scroll log output */
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [output]);

  return (
    <div className="flex flex-col h-full bg-surface border border-border rounded-xl overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 h-[44px] border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Terminal size={14} strokeWidth={1.5} className="text-muted" />
          <span className="text-[12px] text-secondary font-medium tracking-wide uppercase">
            Output
          </span>
        </div>

        {/* Verdict badge */}
        {!isIdle && (
          <span
            className={`
              px-2.5 py-[3px] rounded-md text-[10px] font-semibold tracking-wide
              ${style.bg} ${style.text}
            `}
          >
            {style.label}
          </span>
        )}
      </div>

      {/* ── Metrics bar ── */}
      <div className="flex items-center gap-5 px-4 h-[38px] border-b border-border shrink-0">
        <Metric
          icon={<Clock size={12} strokeWidth={1.5} />}
          label="Time"
          value={executionTime !== null ? `${executionTime}ms` : '—'}
        />
        <Metric
          icon={<HardDrive size={12} strokeWidth={1.5} />}
          label="Memory"
          value={memory ?? '—'}
        />
      </div>

      {/* ── Log output ── */}
      <div
        ref={scrollRef}
        className={`
          flex-1 min-h-0 overflow-y-auto p-4
          ${isError ? 'bg-error-soft/40' : ''}
          transition-colors duration-300
        `}
      >
        {output ? (
          <pre className="text-[12px] font-mono text-secondary whitespace-pre-wrap leading-[1.7]">
            {output}
          </pre>
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-[12px] text-muted italic">Awaiting submission…</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Inline metric ── */

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted">{icon}</span>
      <span className="text-[11px] text-muted">{label}</span>
      <span className="text-[11px] text-primary font-mono font-medium">{value}</span>
    </div>
  );
}

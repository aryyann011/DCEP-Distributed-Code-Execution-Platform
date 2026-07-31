import { Fragment } from 'react';
import { Globe, Container, Cpu, ChevronRight } from 'lucide-react';
import type { TopologyMapProps, JobStatus } from '../types';

/* ── Node definitions ── */

type NodeStatus = 'idle' | 'active' | 'done' | 'error';

interface PipelineNode {
  id: string;
  label: string;
  tech: string;
  icon: typeof Globe;
  resolve: (job: JobStatus) => NodeStatus;
}

const NODES: PipelineNode[] = [
  {
    id: 'gateway',
    label: 'API Gateway',
    tech: 'Express + WS',
    icon: Globe,
    resolve: (s) =>
      s === 'error' ? 'error' :
      s === 'completed' ? 'done' :
      s !== 'idle' ? 'active' : 'idle',
  },
  {
    id: 'queue',
    label: 'Message Queue',
    tech: 'BullMQ · Redis',
    icon: Container,
    resolve: (s) =>
      s === 'error' ? 'error' :
      s === 'completed' ? 'done' :
      ['queued', 'compiling', 'running'].includes(s) ? 'active' : 'idle',
  },
  {
    id: 'worker',
    label: 'Exec Worker',
    tech: 'Docker · g++',
    icon: Cpu,
    resolve: (s) =>
      s === 'error' ? 'error' :
      s === 'completed' ? 'done' :
      ['compiling', 'running'].includes(s) ? 'active' : 'idle',
  },
];

/* ── Visual styles per status ── */

const STYLES: Record<NodeStatus, {
  border: string;
  bg: string;
  dot: string;
  icon: string;
  label: string;
  text: string;
}> = {
  idle: {
    border: 'border-border',
    bg: 'bg-background',
    dot: 'bg-muted',
    icon: 'text-muted',
    label: 'Ready',
    text: 'text-muted',
  },
  active: {
    border: 'border-accent/60',
    bg: 'bg-accent-soft',
    dot: 'bg-accent',
    icon: 'text-accent',
    label: 'Active',
    text: 'text-accent',
  },
  done: {
    border: 'border-success/60',
    bg: 'bg-success-soft',
    dot: 'bg-success',
    icon: 'text-success',
    label: 'Done',
    text: 'text-success',
  },
  error: {
    border: 'border-error/60',
    bg: 'bg-error-soft',
    dot: 'bg-error',
    icon: 'text-error',
    label: 'Error',
    text: 'text-error',
  },
};

/* ── Component ── */

export default function TopologyMap({ jobStatus }: TopologyMapProps) {
  return (
    <div className="flex flex-col h-full bg-surface border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-[44px] border-b border-border shrink-0">
        <span className="text-[12px] text-secondary font-medium tracking-wide uppercase">
          Pipeline
        </span>
        <span className="text-[11px] text-muted font-mono">
          {jobStatus === 'idle' ? 'Idle' : jobStatus.charAt(0).toUpperCase() + jobStatus.slice(1)}
        </span>
      </div>

      {/* Pipeline flow */}
      <div className="flex-1 flex items-center justify-center px-5">
        <div className="flex items-stretch gap-2.5 w-full">
          {NODES.map((node, i) => {
            const status = node.resolve(jobStatus);
            const s = STYLES[status];
            const Icon = node.icon;

            return (
              <Fragment key={node.id}>
                {/* Connector arrow */}
                {i > 0 && (
                  <div className="flex items-center shrink-0 -mx-0.5">
                    <ChevronRight
                      size={14}
                      strokeWidth={1.5}
                      className={`transition-colors duration-300 ${
                        status !== 'idle' ? s.icon : 'text-border-hover'
                      }`}
                    />
                  </div>
                )}

                {/* Node card */}
                <div
                  className={`
                    flex-1 flex flex-col items-center justify-center gap-2.5
                    py-5 rounded-lg border
                    transition-all duration-300
                    ${s.border} ${s.bg}
                  `}
                >
                  <Icon
                    size={20}
                    strokeWidth={1.5}
                    className={`transition-colors duration-300 ${s.icon}`}
                  />
                  <div className="text-center">
                    <p className="text-[12px] text-primary font-medium leading-none">
                      {node.label}
                    </p>
                    <p className="text-[10px] text-muted mt-1">{node.tech}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`w-[5px] h-[5px] rounded-full transition-colors duration-300 ${s.dot}`}
                    />
                    <span
                      className={`text-[10px] font-medium transition-colors duration-300 ${s.text}`}
                    >
                      {s.label}
                    </span>
                  </div>
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

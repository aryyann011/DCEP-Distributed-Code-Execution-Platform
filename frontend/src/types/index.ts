export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';

export type JobStatus = 'idle' | 'queued' | 'compiling' | 'running' | 'completed' | 'error';

export type Language = 'cpp' | 'python';

export type Verdict =
  | 'PENDING'
  | 'RUNNING'
  | 'ACCEPTED'
  | 'WRONG_ANSWER'
  | 'TIME_LIMIT_EXCEEDED'
  | 'MEMORY_LIMIT_EXCEEDED'
  | 'RUNTIME_ERROR'
  | 'COMPILE_ERROR'
  | 'SYSTEM_ERROR';

export interface ExecutionResult {
  verdict: Verdict;
  executionTime: number | null;
  memory: string | null;
  output: string;
}

export interface NavbarProps {
  connectionStatus: ConnectionStatus;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
}

export interface CodeEditorProps {
  onSubmit: (code: string, language: Language) => void;
  isExecuting: boolean;
}

export interface TopologyMapProps {
  jobStatus: JobStatus;
}

export interface ExecutionLogsProps {
  result: ExecutionResult;
}

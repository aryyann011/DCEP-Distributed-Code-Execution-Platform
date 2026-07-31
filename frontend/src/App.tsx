import { useState, useCallback, useRef, useEffect } from 'react';
import Navbar from './components/Navbar';
import { CodeEditor } from './components/CodeEditor';
import TopologyMap from './components/TopologyMap';
import ExecutionLogs from './components/ExecutionLogs';
import type { ConnectionStatus, JobStatus, ExecutionResult, Language, Verdict } from './types';

/* ─────────────────────────────────────────────
   Utilities
   ───────────────────────────────────────────── */

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/* ─────────────────────────────────────────────
   Demo Scenarios
   ───────────────────────────────────────────── */

interface Scenario {
  verdict: Verdict;
  time: number | null;
  memory: string | null;
  run: (
    log: (line: string) => void,
    setJob: (status: JobStatus) => void,
  ) => Promise<void>;
}

const SCENARIOS: Scenario[] = [
  /* ── 1. ACCEPTED ── */
  {
    verdict: 'ACCEPTED',
    time: 45,
    memory: '3.2 MB',
    run: async (log, setJob) => {
      log('▸ Submitting payload to API Gateway...');
      await sleep(400);

      setJob('queued');
      log('▸ Payload enqueued → BullMQ [submissions]');
      await sleep(700);

      setJob('compiling');
      log('▸ Worker assigned — starting execution pipeline');
      log('  Compiling: g++ -O2 /app/main.cpp -o /app/a.out');
      await sleep(900);
      log('  ✓ Compilation successful (312ms)');
      await sleep(400);

      setJob('running');
      log('');
      log('▸ Test case 1/3');
      log('  input:  4\\n2 7 11 15\\n9');
      await sleep(450);
      log('  output: 0 1');
      log('  ✓ Accepted');
      await sleep(350);

      log('');
      log('▸ Test case 2/3');
      log('  input:  3\\n3 2 4\\n6');
      await sleep(400);
      log('  output: 1 2');
      log('  ✓ Accepted');
      await sleep(300);

      log('');
      log('▸ Test case 3/3 (hidden)');
      await sleep(500);
      log('  ✓ Accepted');
      await sleep(300);

      log('');
      log('▸ All test cases passed');
      log('  Verdict: ACCEPTED — 45ms, 3.2 MB');
    },
  },

  /* ── 2. WRONG_ANSWER ── */
  {
    verdict: 'WRONG_ANSWER',
    time: 38,
    memory: '2.8 MB',
    run: async (log, setJob) => {
      log('▸ Submitting payload to API Gateway...');
      await sleep(400);

      setJob('queued');
      log('▸ Payload enqueued → BullMQ [submissions]');
      await sleep(600);

      setJob('compiling');
      log('▸ Worker assigned — starting execution pipeline');
      log('  Compiling: g++ -O2 /app/main.cpp -o /app/a.out');
      await sleep(850);
      log('  ✓ Compilation successful (287ms)');
      await sleep(400);

      setJob('running');
      log('');
      log('▸ Test case 1/3');
      log('  input:  4\\n2 7 11 15\\n9');
      await sleep(400);
      log('  output: 0 1');
      log('  ✓ Accepted');
      await sleep(350);

      log('');
      log('▸ Test case 2/3');
      log('  input:  3\\n3 2 4\\n6');
      await sleep(400);
      log('  output: 0 2');
      log('  ✗ Wrong Answer');
      log('    expected: 1 2');
      log('    received: 0 2');
      await sleep(200);

      log('');
      log('▸ Execution halted on first failure');
      log('  Verdict: WRONG_ANSWER — 38ms, 2.8 MB');
    },
  },

  /* ── 3. COMPILE_ERROR ── */
  {
    verdict: 'COMPILE_ERROR',
    time: null,
    memory: null,
    run: async (log, setJob) => {
      log('▸ Submitting payload to API Gateway...');
      await sleep(400);

      setJob('queued');
      log('▸ Payload enqueued → BullMQ [submissions]');
      await sleep(600);

      setJob('compiling');
      log('▸ Worker assigned — starting execution pipeline');
      log('  Compiling: g++ -O2 /app/main.cpp -o /app/a.out');
      await sleep(1000);
      log('');
      log("  main.cpp:15:23: error: expected ';' after expression");
      log('      cout << "hello"');
      log('                      ^');
      log('                      ;');
      log('  1 error generated.');
      await sleep(300);

      log('');
      log('▸ Compilation failed — no test cases executed');
      log('  Verdict: COMPILE_ERROR');
    },
  },

  /* ── 4. TIME_LIMIT_EXCEEDED ── */
  {
    verdict: 'TIME_LIMIT_EXCEEDED',
    time: 2000,
    memory: '12.4 MB',
    run: async (log, setJob) => {
      log('▸ Submitting payload to API Gateway...');
      await sleep(400);

      setJob('queued');
      log('▸ Payload enqueued → BullMQ [submissions]');
      await sleep(600);

      setJob('compiling');
      log('▸ Worker assigned — starting execution pipeline');
      log('  Compiling: g++ -O2 /app/main.cpp -o /app/a.out');
      await sleep(800);
      log('  ✓ Compilation successful (256ms)');
      await sleep(400);

      setJob('running');
      log('');
      log('▸ Test case 1/3');
      log('  input:  4\\n2 7 11 15\\n9');
      await sleep(400);
      log('  output: 0 1');
      log('  ✓ Accepted');
      await sleep(350);

      log('');
      log('▸ Test case 2/3');
      log('  input:  100000\\n...');
      log('  ⏳ Awaiting container response...');
      await sleep(2200);
      log('  ✗ Time Limit Exceeded (2000ms)');
      log('  Container killed via SIGKILL');
      await sleep(200);

      log('');
      log('▸ Execution halted — sandbox timeout');
      log('  Verdict: TIME_LIMIT_EXCEEDED — 2000ms, 12.4 MB');
    },
  },
];

/* ─────────────────────────────────────────────
   App
   ───────────────────────────────────────────── */

export default function App() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [apiKey, setApiKey] = useState('');
  const [jobStatus, setJobStatus] = useState<JobStatus>('idle');
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<ExecutionResult>({
    verdict: 'PENDING',
    executionTime: null,
    memory: null,
    output: '',
  });

  const isRunning = useRef(false);
  const scenarioIdx = useRef(0);

  /* Simulate WebSocket connection on mount */
  useEffect(() => {
    setConnectionStatus('connecting');
    const t = setTimeout(() => setConnectionStatus('connected'), 1500);
    return () => clearTimeout(t);
  }, []);

  /* Append a line to the log output */
  const log = useCallback((line: string) => {
    setResult((prev) => ({
      ...prev,
      output: prev.output ? prev.output + '\n' + line : line,
    }));
  }, []);

  /* Demo simulation — cycles through scenarios on each Execute */
  const handleSubmit = useCallback(
    async (_code: string, _language: Language) => {
      if (isRunning.current) return;
      isRunning.current = true;

      const scenario = SCENARIOS[scenarioIdx.current % SCENARIOS.length];
      scenarioIdx.current++;

      // Reset
      setIsExecuting(true);
      setJobStatus('idle');
      setResult({ verdict: 'RUNNING', executionTime: null, memory: null, output: '' });

      try {
        // Run the scenario's step sequence
        await scenario.run(log, setJobStatus);

        // Apply final verdict
        setJobStatus(scenario.verdict === 'ACCEPTED' ? 'completed' : 'error');
        setResult((prev) => ({
          ...prev,
          verdict: scenario.verdict,
          executionTime: scenario.time,
          memory: scenario.memory ? scenario.memory : null,
        }));

        // Hold final state, then reset pipeline
        await sleep(4000);
        setJobStatus('idle');
      } finally {
        setIsExecuting(false);
        isRunning.current = false;
      }
    },
    [log],
  );

  /* ── Render ── */
  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      <Navbar
        connectionStatus={connectionStatus}
        apiKey={apiKey}
        onApiKeyChange={setApiKey}
      />

      <main className="flex-1 grid grid-cols-10 gap-3 p-3 min-h-0">
        {/* Code Editor — 60% */}
        <div className="col-span-6 min-h-0">
          <CodeEditor onSubmit={handleSubmit} isExecuting={isExecuting} />
        </div>

        {/* Right column — 40% */}
        <div className="col-span-4 grid grid-rows-[2fr_3fr] gap-3 min-h-0">
          <TopologyMap jobStatus={jobStatus} />
          <ExecutionLogs result={result} />
        </div>
      </main>
    </div>
  );
}

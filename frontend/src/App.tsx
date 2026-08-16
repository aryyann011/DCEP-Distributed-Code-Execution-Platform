import { useState, useCallback, useEffect } from 'react';
import Navbar from './components/Navbar';
import { CodeEditor } from './components/CodeEditor';
import TopologyMap from './components/TopologyMap';
import ExecutionLogs from './components/ExecutionLogs';
import type { JobStatus, ExecutionResult, Language } from './types';
import { getProblem, submitCode } from './api/api';
import { useSocket } from './hooks/useSocket';

export default function App() {
  const [problemId, setProblemId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus>('idle');
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<ExecutionResult>({
    verdict: 'PENDING',
    executionTime: null,
    memory: null,
    output: '',
  });

  const { connectionStatus, subscribeToJob, onProgress, onComplete } = useSocket();

  // Fetch problem on mount
  useEffect(() => {
    getProblem().then(problem => {
      if (problem) {
        setProblemId(problem.id);
      }
    });
  }, []);

  const appendLog = useCallback((line: string) => {
    setResult((prev) => ({
      ...prev,
      output: prev.output ? prev.output + '\n' + line : line,
    }));
  }, []);

  useEffect(() => {
    onProgress((data) => {
      switch(data.stage) {
        case 'COMPILING':
          setJobStatus('compiling');
          appendLog('▸ Worker assigned — starting execution pipeline');
          appendLog('  Compiling...');
          break;
        case 'COMPILED':
          appendLog(`  ✓ Compilation successful (${data.compilationTime}ms)`);
          break;
        case 'COMPILE_FAILED':
          setJobStatus('error');
          appendLog('  ✗ Compilation failed');
          appendLog(`  ${data.error}`);
          break;
        case 'RUNNING_TEST':
          setJobStatus('running');
          appendLog(`\n▸ Test case ${data.testIndex}/${data.totalTests}`);
          break;
        case 'TEST_RESULT':
          if (data.actualOutput !== null) {
            appendLog(`  output: ${data.actualOutput}`);
          }
          if (data.status === 'ACCEPTED') {
             appendLog(`  ✓ Accepted (${data.executionTime}ms)`);
          } else {
             appendLog(`  ✗ ${data.status}`);
          }
          break;
      }
    });

    onComplete((data) => {
      const isAccepted = data.status === 'ACCEPTED';
      setJobStatus(isAccepted ? 'completed' : 'error');
      
      setResult(prev => ({
        ...prev,
        verdict: data.status,
        executionTime: data.executionTime,
        memory: data.memory ? `${data.memory} MB` : null, 
      }));
      
      setIsExecuting(false);
      appendLog(`\n▸ Verdict: ${data.status} — ${data.executionTime}ms`);

      setTimeout(() => {
        setJobStatus('idle');
      }, 5000);
    });
  }, [onProgress, onComplete, appendLog]);


  const handleSubmit = useCallback(
    async (code: string, language: Language) => {
      if (!problemId) {
        appendLog('▸ ✗ Error: No problem loaded. Backend might be unreachable.');
        return;
      }

      setIsExecuting(true);
      setJobStatus('queued');
      setResult({ verdict: 'RUNNING', executionTime: null, memory: null, output: '' });
      appendLog('▸ Submitting payload to API Gateway...');

      try {
        const response = await submitCode(problemId, language, code);
        appendLog(`▸ Payload enqueued → BullMQ [submissions] (Job ID: ${response.submissionId})`);
        
        subscribeToJob(response.submissionId);
      } catch (error: any) {
        setJobStatus('error');
        setIsExecuting(false);
        setResult(prev => ({ ...prev, verdict: 'SYSTEM_ERROR' }));
        appendLog(`▸ ✗ Submission Failed: ${error.message}`);
      }
    },
    [problemId, subscribeToJob, appendLog],
  );

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      <Navbar
        connectionStatus={connectionStatus}
      />

      <main className="flex-1 grid grid-cols-10 gap-3 p-3 min-h-0">
        <div className="col-span-6 min-h-0">
          <CodeEditor onSubmit={handleSubmit} isExecuting={isExecuting} />
        </div>

        <div className="col-span-4 grid grid-rows-[2fr_3fr] gap-3 min-h-0">
          <TopologyMap jobStatus={jobStatus} />
          <ExecutionLogs result={result} isExecuting={isExecuting} />
        </div>
      </main>
    </div>
  );
}

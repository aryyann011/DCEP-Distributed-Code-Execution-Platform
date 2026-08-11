import { memo, useState } from 'react';
import Editor from '@monaco-editor/react';
import { Play, Loader2, FileCode2 } from 'lucide-react';
import type { CodeEditorProps, Language } from '../types';

/* ── Language config ── */

const LANGUAGES: { id: Language; label: string; monaco: string; file: string }[] = [
  { id: 'cpp',    label: 'C++',    monaco: 'cpp',    file: 'main.cpp' },
  { id: 'python', label: 'Python', monaco: 'python', file: 'main.py' },
];

const DEFAULT_CODE: Record<Language, string> = {
  cpp: `#include <iostream>
#include <vector>
using namespace std;

int main() {
    int n;
    cin >> n;

    vector<int> nums(n);
    for (int i = 0; i < n; i++) {
        cin >> nums[i];
    }

    int target;
    cin >> target;

    for (int i = 0; i < n; i++) {
        for (int j = i + 1; j < n; j++) {
            if (nums[i] + nums[j] == target) {
                cout << i << " " << j << endl;
                return 0;
            }
        }
    }

    return 0;
}`,
  python: `n = int(input())
nums = list(map(int, input().split()))
target = int(input())

# Solution
for i in range(n):
    for j in range(i + 1, n):
        if nums[i] + nums[j] == target:
            print(i, j)
            break
`,
};

/* ── Custom Monaco theme ── */

const defineEditorTheme = (monaco: any) => {
  monaco.editor.defineTheme('dcep', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment',  foreground: '636363', fontStyle: 'italic' },
      { token: 'keyword',  foreground: 'C084FC' },
      { token: 'string',   foreground: '86EFAC' },
      { token: 'number',   foreground: 'FDE68A' },
      { token: 'type',     foreground: '7DD3FC' },
    ],
    colors: {
      'editor.background':              '#111111',
      'editor.foreground':              '#EDEDED',
      'editor.lineHighlightBackground': '#191919',
      'editorGutter.background':        '#111111',
      'editor.selectionBackground':     '#264F7844',
      'editorCursor.foreground':        '#EDEDED',
      'editorIndentGuide.background':   '#222222',
      'editorLineNumber.foreground':    '#444444',
      'editorLineNumber.activeForeground': '#888888',
    },
  });
};

/* ── Component ── */

function CodeEditorInner({ onSubmit, isExecuting }: CodeEditorProps) {
  const [language, setLanguage] = useState<Language>('cpp');
  const [code, setCode] = useState(DEFAULT_CODE.cpp);
  
  const active = LANGUAGES.find((l) => l.id === language)!;

  const handleLanguageSwitch = (lang: Language) => {
    setLanguage(lang);
    setCode(DEFAULT_CODE[lang]);
  };

  return (
    <div className="flex flex-col h-full bg-surface border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 h-[44px] border-b border-border shrink-0">
        <div className="flex items-center gap-0.5">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.id}
              onClick={() => handleLanguageSwitch(lang.id)}
              className={`
                px-3 py-1.5 text-[12px] rounded-md transition-colors duration-150
                ${language === lang.id
                  ? 'bg-surface-alt text-primary font-medium'
                  : 'text-muted hover:text-secondary'}
              `}
            >
              {lang.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 text-muted">
          <FileCode2 size={13} />
          <span className="text-[11px] font-mono">{active.file}</span>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language={active.monaco}
          value={code}
          onChange={(v) => setCode(v ?? '')}
          theme="dcep"
          beforeMount={defineEditorTheme}
          options={{
            fontSize: 13,
            lineHeight: 22,
            fontFamily: "'JetBrains Mono', monospace",
            fontLigatures: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            renderLineHighlight: 'line',
            lineNumbersMinChars: 3,
            glyphMargin: false,
            folding: true,
            padding: { top: 16, bottom: 16 },
            overviewRulerBorder: false,
            hideCursorInOverviewRuler: true,
            overviewRulerLanes: 0,
            scrollbar: {
              verticalScrollbarSize: 5,
              horizontalScrollbarSize: 5,
              useShadows: false,
            },
            wordWrap: 'on',
            contextmenu: false,
            bracketPairColorization: { enabled: true },
            guides: { indentation: true, bracketPairs: false },
            smoothScrolling: true,
            cursorSmoothCaretAnimation: 'on',
            cursorBlinking: 'smooth',
          }}
        />
      </div>

      <div className="flex items-center justify-between px-4 h-[52px] border-t border-border shrink-0">
        <span className="text-[11px] text-muted">Ctrl + Enter to execute</span>

        <button
          onClick={() => onSubmit(code, language)}
          disabled={isExecuting}
          className="
            flex items-center gap-2 h-[34px] px-5
            bg-primary text-background text-[13px] font-medium
            rounded-lg
            hover:opacity-90
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-opacity duration-150
            cursor-pointer
          "
        >
          {isExecuting ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              <span>Running…</span>
            </>
          ) : (
            <>
              <Play size={14} fill="currentColor" />
              <span>Execute</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export const CodeEditor = memo(CodeEditorInner);

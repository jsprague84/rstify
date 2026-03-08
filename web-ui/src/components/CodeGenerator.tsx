import { useState } from 'react';

interface Props {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

function generatePython({ url, method, headers, body }: Props): string {
  const lines = ['import requests', ''];
  const hasBody = method !== 'GET' && method !== 'DELETE' && body;
  if (Object.keys(headers).length > 0) {
    lines.push('headers = {');
    for (const [k, v] of Object.entries(headers)) lines.push(`    "${k}": "${v}",`);
    lines.push('}');
    lines.push('');
  }
  if (hasBody) {
    lines.push(`data = '''${body}'''`);
    lines.push('');
  }
  const args = [`"${url}"`];
  if (Object.keys(headers).length > 0) args.push('headers=headers');
  if (hasBody) args.push('data=data');
  lines.push(`response = requests.${method.toLowerCase()}(${args.join(', ')})`);
  lines.push('print(response.status_code, response.text)');
  return lines.join('\n');
}

function generateJavaScript({ url, method, headers, body }: Props): string {
  const hasBody = method !== 'GET' && method !== 'DELETE' && body;
  const opts: string[] = [`  method: "${method}"`];
  if (Object.keys(headers).length > 0) {
    opts.push(`  headers: ${JSON.stringify(headers, null, 4).replace(/\n/g, '\n  ')}`);
  }
  if (hasBody) opts.push(`  body: ${JSON.stringify(body)}`);
  return `const response = await fetch("${url}", {\n${opts.join(',\n')}\n});\n\nconst data = await response.text();\nconsole.log(response.status, data);`;
}

function generateGo({ url, method, headers, body }: Props): string {
  const hasBody = method !== 'GET' && method !== 'DELETE' && body;
  const lines = [
    'package main',
    '',
    'import (',
    '    "fmt"',
    '    "io"',
    '    "net/http"',
    ...(hasBody ? ['    "strings"'] : []),
    ')',
    '',
    'func main() {',
  ];
  if (hasBody) {
    lines.push(`    body := strings.NewReader(\`${body}\`)`);
    lines.push(`    req, _ := http.NewRequest("${method}", "${url}", body)`);
  } else {
    lines.push(`    req, _ := http.NewRequest("${method}", "${url}", nil)`);
  }
  for (const [k, v] of Object.entries(headers)) {
    lines.push(`    req.Header.Set("${k}", "${v}")`);
  }
  lines.push('    resp, err := http.DefaultClient.Do(req)');
  lines.push('    if err != nil {');
  lines.push('        panic(err)');
  lines.push('    }');
  lines.push('    defer resp.Body.Close()');
  lines.push('    data, _ := io.ReadAll(resp.Body)');
  lines.push('    fmt.Println(resp.StatusCode, string(data))');
  lines.push('}');
  return lines.join('\n');
}

export default function CodeGenerator(props: Props) {
  const [lang, setLang] = useState<'python' | 'javascript' | 'go'>('python');
  const generators = { python: generatePython, javascript: generateJavaScript, go: generateGo };
  const code = generators[lang](props);

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {(['python', 'javascript', 'go'] as const).map(l => (
          <button key={l} onClick={() => setLang(l)} className={`px-3 py-1 text-xs rounded font-medium ${lang === l ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
            {l === 'python' ? 'Python' : l === 'javascript' ? 'JavaScript' : 'Go'}
          </button>
        ))}
      </div>
      <div className="relative">
        <pre className="bg-gray-900 dark:bg-gray-800 rounded p-3 text-xs text-green-400 max-h-72 overflow-auto whitespace-pre-wrap font-mono">{code}</pre>
        <button
          onClick={() => navigator.clipboard.writeText(code)}
          className="absolute top-2 right-2 text-xs text-gray-400 hover:text-gray-200 bg-gray-800 px-2 py-1 rounded"
        >Copy</button>
      </div>
    </div>
  );
}

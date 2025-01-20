import { useState, useRef, useEffect } from 'react'
import Editor, { Monaco } from "@monaco-editor/react"
import * as monaco from 'monaco-editor'
import * as Diff from 'diff'
import './App.css'

// 定义完整的测试用例类型
interface TestCaseData {
  id: number;
  name: string;
  input: string;
  output: string;
  struct?: string;  // 生成的结构体文本
}

function App() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [diff, setDiff] = useState<string | null>(null)
  const [struct, setStruct] = useState<string | null>(null)
  const [caseCount, setCaseCount] = useState(1)
  const [testCases, setTestCases] = useState<TestCaseData[]>([])
  const [selectedCase, setSelectedCase] = useState<number | null>(null)
  const diffEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const diffResultRef = useRef<DiffResult | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)
  const [editingName, setEditingName] = useState<number | null>(null)

  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
    diffEditorRef.current = editor
    if (diffResultRef.current) {
      applyDecorations(diffResultRef.current.lines)
    }
  }

  const applyDecorations = (diffLines: DiffLine[]) => {
    if (!diffEditorRef.current) return

    const decorations = diffLines.map((line, index) => ({
      range: new monaco.Range(index + 1, 1, index + 1, 1),
      options: {
        isWholeLine: true,
        className: line.type === 'add' ? 'diff-add-line' : 
                  line.type === 'remove' ? 'diff-remove-line' : 
                  undefined,
        linesDecorationsClassName: line.type === 'add' ? 'diff-add-gutter' :
                                 line.type === 'remove' ? 'diff-remove-gutter' :
                                 undefined,
        glyphMarginClassName: line.type === 'add' ? 'diff-add-glyph' :
                            line.type === 'remove' ? 'diff-remove-glyph' :
                            undefined
      }
    }))
    diffEditorRef.current.deltaDecorations([], decorations)
  }

  // 监听输入输出变化，自动更新差异对比
  useEffect(() => {
    if (input || output) {
      const diffResult = compareDiff(input, output)
      setDiff(diffResult.text)
      diffResultRef.current = diffResult

      if (diffEditorRef.current) {
        applyDecorations(diffResult.lines)
      }
    } else {
      setDiff(null)  // 当输入输出都为空时，清空差异对比
    }
  }, [input, output])

  // 自动更新结构体
  useEffect(() => {
    if (input || output) {  // 只要有输入或输出就生成结构体
      const structResult = generateTestStruct(
        input, 
        output, 
        selectedCase ? 
          testCases.find(tc => tc.id === selectedCase)?.name || `testcase${caseCount}` : 
          `testcase${caseCount}`
      )
      setStruct(structResult)
    } else {
      setStruct(null)  // 当输入输出都为空时，清空结构体
    }
  }, [input, output])

  // 添加快捷键处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + S 生成结构
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleGenerateButton()
      }
      // Cmd/Ctrl + D 对比差异
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault()
        if (input || output) {
          const diffResult = compareDiff(input, output)
          setDiff(diffResult.text)
          diffResultRef.current = diffResult
          if (diffEditorRef.current) {
            applyDecorations(diffResult.lines)
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [input, output])

  // 修改生成按钮的处理函数
  const handleGenerateButton = () => {
    if (!input && !output) return  // 如果没有输入输出，不创建测试用例
    
    const newCase: TestCaseData = {
      id: caseCount,
      name: `testcase${caseCount}`,
      input,
      output,
      struct: generateTestStruct(input, output, `testcase${caseCount}`)
    }
    
    setTestCases(prev => [...prev, newCase])
    setCaseCount(prev => prev + 1)
    
    // 清空输入输出框
    setInput('')
    setOutput('')
    setStruct(null)  // 清空结构体预览
  }

  // 修改选择测试用例的处理函数
  const handleSelectCase = (testCase: TestCaseData) => {
    setSelectedCase(testCase.id)
    setInput(testCase.input)
    setOutput(testCase.output)
    // 不需要手动设置 struct，因为 useEffect 会处理
  }

  // 移除更新测试用例的函数和相关的 useEffect，因为现在由新的 useEffect 统一处理
  const handleUpdateCase = () => {
    if (selectedCase === null) return

    setTestCases(prev => prev.map(tc => {
      if (tc.id === selectedCase) {
        return {
          ...tc,
          input,
          output,
          struct: generateTestStruct(input, output, tc.name)
        }
      }
      return tc
    }))
  }

  // 删除测试用例
  const handleDeleteCase = (id: number, e: React.MouseEvent) => {
    e.stopPropagation() // 阻止触发选择事件
    setTestCases(prev => prev.filter(tc => tc.id !== id))
    if (selectedCase === id) {
      setSelectedCase(null)
      setInput('')
      setOutput('')
      setStruct(null)
    }
  }

  // 添加复制功能
  const handleCopy = async () => {
    if (!struct) return
    
    try {
      await navigator.clipboard.writeText(struct)
      setCopySuccess(true)
      
      // 3秒后重置复制状态
      setTimeout(() => {
        setCopySuccess(false)
      }, 3000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  // 添加修改名称的处理函数
  const handleNameEdit = (testCase: TestCaseData, newName: string) => {
    if (newName.trim() === '') return // 不允许空名称
    
    setTestCases(prev => prev.map(tc => {
      if (tc.id === testCase.id) {
        const updatedCase = {
          ...tc,
          name: newName,
          struct: generateTestStruct(tc.input, tc.output, newName)
        }
        // 如果正在编辑这个测试用例，更新预览的结构体
        if (selectedCase === tc.id) {
          setStruct(updatedCase.struct)
        }
        return updatedCase
      }
      return tc
    }))
    setEditingName(null)
  }

  return (
    <div className="app-container">
      <div className="main-content">
        <div className="editors-section">
          <div className="action-buttons">
            <button onClick={handleGenerateButton} className="generate-button">
              保存 <span className="shortcut">⌘S</span>
            </button>
          </div>

          <div className="editors-row">
            <div className="editor-card">
              <div className="editor-header">
                <h2>输入</h2>
              </div>
              <div className="editor-container">
                <Editor
                  height="300px"
                  defaultLanguage="plaintext"
                  value={input}
                  onChange={(value) => setInput(value || '')}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    renderWhitespace: 'all',
                    theme: 'vs-dark',
                    renderLineHighlight: 'none',
                    glyphMargin: true,
                    lineDecorationsWidth: 0,
                    lineNumbersMinChars: 3,
                  }}
                />
              </div>
            </div>
            
            <div className="editor-card">
              <div className="editor-header">
                <h2>输出</h2>
              </div>
              <div className="editor-container">
                <Editor
                  height="300px"
                  defaultLanguage="plaintext"
                  value={output}
                  onChange={(value) => setOutput(value || '')}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    renderWhitespace: 'all',
                    theme: 'vs-dark',
                    renderLineHighlight: 'none',
                    glyphMargin: true,
                    lineDecorationsWidth: 0,
                    lineNumbersMinChars: 3,
                  }}
                />
              </div>
            </div>
          </div>

          {diff && (
            <div className="diff-container">
              <Editor
                height="200px"
                defaultLanguage="plaintext"
                value={diff}
                onMount={handleEditorDidMount}
                theme="vs-dark"
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  renderWhitespace: 'all',
                  glyphMargin: true,
                }}
              />
            </div>
          )}
        </div>

        <div className="preview-section">
          <div className="preview-header">
            <h2>结构体</h2>
            {struct && (
              <button 
                className={`copy-button ${copySuccess ? 'success' : ''}`}
                onClick={handleCopy}
              >
                {copySuccess ? '✓' : '复制'}
              </button>
            )}
          </div>
          <div className="preview-container">
            {struct ? (
              <Editor
                height="200px"
                defaultLanguage="go"
                value={struct}
                theme="vs-dark"
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'off',
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  renderWhitespace: 'all'
                }}
              />
            ) : (
              <h2>输入内容后自动生成</h2>
            )}
          </div>
        </div>

        <div className="testcase-list">
          <div className="testcase-header">
            <h2>用例列表</h2>
      </div>
          {testCases.map((testCase) => (
            <div
              key={testCase.id}
              className={`testcase-item ${selectedCase === testCase.id ? 'selected' : ''}`}
              onClick={() => handleSelectCase(testCase)}
            >
              <div className="testcase-content">
                {editingName === testCase.id ? (
                  <input
                    className="testcase-name-input"
                    type="text"
                    defaultValue={testCase.name}
                    autoFocus
                    onBlur={(e) => handleNameEdit(testCase, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleNameEdit(testCase, e.currentTarget.value)
                      } else if (e.key === 'Escape') {
                        setEditingName(null)
                      }
                    }}
                    onClick={(e) => e.stopPropagation()} // 防止触发选择事件
                  />
                ) : (
                  <span 
                    className="testcase-name"
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      setEditingName(testCase.id)
                    }}
                  >
                    {testCase.name}
                  </span>
                )}
                <button
                  className="delete-button"
                  onClick={(e) => handleDeleteCase(testCase.id, e)}
                >
                  ×
        </button>
              </div>
            </div>
          ))}
          {testCases.length === 0 && (
            <div className="testcase-empty">
              暂无用例
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface DiffLine {
  text: string
  type: 'add' | 'remove' | 'normal'
}

interface DiffResult {
  text: string
  lines: DiffLine[]
}

function compareDiff(input: string, output: string): DiffResult {
  // 如果输入或输出为空，返回空结果
  if (!input && !output) {
    return {
      text: '',
      lines: []
    }
  }

  // 按行分割，保留空行
  const inputLines = input.split('\n')
  const outputLines = output.split('\n')

  // 如果最后一行是空行，移除它
  if (inputLines[inputLines.length - 1] === '') inputLines.pop()
  if (outputLines[outputLines.length - 1] === '') outputLines.pop()

  // 使用 diffArrays 比较差异
  const differences = Diff.diffArrays(inputLines, outputLines)
  
  let resultText = ''
  const diffLines: DiffLine[] = []

  // 处理每个差异部分
  differences.forEach(part => {
    part.value.forEach(line => {
      if (part.added) {
        resultText += line + '\n'
        diffLines.push({
          text: line,
          type: 'add'
        })
      } else if (part.removed) {
        resultText += line + '\n'
        diffLines.push({
          text: line,
          type: 'remove'
        })
      } else {
        resultText += line + '\n'
        diffLines.push({
          text: line,
          type: 'normal'
        })
      }
    })
  })

  // 检查是否有差异
  if (!differences.some(part => part.added || part.removed)) {
    return {
      text: '输入和输出完全相同！',
      lines: [{ text: '输入和输出完全相同！', type: 'normal' }]
    }
  }

  return {
    text: resultText.trim(),
    lines: diffLines
  }
}

interface TestCase {
  name: string;
  input: string;
  want: string;
}

function generateTestStruct(input: string, output: string, caseName: string): string {
  const cleanInput = formatText(input)
  const cleanOutput = formatText(output)

  const testCase: TestCase = {
    name: caseName,
    input: cleanInput,
    want: cleanOutput
  }

  return generateStructText(testCase)
}

function formatText(text: string): string {
  return text
    .trim()
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n') + '\n'
}

function generateStructText(testCase: TestCase): string {
  return `{
    name:  "${testCase.name}",
    input: "${escapeString(testCase.input)}",
    want:  "${escapeString(testCase.want)}",
},`
}

function escapeString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/\r/g, '\\r')
}

export default App

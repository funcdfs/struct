import { useState, useEffect, useRef } from 'react'
import Editor, { DiffEditor } from "@monaco-editor/react"
import './App.css'
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
  const [struct, setStruct] = useState<string | null>(null)
  const [caseCount, setCaseCount] = useState(1)
  const [testCases, setTestCases] = useState<TestCaseData[]>([])
  const [selectedCase, setSelectedCase] = useState<number | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)
  const [editingName, setEditingName] = useState<number | null>(null)
  const [shouldShowDiff, setShouldShowDiff] = useState(false)

  // 自动更新结构体和差异对比
  useEffect(() => {
    if (input || output) {
      // 更新结构体
      const structResult = generateTestStruct(
        input,
        output,
        selectedCase !== null ?
          testCases.find(tc => tc.id === selectedCase)?.name || `testcase${caseCount}` :
          `testcase${caseCount}`
      )
      setStruct(structResult)
    } else {
      setStruct(null)
    }
    
    // 控制是否显示差异对比
    setShouldShowDiff(Boolean(input || output))
  }, [input, output, selectedCase, testCases, caseCount])

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
        setShouldShowDiff(Boolean(input || output))
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

  // 添加复制功能（带可清理的超时）
  const copyTimeoutRef = useRef<number | null>(null)
  const handleCopy = async () => {
    if (!struct) return

    try {
      await navigator.clipboard.writeText(struct)
      setCopySuccess(true)

      // 清理上一次的 timeout
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopySuccess(false)
        copyTimeoutRef.current = null
      }, 3000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  // 组件卸载时清理 timeout
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }
    }
  }, [])

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
                  height="100%"
                  defaultLanguage="plaintext"
                  value={input}
                  onChange={(value: string | undefined) => setInput(value || '')}
                  theme="vs-dark"
                    options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    renderWhitespace: 'all',
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
                  height="100%"
                  defaultLanguage="plaintext"
                  value={output}
                  onChange={(value: string | undefined) => setOutput(value || '')}
                  theme="vs-dark"
                    options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    renderWhitespace: 'all',
                    renderLineHighlight: 'none',
                    glyphMargin: true,
                    lineDecorationsWidth: 0,
                    lineNumbersMinChars: 3,
                  }}
                />
              </div>
            </div>
          </div>

          {shouldShowDiff && (
            <div className="diff-container">
              <DiffEditor
                height="100%"
                language="plaintext"
                original={input}
                modified={output}
                theme="vs-dark"
                options={{
                  renderSideBySide: false,
                  readOnly: true,
                  fontSize: 14,
                  lineHeight: 21,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  renderOverviewRuler: false,
                  diffWordWrap: 'on',
                  ignoreTrimWhitespace: false,
                  renderIndicators: true,
                  originalEditable: false,
                  folding: false,
                }}
              />
            </div>
          )}
        </div>

        <div className="sidebar">
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

              {testCases.map((testCase) => (
                <div
                  key={testCase.id}
                  className={`testcase-item ${selectedCase === testCase.id ? 'selected' : ''}`}
                  onClick={() => handleSelectCase(testCase)}
                >
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
              ))}
              {testCases.length === 0 && (
                <div className="testcase-empty">
                  暂无用例
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
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

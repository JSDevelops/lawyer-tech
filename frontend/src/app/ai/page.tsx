'use client'

import { useState } from 'react'
import { Bot, Send, Loader2, Search, FileText, FilePlus2, Tag, Upload } from 'lucide-react'
import toast from 'react-hot-toast'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

const tabs = [
  { id: 'chat', label: 'AI Chat', icon: Bot },
  { id: 'research', label: 'ค้นหาฎีกา', icon: Search },
  { id: 'summarize', label: 'สรุปคดี', icon: FileText },
  { id: 'draft', label: 'ร่างเอกสาร', icon: FilePlus2 },
]

export default function AiPage() {
  const [activeTab, setActiveTab] = useState('chat')
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'สวัสดีครับ ผมคือ AI ผู้ช่วยกฎหมายของ Lawyer Tech\nผมสามารถช่วยท่านได้ในเรื่อง:\n• ค้นหากฎหมายและฎีกา\n• สรุปข้อเท็จจริงคดี\n• ร่างเอกสารทางกฎหมาย\n• ให้คำแนะนำทั่วไปด้านกฎหมายไทย' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  // Listen to search params for direct tab routing
  useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const tab = params.get('tab')
      if (tab && ['chat', 'research', 'summarize', 'draft'].includes(tab)) {
        setActiveTab(tab)
      }
    }
  })

  // Research
  const [researchQ, setResearchQ] = useState('')
  const [researchResult, setResearchResult] = useState('')
  const [references, setReferences] = useState<any[]>([])

  // Summarize
  const [summarizeText, setSummarizeText] = useState('')
  const [summary, setSummary] = useState('')

  // Draft
  const [draftType, setDraftType] = useState('complaint')
  const [draftClient, setDraftClient] = useState('')
  const [draftDetails, setDraftDetails] = useState('')
  const [draftResult, setDraftResult] = useState('')

  const getHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
  })

  const sendChat = async () => {
    if (!input.trim()) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setLoading(true)
    try {
      const res = await fetch(`${API}/ai/chat`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ message: userMsg })
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'ai', text: data.response || 'ขออภัย ไม่สามารถตอบได้ในขณะนี้' }])
    } catch {
      toast.error('ไม่สามารถเชื่อมต่อ AI ได้')
    } finally {
      setLoading(false)
    }
  }

  const doResearch = async () => {
    if (!researchQ.trim()) return
    setLoading(true)
    setReferences([])
    try {
      const res = await fetch(`${API}/ai/legal-research`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ question: researchQ })
      })
      const data = await res.json()
      setResearchResult(data.research_result || '')
      setReferences(data.references || [])
    } catch { toast.error('เกิดข้อผิดพลาด') }
    finally { setLoading(false) }
  }

  const doSummarize = async () => {
    if (!summarizeText.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`${API}/ai/summarize`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ text: summarizeText, output_format: 'detailed' })
      })
      const data = await res.json()
      setSummary(data.summary || '')
    } catch { toast.error('เกิดข้อผิดพลาด') }
    finally { setLoading(false) }
  }

  const doDraft = async () => {
    if (!draftClient || !draftDetails) return
    setLoading(true)
    try {
      const res = await fetch(`${API}/ai/draft-document`, {
        method: 'POST', headers: getHeaders(),
        body: JSON.stringify({ template_type: draftType, client_name: draftClient, case_details: draftDetails })
      })
      const data = await res.json()
      setDraftResult(data.draft_content || '')
    } catch { toast.error('เกิดข้อผิดพลาด') }
    finally { setLoading(false) }
  }

  return (
    <div className="flex flex-col animate-fade-in" style={{ height: 'calc(100dvh - 56px - 4rem)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-lg lg:text-xl font-bold text-white flex items-center gap-2">
            <span className="w-8 h-8 lg:w-9 lg:h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
              <Bot className="w-4 h-4 lg:w-5 lg:h-5 text-amber-400" />
            </span>
            AI Legal Assistant
          </h1>
          <p className="text-slate-500 text-xs mt-0.5 hidden sm:block">ขับเคลื่อนด้วย Gemini + LangChain RAG</p>
        </div>
        <span className="badge badge-free text-[10px]">⚡ AI Online</span>
      </div>

      {/* Tabs — scrollable on mobile */}
      <div className="flex gap-1 border-b border-white/8 pb-0 overflow-x-auto flex-shrink-0 no-scrollbar">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all -mb-px whitespace-nowrap flex-shrink-0
              ${activeTab === id
                ? 'border-indigo-500 text-indigo-300'
                : 'border-transparent text-slate-500 hover:text-slate-300'}`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {/* Tab Content — takes remaining height */}
      <div className="flex-1 overflow-hidden mt-4">
      {activeTab === 'chat' && (
        <div className="card flex flex-col h-full" style={{ maxHeight: '100%' }}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-3 pb-2 pr-1">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'ai' && (
                  <div className="w-7 h-7 rounded-full bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                    <Bot className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                )}
                <div className={msg.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-ai'}>
                  <p className="whitespace-pre-wrap leading-relaxed text-sm">{msg.text}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="chat-bubble-ai flex items-center gap-2">
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                  <span className="text-slate-400 text-sm">กำลังคิด...</span>
                </div>
              </div>
            )}
          </div>
          {/* Input */}
          <div className="pt-3 border-t border-white/5 flex gap-2 flex-shrink-0">
            <input
              className="input-field flex-1 text-sm"
              placeholder="ถามเรื่องกฎหมาย, วิเคราะห์คดี..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()}
            />
            <button
              onClick={sendChat}
              disabled={loading || !input.trim()}
              className="btn-primary w-11 h-11 p-0 flex-shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'research' && (
        <div className="card space-y-4 overflow-y-auto h-full">
          <div>
            <h3 className="font-semibold text-white text-sm">🔎 ค้นหาฎีกาและกฎหมายที่เกี่ยวข้อง</h3>
            <p className="text-xs text-slate-500 mt-1">AI จะสืบค้นข้อกฎหมาย มาตรา และคำพิพากษาศาลฎีกาโดยอัตโนมัติ</p>
          </div>
          <textarea
            className="input-field h-28 resize-none text-sm"
            placeholder="ตัวอย่าง: กู้ยืมเงินทางไลน์แล้วไม่คืน ไม่มีหลักฐานสัญญา จะฟ้องร้องได้ไหม..."
            value={researchQ}
            onChange={e => setResearchQ(e.target.value)}
          />
          <button onClick={doResearch} disabled={loading} className="btn-primary flex items-center gap-2 text-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            ค้นหาวิเคราะห์ด้วย AI
          </button>
          {researchResult && (
            <div className="space-y-4">
              <div className="glass-lighter rounded-2xl p-4 text-sm text-slate-200 whitespace-pre-wrap leading-relaxed border border-white/5 relative overflow-hidden">
                <h4 className="font-bold text-sm text-indigo-300 mb-3 border-b border-white/10 pb-2">ผลวิเคราะห์คดีความโดย AI</h4>
                {researchResult}
              </div>
              {references && references.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-slate-400 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    ข้อกฎหมายและฎีกาที่อ้างอิง ({references.length} รายการ)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {references.map((ref, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-white/3 border border-white/5 hover:border-amber-500/20 transition-all">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="badge bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">{ref.dika_number}</span>
                          <span className="text-[10px] text-slate-500">{ref.court_level}</span>
                        </div>
                        <h5 className="font-semibold text-xs text-white mb-1 leading-snug">{ref.title}</h5>
                        <p className="text-[11px] text-slate-400 line-clamp-3 leading-relaxed">{ref.content}</p>
                        {ref.source_url && (
                          <a href={ref.source_url} target="_blank" rel="noreferrer"
                            className="text-[10px] text-indigo-400 hover:text-indigo-300 mt-2 block">ลิงก์ต้นฉบับ →</a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'summarize' && (
        <div className="card space-y-4 overflow-y-auto h-full">
          <h3 className="font-semibold text-white text-sm">📝 สรุปข้อเท็จจริงคดีเป็น 1 หน้า</h3>
          <textarea
            className="input-field h-36 resize-none text-sm"
            placeholder="วางข้อเท็จจริงหรือเนื้อหาคดีที่ต้องการให้ AI สรุป..."
            value={summarizeText}
            onChange={e => setSummarizeText(e.target.value)}
          />
          <button onClick={doSummarize} disabled={loading} className="btn-primary flex items-center gap-2 text-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            สรุปคดี
          </button>
          {summary && (
            <div className="glass-lighter rounded-xl p-4 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
              {summary}
            </div>
          )}
        </div>
      )}

      {activeTab === 'draft' && (
        <div className="card space-y-4 overflow-y-auto h-full">
          <h3 className="font-semibold text-white text-sm">📃 ร่างเอกสารทางกฎหมาย</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">ประเภทเอกสาร</label>
              <select className="input-field text-sm" value={draftType} onChange={e => setDraftType(e.target.value)}>
                <option value="complaint">คำฟ้อง</option>
                <option value="contract">สัญญา</option>
                <option value="power_of_attorney">หนังสือมอบอำนาจ</option>
                <option value="demand_letter">จดหมายทวงถาม</option>
                <option value="appeal">คำอุทธรณ์</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">ชื่อลูกความ</label>
              <input className="input-field text-sm" placeholder="นาย/นาง/นางสาว..." value={draftClient} onChange={e => setDraftClient(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">รายละเอียดคดี</label>
            <textarea
              className="input-field h-28 resize-none text-sm"
              placeholder="อธิบายข้อเท็จจริง ประเด็น และสิ่งที่ต้องการในเอกสาร..."
              value={draftDetails}
              onChange={e => setDraftDetails(e.target.value)}
            />
          </div>
          <button onClick={doDraft} disabled={loading} className="btn-primary flex items-center gap-2 text-sm">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FilePlus2 className="w-4 h-4" />}
            ร่างเอกสาร
          </button>
          {draftResult && (
            <div className="glass-lighter rounded-xl p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[11px] text-amber-400 font-medium">⚠️ ร่างเบื้องต้น — ต้องผ่านการตรวจสอบจากทนายก่อนใช้งาน</span>
                <button
                  onClick={() => navigator.clipboard.writeText(draftResult).then(() => toast.success('คัดลอกแล้ว'))}
                  className="text-xs text-indigo-400 hover:text-indigo-300"
                >
                  คัดลอก
                </button>
              </div>
              <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{draftResult}</div>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  )
}

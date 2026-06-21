'use client'

import { useState, useRef, useEffect } from 'react'

const generateHandwrittenImage = async (text: string): Promise<string> => {
    await document.fonts.ready;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const width = 600;
    const x = 40;
    const maxWidth = width - (x * 2);
    
    ctx.font = '24px Caveat';
    
    const paragraphs = text.split('\n');
    let totalHeight = 40;
    
    // Calculate height
    for (const p of paragraphs) {
        const words = p.split(' ');
        let line = '';
        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            if (ctx.measureText(testLine).width > maxWidth && n > 0) {
                line = words[n] + ' ';
                totalHeight += 30;
            } else {
                line = testLine;
            }
        }
        totalHeight += 40; // extra space for paragraph
    }

    canvas.width = width;
    canvas.height = Math.max(totalHeight + 40, 400); // minimum 400px

    // Draw background
    ctx.fillStyle = '#fdfbf7';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw lines
    ctx.strokeStyle = '#e0dcd3';
    ctx.lineWidth = 1;
    for(let i=30; i<canvas.height; i+=30) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
    }

    // Draw text
    ctx.fillStyle = '#111827';
    ctx.font = '26px Caveat';
    let y = 40;
    
    for (const p of paragraphs) {
        if (!p.trim()) { y += 20; continue; }
        const words = p.split(' ');
        let line = '';
        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            if (ctx.measureText(testLine).width > maxWidth && n > 0) {
                ctx.fillText(line, x, y);
                line = words[n] + ' ';
                y += 30;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, x, y);
        y += 40;
    }

    return canvas.toDataURL('image/png');
}

export default function AITab() {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', content: string, image?: string }[]>([
    { role: 'ai', content: 'Hi there! I am your scheduling assistant. You can ask me about anyone\'s timetable, upload a PDF for me to read, or ask general app queries.' }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (file.size > 3 * 1024 * 1024) {
        alert('File size must be under 3MB.')
        return
      }
      setAttachedFile(file)
    }
  }

  const handleSend = async () => {
    if (!input.trim() && !attachedFile) return

    const userMessage = input.trim()
    setInput('')
    
    let fileBase64 = ''
    let mimeType = ''
    let uiMessage = userMessage

    if (attachedFile) {
        uiMessage = `📎 [${attachedFile.name}] ${userMessage}`
        mimeType = attachedFile.type
        
        // Convert to base64 using FileReader
        const reader = new FileReader()
        const base64Promise = new Promise<string>((resolve) => {
            reader.onload = () => {
                const result = reader.result as string
                // Extract base64 part
                const base64 = result.split(',')[1]
                resolve(base64)
            }
        })
        reader.readAsDataURL(attachedFile)
        fileBase64 = await base64Promise
        
        setAttachedFile(null)
    }

    setMessages(prev => [...prev, { role: 'user', content: uiMessage }])
    setIsLoading(true)

    try {
      const payload: any = { prompt: userMessage || 'Summarize this document.' }
      if (fileBase64) {
          payload.fileBase64 = fileBase64
          payload.mimeType = mimeType
      }

      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()

      if (res.ok) {
        if (data.type === 'handwritten_notes') {
            const imgDataUrl = await generateHandwrittenImage(data.reply)
            setMessages(prev => [...prev, { role: 'ai', content: 'Here are the handwritten notes based on your document:', image: imgDataUrl }])
        } else {
            setMessages(prev => [...prev, { role: 'ai', content: data.reply }])
        }
      } else {
        setMessages(prev => [...prev, { role: 'ai', content: `Error: ${data.reply || data.error}` }])
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', content: 'Failed to connect to AI.' }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)' }}>
      <div style={{ marginBottom: '16px' }}>
        <h1 className="page-title" style={{ marginBottom: '8px' }}>AI Assistant</h1>
        <p className="page-subtitle">Ask me about schedules, classes, or upload a document to get handwritten notes.</p>
      </div>

      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        background: 'var(--bg-card)', 
        borderRadius: 'var(--radius-xl)', 
        border: '1px solid var(--border-subtle)', 
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ 
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            background: msg.role === 'user' ? 'var(--accent-primary)' : 'var(--bg-body)',
            color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
            padding: '12px 16px',
            borderRadius: '16px',
            borderBottomRightRadius: msg.role === 'user' ? '4px' : '16px',
            borderBottomLeftRadius: msg.role === 'ai' ? '4px' : '16px',
            maxWidth: '85%',
            lineHeight: 1.5,
            fontSize: '14px',
            border: msg.role === 'ai' ? '1px solid var(--border-subtle)' : 'none',
            whiteSpace: 'pre-wrap',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <span>{msg.content}</span>
            {msg.image && (
                <img 
                    src={msg.image} 
                    alt="Handwritten Notes" 
                    style={{ 
                        width: '100%', 
                        maxWidth: '400px', 
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }} 
                />
            )}
          </div>
        ))}
        {isLoading && (
          <div style={{ 
            alignSelf: 'flex-start',
            background: 'var(--bg-body)',
            padding: '12px 16px',
            borderRadius: '16px',
            borderBottomLeftRadius: '4px',
            border: '1px solid var(--border-subtle)',
            fontSize: '14px'
          }}>
            <div className="spinner" style={{ display: 'inline-block', width: '16px', height: '16px', borderWidth: '2px', marginRight: '8px', verticalAlign: 'middle' }} />
            Thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
        {attachedFile && (
            <div style={{ 
                alignSelf: 'flex-start', 
                background: 'var(--bg-card)', 
                border: '1px solid var(--accent-primary)', 
                color: 'var(--accent-primary)',
                padding: '4px 12px', 
                borderRadius: '100px',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
            }}>
                📎 {attachedFile.name}
                <button 
                    onClick={() => setAttachedFile(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-primary)', fontWeight: 'bold' }}
                >
                    ✕
                </button>
            </div>
        )}
        <div style={{ display: 'flex', gap: '8px' }}>
            <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                accept="application/pdf,image/*"
                onChange={handleFileChange}
            />
            <button 
                onClick={() => fileInputRef.current?.click()}
                style={{
                    background: 'var(--bg-card)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '0 16px',
                    fontSize: '20px',
                    cursor: 'pointer',
                    transition: '0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
                title="Attach Document"
            >
                📎
            </button>
            <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask a question or upload a document..."
                style={{
                    flex: 1,
                    padding: '16px',
                    borderRadius: 'var(--radius-xl)',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    fontSize: '15px'
                }}
            />
            <button 
                onClick={handleSend}
                disabled={isLoading || (!input.trim() && !attachedFile)}
                style={{
                    background: 'var(--accent-primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-xl)',
                    padding: '0 24px',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: isLoading || (!input.trim() && !attachedFile) ? 'not-allowed' : 'pointer',
                    opacity: isLoading || (!input.trim() && !attachedFile) ? 0.7 : 1,
                    transition: '0.2s'
                }}
            >
                Send
            </button>
        </div>
      </div>
    </div>
  )
}

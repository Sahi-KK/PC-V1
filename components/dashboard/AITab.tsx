'use client'

import { useState, useRef, useEffect } from 'react'

const generateHandwrittenImage = async (text: string): Promise<string> => {
    // Load Caveat font for handwriting
    await document.fonts.load('48px "Caveat"');
    await document.fonts.ready;

    // A4 dimensions at 150 DPI
    const width = 1240;
    const height = 1754;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // 1. Scanned Paper Background
    // Scanners usually overexpose, so mostly pure white with very subtle off-white unevenness
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    // Add subtle scanner noise / uneven brightness
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, 'rgba(250, 250, 250, 1)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(1, 'rgba(245, 248, 250, 1)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // 2. Global Scanner Skew
    // Scanned documents are rarely perfectly aligned
    ctx.translate(width / 2, height / 2);
    ctx.rotate(-0.005); // Very slight global rotation
    ctx.translate(-width / 2, -height / 2);

    // 3. Text Layout and Fitting
    const marginL = 120;
    const marginR = 120;
    const marginT = 150;
    const marginB = 150;
    
    let fontSize = 48;
    let baseLineHeight = 65;
    const paragraphs = text.split('\n');

    let willFit = false;
    while (!willFit && fontSize > 20) {
        let estimatedY = marginT;
        ctx.font = `${fontSize}px "Caveat"`;
        
        for (const p of paragraphs) {
            if (!p.trim()) { estimatedY += baseLineHeight; continue; }
            const words = p.split(/\s+/);
            let currentX = marginL;
            for (let i = 0; i < words.length; i++) {
                const wordWidth = ctx.measureText(words[i] + ' ').width;
                if (currentX + wordWidth > width - marginR && currentX > marginL) {
                    currentX = marginL;
                    estimatedY += baseLineHeight;
                }
                currentX += wordWidth + (fontSize * 0.2);
            }
            estimatedY += baseLineHeight + 15;
        }
        
        if (estimatedY < height - marginB) {
            willFit = true;
        } else {
            fontSize -= 2;
            baseLineHeight = fontSize * 1.35;
        }
    }

    // 4. Draw Handwriting Word-by-Word
    let y = marginT;
    ctx.textBaseline = 'alphabetic';

    for (const p of paragraphs) {
        if (!p.trim()) {
            y += baseLineHeight;
            continue;
        }

        const words = p.split(/\s+/);
        let x = marginL + (Math.random() * 20); // Uneven paragraph start
        
        // Lines on unruled paper naturally drift up or down
        let lineAngle = (Math.random() * 0.6 - 0.3) * (Math.PI / 180);
        let lineDriftY = 0;
        
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            ctx.font = `${fontSize}px "Caveat"`;
            const wordWidth = ctx.measureText(word + ' ').width;

            if (x + wordWidth > width - marginR && x > marginL + 50) {
                // Wrap to next line
                y += baseLineHeight + (Math.random() * 6 - 3);
                x = marginL + (Math.random() * 15);
                lineAngle = (Math.random() * 0.6 - 0.3) * (Math.PI / 180);
                lineDriftY = 0;
            }

            ctx.save();
            // Jitter position to break perfect baseline
            const currentY = y + lineDriftY + (Math.random() * 2 - 1);
            ctx.translate(x, currentY);
            
            // Jitter rotation slightly per word
            const wordAngle = lineAngle + (Math.random() * 0.4 - 0.2) * (Math.PI / 180);
            ctx.rotate(wordAngle);
            
            // Subtle distortion for human inconsistency
            const scaleX = 1 + (Math.random() * 0.04 - 0.02);
            const scaleY = 1 + (Math.random() * 0.04 - 0.02);
            ctx.scale(scaleX, scaleY);

            // Dark, high-contrast scanner blue ink
            ctx.fillStyle = `rgba(15, 25, 110, 0.95)`;
            ctx.fillText(word, 0, 0);

            // Simulate ink density/pressure variations
            if (Math.random() > 0.5) {
                ctx.fillStyle = `rgba(5, 10, 70, 0.4)`;
                ctx.fillText(word, 0.5, 0.5);
            }

            ctx.restore();

            x += (wordWidth * scaleX) + (fontSize * 0.25) + (Math.random() * 4 - 2);
            lineDriftY += (Math.random() * 1.0 - 0.5);
        }
        y += baseLineHeight + 20; // Paragraph spacing
    }

    // JPEG export adds natural scanner-like compression artifacts
    return canvas.toDataURL('image/jpeg', 0.90);
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

  const handleSend = async (overrideMessage?: string) => {
    const userMessage = overrideMessage || input.trim()
    if (!userMessage && !attachedFile) return

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
            setMessages(prev => [...prev, { role: 'ai', content: 'Here is the generated Decision Sheet:', image: imgDataUrl }])
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
        <p className="page-subtitle" style={{ marginBottom: '12px' }}>Ask me about schedules, classes, or upload a document to get handwritten notes.</p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {["What classes do I have today?", "Show my schedule for this week", "What is Sweta's schedule tomorrow?", "How is my attendance in CV?", "Who teaches GBS?", "What classes are happening on July 10?"].map(q => (
            <button
              key={q}
              onClick={() => { setInput(q); handleSend(q); }}
              style={{
                background: 'var(--bg-body)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '100px',
                padding: '6px 12px',
                fontSize: '13px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: '0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
            >
              {q}
            </button>
          ))}
        </div>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                    <img 
                        src={msg.image} 
                        alt="Decision Sheet Scanned Copy" 
                        onClick={() => {
                            const w = window.open();
                            w?.document.write(`<html><body style="margin:0; background:#f0f0f0; display:flex; justify-content:center; align-items:center; min-height:100vh;"><img src="${msg.image}" style="max-height: 95vh; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" /></body></html>`);
                        }}
                        style={{ 
                            width: '100%', 
                            maxWidth: '700px', 
                            borderRadius: '2px', // Scanned pages have sharp corners
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                            cursor: 'zoom-in',
                            border: '1px solid #e0e0e0'
                        }} 
                    />
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Click image to view full scanned A4 sheet</span>
                </div>
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
                onClick={() => handleSend()}
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

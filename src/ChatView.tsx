import { useState, useRef, useEffect } from 'react';
import type { Conversation, ChatMessage } from './types';
import { fileToContentPart } from './api';
import ReactMarkdown from 'react-markdown';

interface Props {
  conversation: Conversation;
  streaming: boolean;
  onSend: (content: string | ChatMessage['content']) => void;
  onStop: () => void;
}

export default function ChatView({ conversation, streaming, onSend, onStop }: Props) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation.messages, streaming]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if ((!input.trim() && attachments.length === 0) || streaming) return;

    if (attachments.length > 0) {
      const parts = await Promise.all(attachments.map(f => fileToContentPart(f)));
      onSend([{ type: 'text', text: input }, ...parts]);
      setAttachments([]);
    } else {
      onSend(input);
    }
    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    setAttachments(prev => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeAttachment(idx: number) {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  }

  const visibleMessages = conversation.messages.filter(m => {
    if (m.role === 'system') return false;
    if (m.role === 'assistant' && !m.content) return false;
    if (typeof m.content === 'string') return m.content.trim().length > 0;
    return true;
  });

  const showPlaceholder = visibleMessages.length === 0;

  return (
    <div className="flex flex-col h-full">
      <div className={`flex-1 overflow-y-auto px-3 sm:px-4 py-4 ${showPlaceholder ? 'flex items-center justify-center' : ''}`}>
        {showPlaceholder ? (
          <div className="text-center px-6 -mt-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl gradient-border bg-glass mb-6">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="url(#gradient)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-zinc-300 mb-1">Ask anything</h2>
            <p className="text-sm text-zinc-500 max-w-[240px] mx-auto">
              Chat with AI models. Upload images, customize settings, switch providers.
            </p>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-4 md:space-y-5">
            {visibleMessages.map((msg, i) => {
              const isUser = msg.role === 'user';
              const content = typeof msg.content === 'string' ? msg.content : (
                msg.content
                  .filter((p: { type: string }) => p.type === 'text')
                  .map((p: { type: string; text?: string }) => p.text || '')
                  .join('')
              );
              const images = typeof msg.content !== 'string'
                ? msg.content.filter((p: { type: string }) => p.type === 'image_url')
                : [];

              return (
                <div key={i} className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    isUser
                      ? 'bg-white/10'
                      : 'bg-white/5 border border-white/[0.06]'
                  }`}>
                    {isUser ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                      </svg>
                    )}
                  </div>

                  <div className={`flex-1 min-w-0 ${isUser ? 'flex flex-col items-end' : ''}`}>
                    {images.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {images.map((img: { type: string; image_url?: { url: string } }, idx: number) => (
                          <img
                            key={idx}
                            src={img.image_url?.url}
                            alt="attachment"
                            className="max-w-[160px] max-h-[160px] rounded-xl object-cover border border-white/[0.06]"
                          />
                        ))}
                      </div>
                    )}
                    <div
                      className={`inline-block max-w-full rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed break-words ${
                        isUser
                          ? 'bg-message-user text-white rounded-br-md'
                          : 'bg-message-ai text-zinc-200 rounded-bl-md markdown'
                      }`}
                    >
                      {isUser ? (
                        <div className="whitespace-pre-wrap">{content}</div>
                      ) : (
                        <ReactMarkdown>{content}</ReactMarkdown>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {streaming && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-white/5 border border-white/[0.06] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                </div>
                <div className="flex items-center gap-1.5 bg-message-ai rounded-2xl rounded-bl-md px-3.5 py-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {attachments.length > 0 && (
        <div className="flex gap-2 px-4 pb-2 flex-wrap max-w-2xl mx-auto w-full">
          {attachments.map((file, idx) => (
            <div key={idx} className="relative group">
              {file.type.startsWith('image/') ? (
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="h-16 w-16 object-cover rounded-xl border border-white/[0.06]"
                />
              ) : (
                <div className="h-16 px-3 flex items-center bg-white/[0.04] rounded-xl border border-white/[0.06] text-xs text-zinc-400 max-w-[120px] truncate">
                  {file.name}
                </div>
              )}
              <button
                onClick={() => removeAttachment(idx)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500/90 backdrop-blur rounded-full text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="p-3 pb-[calc(0.75rem+var(--safe-bottom))]">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
          <div className="flex gap-2 items-end bg-input rounded-2xl p-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] active:scale-90 transition-all"
              title="Attach image"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message..."
              rows={1}
              className="flex-1 bg-transparent border-none text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none resize-none py-2 min-h-[20px] max-h-[120px]"
            />
            {streaming ? (
              <button
                type="button"
                onClick={onStop}
                className="h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 active:scale-90 transition-all border border-red-500/20"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="4" width="16" height="16" rx="3" />
                </svg>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() && attachments.length === 0}
                className="h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-xl btn-accent disabled:opacity-30 disabled:shadow-none disabled:bg-white/[0.08] transition-all"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

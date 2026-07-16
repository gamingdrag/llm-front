import type { Conversation } from './types';

interface Props {
  conversations: Conversation[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export default function Sidebar({ conversations, activeId, onSelect, onNew, onDelete, isOpen, onToggle }: Props) {
  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <>
      {!isOpen && (
        <div className="flex items-center gap-3">
          <button
            onClick={onToggle}
            className="h-10 w-10 flex items-center justify-center bg-glass rounded-xl text-zinc-400 active:text-white active:scale-95 transition-all"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <h1 className="text-sm font-semibold text-zinc-200 truncate max-w-[160px]">
            LLM Chat
          </h1>
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-start md:justify-start">
          <div
            onClick={onToggle}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
          />

          <div className="relative w-full md:w-72 max-h-[85vh] md:max-h-full md:h-full bg-[#0a0a0f]/95 backdrop-blur-3xl border border-white/[0.06] rounded-t-3xl md:rounded-none md:rounded-r-2xl animate-slide-up md:animate-fade-in flex flex-col shadow-2xl shadow-black/40">
            <div className="flex items-center justify-center pt-3 pb-1 md:hidden">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            <div className="flex items-center justify-between px-5 py-3">
              <h2 className="text-sm font-semibold text-zinc-300">Conversations</h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={onNew}
                  className="h-8 w-8 flex items-center justify-center btn-glass rounded-lg text-zinc-400 active:text-white active:scale-90 transition-all"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
                <button
                  onClick={onToggle}
                  className="h-8 w-8 flex items-center justify-center btn-glass rounded-lg text-zinc-400 active:text-white active:scale-90 transition-all"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-6">
              {sorted.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-zinc-600">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="mb-3 opacity-40">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <p className="text-xs">No conversations yet</p>
                </div>
              )}
              {sorted.map(conv => {
                const isActive = conv.id === activeId;
                const isNew = conv.title === 'New chat' && conv.messages.filter(m => m.role !== 'system').length === 0;
                return (
                  <div
                    key={conv.id}
                    onClick={() => onSelect(conv.id)}
                    className={`group flex items-center gap-2.5 px-3 py-3 mx-1 rounded-xl cursor-pointer transition-all duration-150 active:scale-[0.98] ${
                      isActive
                        ? 'bg-white/[0.06] border border-white/[0.08]'
                        : 'border border-transparent hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isActive ? 'bg-white/10' : 'bg-white/[0.04]'
                    }`}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        className={isActive ? 'text-zinc-300' : 'text-zinc-500'}
                      >
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <span className={`flex-1 truncate text-sm leading-tight ${
                      isActive ? 'text-zinc-200 font-medium' : 'text-zinc-400'
                    }`}>
                      {isNew ? 'New chat' : conv.title}
                    </span>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onDelete(conv.id);
                      }}
                      className="h-6 w-6 flex items-center justify-center rounded-md text-zinc-600 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="px-5 py-3 border-t border-white/[0.04]">
              <button
                onClick={() => { onNew(); }}
                className="w-full btn-accent rounded-xl py-2.5 text-sm font-medium text-white flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                New Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

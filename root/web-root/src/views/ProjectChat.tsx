import React, { useCallback, useEffect, useRef, useState } from 'react';

const GATEWAY = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const WS_GATEWAY = import.meta.env.VITE_CHAT_WS_URL || 'ws://localhost:4003';

interface Attachment { fileKey: string; fileName: string; mimeType: string; fileSize: number; url?: string; }
interface ChatMessage { messageId: string; channelId: string; projectId: string; createdAt: string; content: string; senderId: string; senderName: string; mentions: string[]; attachments: Attachment[]; parentMessageId?: string; }
interface Channel { channelId: string; name: string; description?: string; isDefault: boolean; }
interface Props { projectId: string; user: { id: string; fullName: string; category: string }; token: string; teamMembers: { userId: string; name?: string }[]; }

const channelCreators = ['C_SUITE', 'SVP', 'VP', 'SENIOR_MANAGER', 'MANAGER', 'TEAM_LEAD'];

function formatTime(iso: string) { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
function formatDate(iso: string) {
  const date = new Date(iso); const today = new Date(); const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
function fileSize(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
function initials(name: string) { return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?'; }
function renderContent(content: string) {
  return content.split(/(@\[[^\]]+\])/g).map((part, index) => {
    const match = part.match(/^@\[([^\]:]+):([^\]]+)\]$/);
    return match ? <span className="project-chat__mention" key={index}>@{match[1]}</span> : <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

export function ProjectChat({ projectId, user, token, teamMembers }: Props) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [threadParent, setThreadParent] = useState<ChatMessage | null>(null);
  const [newChannelName, setNewChannelName] = useState('');
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [socketStatus, setSocketStatus] = useState<'connecting' | 'connected' | 'offline'>('connecting');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeChannelRef = useRef<string | undefined>();
  const canCreateChannel = channelCreators.includes(user.category);
  const authHeader = { Authorization: `Bearer ${token}` };

  useEffect(() => { activeChannelRef.current = activeChannel?.channelId; }, [activeChannel]);

  useEffect(() => {
    let cancelled = false;
    setLoadingChannels(true); setConnectionError(false);
    fetch(`${GATEWAY}/chat/${projectId}/channels`, { headers: authHeader })
      .then(response => { if (!response.ok) throw new Error('Chat service unavailable'); return response.json() as Promise<Channel[]>; })
      .then(data => { if (!cancelled) { setChannels(data); setActiveChannel(current => data.find(c => c.channelId === current?.channelId) || data[0] || null); } })
      .catch(() => { if (!cancelled) setConnectionError(true); })
      .finally(() => { if (!cancelled) setLoadingChannels(false); });
    return () => { cancelled = true; };
  }, [projectId, token, reloadKey]);

  useEffect(() => {
    if (!activeChannel) return;
    let cancelled = false;
    setLoadingMessages(true); setMessages([]); setThreadParent(null);
    fetch(`${GATEWAY}/chat/${projectId}/channels/${encodeURIComponent(activeChannel.channelId)}/messages`, { headers: authHeader })
      .then(response => { if (!response.ok) throw new Error('Unable to load messages'); return response.json() as Promise<ChatMessage[]>; })
      .then(data => { if (!cancelled) setMessages(data); })
      .catch(() => { if (!cancelled) setMessages([]); })
      .finally(() => { if (!cancelled) setLoadingMessages(false); });
    return () => { cancelled = true; };
  }, [activeChannel?.channelId, projectId, token]);

  useEffect(() => {
    if (connectionError) return;
    let disposed = false;
    const connect = () => {
      if (disposed) return;
      setSocketStatus('connecting');
      // The service authenticates the WebSocket from its query string.
      const url = `${WS_GATEWAY}?projectId=${encodeURIComponent(projectId)}&token=${encodeURIComponent(token)}`;
      const socket = new WebSocket(url);
      wsRef.current = socket;
      socket.onopen = () => { if (!disposed) setSocketStatus('connected'); };
      socket.onmessage = event => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'NEW_MESSAGE' && data.message.channelId === activeChannelRef.current) {
            setMessages(previous => previous.some(message => message.messageId === data.message.messageId) ? previous : [...previous, data.message]);
          }
        } catch { /* Ignore malformed socket events. */ }
      };
      socket.onclose = () => {
        if (disposed) return;
        setSocketStatus('offline');
        reconnectRef.current = window.setTimeout(connect, 3000);
      };
      socket.onerror = () => socket.close();
    };
    connect();
    return () => {
      disposed = true;
      if (reconnectRef.current) window.clearTimeout(reconnectRef.current);
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); wsRef.current = null; }
    };
  }, [projectId, token, connectionError]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages]);

  const filteredMembers = teamMembers.filter(member => (member.name || member.userId).toLowerCase().includes(mentionQuery)).slice(0, 6);
  const insertMention = (member: { userId: string; name?: string }) => {
    const cursor = inputRef.current?.selectionStart || input.length;
    setInput(`${input.slice(0, cursor).replace(/@\w*$/, '')}@[${member.name || member.userId}:${member.userId}] ${input.slice(cursor)}`);
    setShowMentions(false); requestAnimationFrame(() => inputRef.current?.focus());
  };
  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value; setInput(value);
    const mention = value.slice(0, event.target.selectionStart || 0).match(/@(\w*)$/);
    setShowMentions(Boolean(mention)); setMentionQuery(mention?.[1].toLowerCase() || ''); setMentionIndex(0);
  };
  const sendMessage = useCallback(() => {
    if (!input.trim() || !activeChannel || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ action: 'sendMessage', channelId: activeChannel.channelId, projectId, senderId: user.id, senderName: user.fullName, content: input.trim(), parentMessageId: threadParent?.messageId }));
    setInput(''); setThreadParent(null); setShowMentions(false);
  }, [activeChannel, input, projectId, threadParent, user]);
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions) {
      if (event.key === 'ArrowDown') { event.preventDefault(); setMentionIndex(i => Math.min(i + 1, filteredMembers.length - 1)); return; }
      if (event.key === 'ArrowUp') { event.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); return; }
      if ((event.key === 'Enter' || event.key === 'Tab') && filteredMembers[mentionIndex]) { event.preventDefault(); insertMention(filteredMembers[mentionIndex]); return; }
      if (event.key === 'Escape') { setShowMentions(false); return; }
    }
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); }
  };
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file || !activeChannel) return;
    setUploading(true);
    try {
      const response = await fetch(`${GATEWAY}/chat/upload-url`, { method: 'POST', headers: { ...authHeader, 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: file.name, mimeType: file.type || 'application/octet-stream', projectId }) });
      if (!response.ok) throw new Error('Unable to prepare upload');
      const { uploadUrl, fileKey, publicUrl } = await response.json();
      const uploaded = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } });
      if (!uploaded.ok || wsRef.current?.readyState !== WebSocket.OPEN) throw new Error('Unable to send attachment');
      wsRef.current.send(JSON.stringify({ action: 'sendMessage', channelId: activeChannel.channelId, projectId, senderId: user.id, senderName: user.fullName, content: input.trim() || `📎 ${file.name}`, attachments: [{ fileKey, fileName: file.name, mimeType: file.type || 'application/octet-stream', fileSize: file.size, url: publicUrl }] }));
      setInput('');
    } catch (error) { console.error('Upload failed', error); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };
  const createChannel = async () => {
    const name = newChannelName.trim(); if (!name) return;
    try {
      const response = await fetch(`${GATEWAY}/chat/${projectId}/channels`, { method: 'POST', headers: { ...authHeader, 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      if (!response.ok) throw new Error('Unable to create channel');
      const channel = await response.json() as Channel; setChannels(previous => [...previous, channel]); setActiveChannel(channel); setNewChannelName(''); setShowNewChannel(false);
    } catch (error) { console.error('Create channel failed', error); }
  };
  const grouped = messages.reduce<{ date: string; msgs: ChatMessage[] }[]>((groups, message) => {
    const date = formatDate(message.createdAt); const last = groups.at(-1);
    if (last?.date === date) last.msgs.push(message); else groups.push({ date, msgs: [message] }); return groups;
  }, []);

  if (connectionError) return <div className="project-chat project-chat__unavailable"><div><div className="project-chat__empty-icon">◫</div><h3>Chat is unavailable</h3><p>The chat service is not responding right now. Please try again.</p><button className="project-chat__primary" onClick={() => { setConnectionError(false); setReloadKey(key => key + 1); }}>Retry chat</button></div></div>;

  return <div className="project-chat">
    <style>{chatStyles}</style>
    <aside className="project-chat__sidebar" aria-label="Project channels">
      <div className="project-chat__side-header"><span>Project conversations</span><span className={`project-chat__status project-chat__status--${socketStatus}`} title={`Chat is ${socketStatus}`}>{socketStatus === 'connected' ? 'Live' : socketStatus === 'connecting' ? 'Connecting' : 'Reconnecting'}</span></div>
      <div className="project-chat__channel-label">Channels</div>
      <nav className="project-chat__channels">{loadingChannels ? <div className="project-chat__loading">Loading channels…</div> : channels.map(channel => <button key={channel.channelId} className={`project-chat__channel ${activeChannel?.channelId === channel.channelId ? 'is-active' : ''}`} onClick={() => setActiveChannel(channel)}><span>#</span><span>{channel.name}</span>{channel.isDefault && <i>default</i>}</button>)}</nav>
      {canCreateChannel && <div className="project-chat__new-channel">{showNewChannel ? <><input aria-label="New channel name" value={newChannelName} onChange={event => setNewChannelName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') createChannel(); if (event.key === 'Escape') setShowNewChannel(false); }} placeholder="e.g. design-review" autoFocus /><button className="project-chat__primary" onClick={createChannel}>Create</button></> : <button className="project-chat__add-channel" onClick={() => setShowNewChannel(true)}>＋ New channel</button>}</div>}
    </aside>
    <main className="project-chat__main">
      <header className="project-chat__header"><div><h2><span>#</span>{activeChannel?.name || 'Select a channel'}</h2><p>{activeChannel?.description || 'Share updates, questions, and files with your project team.'}</p></div><div className={`project-chat__header-status project-chat__header-status--${socketStatus}`}><span />{socketStatus === 'connected' ? 'Connected' : socketStatus === 'connecting' ? 'Connecting' : 'Reconnecting'}</div></header>
      {threadParent && <div className="project-chat__replying"><span>Replying to <strong>{threadParent.senderName}</strong><small>{threadParent.content}</small></span><button onClick={() => setThreadParent(null)} aria-label="Cancel reply">×</button></div>}
      <section className="project-chat__messages" aria-live="polite">{loadingMessages ? <div className="project-chat__empty"><div className="project-chat__spinner" />Loading conversation…</div> : grouped.length === 0 ? <div className="project-chat__empty"><div className="project-chat__empty-icon">✦</div><strong>Start the conversation</strong><span>Send a message to keep everyone in sync.</span></div> : grouped.map(({ date, msgs }) => <div key={date}><div className="project-chat__date"><span />{date}<span /></div>{msgs.map((message, index) => { const previous = msgs[index - 1]; const compact = previous?.senderId === message.senderId && new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() < 5 * 60 * 1000; const own = message.senderId === user.id; return <article key={message.messageId} className={`project-chat__message ${compact ? 'is-compact' : ''}`}><div className={`project-chat__avatar ${own ? 'is-own' : ''}`}>{!compact && initials(message.senderName)}</div><div className="project-chat__message-body">{!compact && <div className="project-chat__message-meta"><strong>{message.senderName}</strong><time>{formatTime(message.createdAt)}</time>{own && <em>You</em>}</div>}<div className="project-chat__content">{renderContent(message.content)}</div>{message.attachments?.map(attachment => <a className="project-chat__attachment" href={attachment.url} target="_blank" rel="noreferrer" key={attachment.fileKey}><span>{attachment.mimeType.startsWith('image/') ? '▧' : '↗'}</span><div><strong>{attachment.fileName}</strong><small>{fileSize(attachment.fileSize)}</small></div></a>)}</div><button className="project-chat__reply" onClick={() => setThreadParent(message)}>↩ Reply</button></article>; })}</div>)}<div ref={messagesEndRef} /></section>
      <footer className="project-chat__composer">{showMentions && filteredMembers.length > 0 && <div className="project-chat__mentions">{filteredMembers.map((member, index) => <button key={member.userId} className={index === mentionIndex ? 'is-selected' : ''} onClick={() => insertMention(member)}><b>{initials(member.name || member.userId)}</b>{member.name || member.userId}</button>)}</div>}<div className="project-chat__input-wrap"><button className="project-chat__attach" onClick={() => fileInputRef.current?.click()} disabled={uploading || socketStatus !== 'connected'} title="Attach a file">{uploading ? '⋯' : '＋'}</button><input ref={fileInputRef} type="file" hidden onChange={handleFileSelect} /><textarea ref={inputRef} value={input} onChange={handleInputChange} onKeyDown={handleKeyDown} placeholder={activeChannel ? `Message #${activeChannel.name}` : 'Select a channel to start chatting'} disabled={!activeChannel} rows={1} onInput={event => { event.currentTarget.style.height = 'auto'; event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 120)}px`; }} /><button className="project-chat__send" onClick={sendMessage} disabled={!input.trim() || socketStatus !== 'connected'}>Send <span>↵</span></button></div><p>Enter to send <span>•</span> Shift + Enter for a new line <span>•</span> Use @ to mention a teammate</p></footer>
    </main>
  </div>;
}

const chatStyles = `
.project-chat{height:100%;min-height:500px;display:flex;overflow:hidden;background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-lg);box-shadow:var(--shadow-md);color:var(--text-primary)}.project-chat *{box-sizing:border-box}.project-chat button,.project-chat input,.project-chat textarea{font:inherit}.project-chat__sidebar{width:238px;flex:0 0 238px;display:flex;flex-direction:column;background:var(--bg-raised);border-right:1px solid var(--border);padding:18px 10px 12px}.project-chat__side-header{display:flex;align-items:center;justify-content:space-between;padding:0 8px 20px;font-size:.78rem;font-weight:700;letter-spacing:.01em}.project-chat__status{font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;padding:3px 6px;border-radius:99px}.project-chat__status--connected{color:var(--success);background:rgba(16,185,129,.1)}.project-chat__status--connecting{color:var(--warning);background:rgba(245,158,11,.1)}.project-chat__status--offline{color:var(--text-tertiary);background:var(--bg-elevated)}.project-chat__channel-label{padding:0 8px 7px;color:var(--text-tertiary);font-size:.65rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase}.project-chat__channels{flex:1;overflow:auto}.project-chat__channel{width:100%;border:0;background:transparent;border-radius:var(--radius-sm);padding:8px;display:flex;align-items:center;gap:8px;color:var(--text-secondary);cursor:pointer;text-align:left;font-size:.83rem;font-weight:500}.project-chat__channel:hover{background:var(--bg-hover);color:var(--text-primary)}.project-chat__channel.is-active{background:var(--accent-dim);color:var(--accent);font-weight:700}.project-chat__channel>span:first-child{opacity:.7;font-size:1rem}.project-chat__channel i{margin-left:auto;font-style:normal;color:var(--text-tertiary);font-size:.58rem;font-weight:600}.project-chat__new-channel{border-top:1px solid var(--border);padding:12px 2px 0;display:flex;gap:6px}.project-chat__new-channel input{min-width:0;flex:1;padding:7px 8px;border:1px solid var(--border);border-radius:var(--radius-sm);outline:0;background:var(--bg-elevated);color:var(--text-primary);font-size:.73rem}.project-chat__new-channel input:focus{border-color:var(--accent)}.project-chat__primary,.project-chat__add-channel{border:0;border-radius:var(--radius-sm);cursor:pointer;font-size:.72rem;font-weight:700}.project-chat__primary{background:var(--accent);color:#fff;padding:7px 10px}.project-chat__add-channel{width:100%;padding:8px;background:var(--bg-elevated);color:var(--text-secondary);text-align:left}.project-chat__add-channel:hover{color:var(--accent);background:var(--accent-dim)}.project-chat__main{min-width:0;flex:1;display:flex;flex-direction:column}.project-chat__header{min-height:72px;padding:14px 22px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border)}.project-chat__header h2{font:inherit;font-size:.95rem;font-weight:750;margin:0 0 3px}.project-chat__header h2 span{color:var(--accent);margin-right:6px}.project-chat__header p{margin:0;color:var(--text-tertiary);font-size:.73rem}.project-chat__header-status{display:flex;align-items:center;gap:6px;color:var(--text-tertiary);font-size:.69rem}.project-chat__header-status span{width:7px;height:7px;border-radius:50%;background:var(--text-tertiary)}.project-chat__header-status--connected{color:var(--success)}.project-chat__header-status--connected span{background:var(--success);box-shadow:0 0 0 3px rgba(16,185,129,.12)}.project-chat__header-status--connecting{color:var(--warning)}.project-chat__header-status--connecting span{background:var(--warning)}.project-chat__replying{padding:8px 22px;display:flex;align-items:center;gap:12px;background:var(--accent-dim);border-bottom:1px solid var(--border);color:var(--text-secondary);font-size:.75rem}.project-chat__replying span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.project-chat__replying strong{color:var(--accent)}.project-chat__replying small{margin-left:5px;color:var(--text-tertiary)}.project-chat__replying button{margin-left:auto;border:0;background:none;color:var(--text-secondary);font-size:1.25rem;cursor:pointer}.project-chat__messages{flex:1;overflow-y:auto;padding:8px 22px 22px}.project-chat__date{display:flex;align-items:center;gap:12px;margin:17px 0 10px;color:var(--text-tertiary);font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em}.project-chat__date span{height:1px;flex:1;background:var(--border)}.project-chat__message{position:relative;display:flex;gap:10px;padding:9px 2px;border-radius:var(--radius-sm)}.project-chat__message:hover{background:var(--bg-hover)}.project-chat__message.is-compact{padding-top:2px;padding-bottom:2px}.project-chat__avatar{width:32px;height:32px;flex:0 0 32px;border-radius:10px;background:linear-gradient(135deg,#818cf8,var(--accent));display:flex;align-items:center;justify-content:center;color:#fff;font-size:.67rem;font-weight:800}.project-chat__avatar.is-own{background:linear-gradient(135deg,#34d399,#059669)}.project-chat__message.is-compact .project-chat__avatar{background:transparent}.project-chat__message-body{min-width:0;flex:1}.project-chat__message-meta{display:flex;align-items:baseline;gap:7px;margin-bottom:2px}.project-chat__message-meta strong{font-size:.82rem}.project-chat__message-meta time{color:var(--text-tertiary);font-size:.65rem}.project-chat__message-meta em{font-size:.59rem;font-style:normal;font-weight:700;color:var(--success);background:rgba(16,185,129,.1);padding:1px 5px;border-radius:4px}.project-chat__content{color:var(--text-secondary);font-size:.86rem;line-height:1.55;white-space:pre-wrap;word-break:break-word}.project-chat__mention{display:inline-block;padding:0 4px;border-radius:4px;background:var(--accent-dim);color:var(--accent);font-weight:700}.project-chat__attachment{margin-top:7px;display:flex;align-items:center;gap:9px;max-width:320px;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-elevated);color:var(--text-primary);text-decoration:none}.project-chat__attachment:hover{border-color:var(--accent);background:var(--accent-dim)}.project-chat__attachment>span{color:var(--accent);font-size:1rem}.project-chat__attachment div{min-width:0}.project-chat__attachment strong,.project-chat__attachment small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.project-chat__attachment strong{font-size:.72rem}.project-chat__attachment small{margin-top:1px;color:var(--text-tertiary);font-size:.63rem}.project-chat__reply{position:absolute;right:8px;top:7px;opacity:0;border:1px solid var(--border);border-radius:6px;background:var(--bg-elevated);color:var(--text-secondary);padding:4px 7px;font-size:.66rem;cursor:pointer}.project-chat__message:hover .project-chat__reply,.project-chat__reply:focus{opacity:1}.project-chat__reply:hover{color:var(--accent)}.project-chat__composer{position:relative;padding:12px 16px;border-top:1px solid var(--border);background:var(--bg-raised)}.project-chat__input-wrap{display:flex;align-items:flex-end;gap:8px;padding:7px 8px;border:1px solid var(--border);border-radius:var(--radius-md);background:var(--bg-surface);transition:border-color .15s,box-shadow .15s}.project-chat__input-wrap:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-dim)}.project-chat__attach{width:30px;height:30px;border:0;border-radius:7px;background:transparent;color:var(--text-secondary);font-size:1.2rem;cursor:pointer}.project-chat__attach:hover:not(:disabled){background:var(--accent-dim);color:var(--accent)}.project-chat__attach:disabled{opacity:.45;cursor:not-allowed}.project-chat textarea{min-width:0;flex:1;max-height:120px;padding:4px 0;border:0;outline:0;resize:none;background:transparent;color:var(--text-primary);font-size:.84rem;line-height:1.5}.project-chat textarea::placeholder{color:var(--text-tertiary)}.project-chat__send{border:0;border-radius:8px;padding:7px 11px;background:var(--accent);color:#fff;font-size:.74rem;font-weight:700;cursor:pointer}.project-chat__send:hover:not(:disabled){filter:brightness(1.08)}.project-chat__send:disabled{opacity:.4;cursor:not-allowed}.project-chat__send span{margin-left:3px;opacity:.7}.project-chat__composer>p{margin:5px 3px 0;color:var(--text-tertiary);font-size:.62rem}.project-chat__composer>p span{padding:0 4px}.project-chat__mentions{position:absolute;left:16px;right:16px;bottom:100%;z-index:2;max-width:360px;margin-bottom:5px;padding:4px;border:1px solid var(--border);border-radius:var(--radius-md);background:var(--bg-elevated);box-shadow:var(--shadow-lg)}.project-chat__mentions button{width:100%;display:flex;align-items:center;gap:8px;border:0;border-radius:7px;padding:7px;background:transparent;color:var(--text-primary);font-size:.78rem;text-align:left;cursor:pointer}.project-chat__mentions button:hover,.project-chat__mentions button.is-selected{background:var(--accent-dim)}.project-chat__mentions b{width:23px;height:23px;display:grid;place-items:center;border-radius:7px;background:var(--accent);color:#fff;font-size:.61rem}.project-chat__empty{height:100%;min-height:220px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:5px;text-align:center;color:var(--text-tertiary);font-size:.78rem}.project-chat__empty strong{color:var(--text-primary);font-size:.9rem}.project-chat__empty-icon{color:var(--accent);font-size:1.8rem;margin-bottom:5px}.project-chat__spinner{width:18px;height:18px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:project-chat-spin .8s linear infinite}@keyframes project-chat-spin{to{transform:rotate(360deg)}}.project-chat__loading{padding:10px 8px;color:var(--text-tertiary);font-size:.72rem}.project-chat__unavailable{display:grid;place-items:center;min-height:400px;padding:40px;text-align:center}.project-chat__unavailable h3{margin:0 0 6px;font-size:1rem}.project-chat__unavailable p{margin:0 0 16px;color:var(--text-secondary);font-size:.8rem;max-width:310px}@media(max-width:700px){.project-chat{min-height:560px;position:relative}.project-chat__sidebar{width:155px;flex-basis:155px;padding-left:6px;padding-right:6px}.project-chat__side-header{padding:0 4px 15px}.project-chat__side-header>span:first-child,.project-chat__status,.project-chat__channel i,.project-chat__header p,.project-chat__header-status,.project-chat__composer>p{display:none}.project-chat__channel{padding:8px 5px;font-size:.75rem}.project-chat__header{min-height:58px;padding:10px 14px}.project-chat__messages{padding:6px 12px 14px}.project-chat__composer{padding:9px}.project-chat__reply{display:none}.project-chat__message{gap:8px}.project-chat__avatar{width:28px;height:28px;flex-basis:28px}.project-chat__send span{display:none}}`;

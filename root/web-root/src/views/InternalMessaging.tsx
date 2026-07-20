import React, { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';

const GET_CONVERSATIONS = gql`
  query GetConversations { getConversations { recipientId recipientName recipientRole lastMessage lastMessageAt unreadCount } }
`;

const GET_DIRECT_MESSAGES = gql`
  query GetDirectMessages($recipientId: ID!, $limit: Int) {
    getDirectMessages(recipientId: $recipientId, limit: $limit) { id senderId senderName senderRole recipientId recipientName recipientRole subject content priority read createdAt parentMessageId }
  }
`;

const SEND_MESSAGE = gql`
  mutation SendDirectMessage($recipientId: ID!, $subject: String!, $content: String!, $priority: MessagePriority) {
    sendDirectMessage(recipientId: $recipientId, subject: $subject, content: $content, priority: $priority) { id senderId senderName content createdAt }
  }
`;

const MARK_READ = gql`mutation MarkMessagesRead($senderId: ID!) { markMessagesRead(senderId: $senderId) }`;

const GET_UNREAD_COUNT = gql`query GetUnreadCount { getUnreadCount }`;

const GET_ALL_USERS = gql`
  query GetAllUsers { getAllUsers { id fullName role category department } }
`;

interface Props { user: any; }

export function InternalMessaging({ user }: Props) {
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [newMsg, setNewMsg] = useState({ recipientId: '', subject: '', content: '', priority: 'NORMAL' });
  const [msgInput, setMsgInput] = useState('');

  const { data: convsData, refetch: refetchConvs } = useQuery(GET_CONVERSATIONS, { pollInterval: 60000 });
  const { data: msgsData, refetch: refetchMsgs } = useQuery(GET_DIRECT_MESSAGES, {
    variables: { recipientId: selectedConv, limit: 50 },
    skip: !selectedConv,
    pollInterval: 30000,
  });
  const { data: usersData } = useQuery(GET_ALL_USERS);
  const { data: unreadData } = useQuery(GET_UNREAD_COUNT, { pollInterval: 60000 });

  const [sendMessage] = useMutation(SEND_MESSAGE, { onCompleted: () => { refetchConvs(); refetchMsgs(); setMsgInput(''); } });
  const [markRead] = useMutation(MARK_READ, { onCompleted: () => refetchConvs() });

  const conversations = convsData?.getConversations || [];
  const messages = msgsData?.getDirectMessages || [];
  const allUsers = usersData?.getAllUsers || [];
  const unreadCount = unreadData?.getUnreadCount || 0;

  const selectedUser = allUsers.find((u: any) => u.id === selectedConv);
  const selectedConvData = conversations.find((c: any) => c.recipientId === selectedConv);

  const handleSelectConv = (recipientId: string) => {
    setSelectedConv(recipientId);
    setComposing(false);
    markRead({ variables: { senderId: recipientId } });
  };

  const handleSendInConv = () => {
    if (!msgInput.trim() || !selectedConv) return;
    sendMessage({ variables: { recipientId: selectedConv, subject: 'Re: Conversation', content: msgInput, priority: 'NORMAL' } });
  };

  const handleNewMessage = () => {
    if (!newMsg.recipientId || !newMsg.subject || !newMsg.content) return;
    sendMessage({ variables: newMsg });
    setComposing(false);
    setNewMsg({ recipientId: '', subject: '', content: '', priority: 'NORMAL' });
    setSelectedConv(newMsg.recipientId);
  };

  // Filter users that can be messaged based on hierarchy
  const getContactableUsers = () => {
    const level = user.hierarchyLevel || 7;
    // Can message: people 1 level up, same level, 1 level down, HR, and C-suite can message everyone
    return allUsers.filter((u: any) => {
      if (u.id === user.id) return false;
      if (level <= 2) return true; // C-Suite messages anyone
      const theirLevel = u.hierarchyLevel || 7;
      return Math.abs(theirLevel - level) <= 2 || u.department === 'HR' || theirLevel <= 2;
    });
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', height: 'calc(100vh - 180px)', gap: 0, background: 'var(--bg-surface)', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)' }}>
      {/* Conversations Sidebar */}
      <div style={{ width: 320, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 800, color: '#f4f4f5', fontSize: '1rem' }}>Messages</div>
            {unreadCount > 0 && <div style={{ fontSize: '0.7rem', color: '#7c5cfc', fontWeight: 700, marginTop: 2 }}>{unreadCount} unread</div>}
          </div>
          <button onClick={() => { setComposing(true); setSelectedConv(null); }} style={{ background: 'linear-gradient(135deg, #7c5cfc, #a855f7)', border: 'none', color: 'white', padding: '8px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem' }}>
            + New
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {conversations.length === 0 && (
            <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
              No conversations yet.<br />Start a new message.
            </div>
          )}
          {conversations.map((c: any) => (
            <div key={c.recipientId} onClick={() => handleSelectConv(c.recipientId)} style={{
              padding: '14px 20px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.03)',
              background: selectedConv === c.recipientId ? 'rgba(124,92,252,0.08)' : 'transparent',
              borderLeft: selectedConv === c.recipientId ? '3px solid #7c5cfc' : '3px solid transparent',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.88rem' }}>{c.recipientName}</div>
                {c.unreadCount > 0 && <div style={{ background: '#7c5cfc', color: 'white', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 800 }}>{c.unreadCount}</div>}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: 2 }}>{c.recipientRole?.replace(/_/g, ' ')}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.lastMessage}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: 4 }}>{new Date(c.lastMessageAt).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Message Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {!selectedConv && !composing && (
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: '2.5rem' }}>💬</div>
            <div style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', fontWeight: 600 }}>Select a conversation or start a new message</div>
          </div>
        )}

        {/* Compose New */}
        {composing && (
          <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontWeight: 800, color: '#f4f4f5', fontSize: '1.1rem' }}>New Message</div>
            <select value={newMsg.recipientId} onChange={e => setNewMsg(p => ({ ...p, recipientId: e.target.value }))} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '12px', borderRadius: 10, fontSize: '0.88rem' }}>
              <option value="">Select recipient...</option>
              {getContactableUsers().map((u: any) => (
                <option key={u.id} value={u.id}>{u.fullName} — {u.role?.replace(/_/g, ' ')} ({u.department})</option>
              ))}
            </select>
            <input value={newMsg.subject} onChange={e => setNewMsg(p => ({ ...p, subject: e.target.value }))} placeholder="Subject" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '12px', borderRadius: 10, fontSize: '0.88rem' }} />
            <select value={newMsg.priority} onChange={e => setNewMsg(p => ({ ...p, priority: e.target.value }))} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '12px', borderRadius: 10, fontSize: '0.88rem' }}>
              <option value="NORMAL">Normal Priority</option>
              <option value="URGENT">⚡ Urgent</option>
              <option value="CRITICAL">🔴 Critical</option>
            </select>
            <textarea value={newMsg.content} onChange={e => setNewMsg(p => ({ ...p, content: e.target.value }))} placeholder="Type your message..." rows={6} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '12px', borderRadius: 10, fontSize: '0.88rem', resize: 'none', flex: 1 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setComposing(false)} style={{ padding: '10px 20px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: 10, cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
              <button onClick={handleNewMessage} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #7c5cfc, #a855f7)', border: 'none', color: 'white', borderRadius: 10, cursor: 'pointer', fontWeight: 700, flex: 1 }}>Send Message</button>
            </div>
          </div>
        )}

        {/* Conversation View */}
        {selectedConv && !composing && (
          <>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #7c5cfc, #f472b6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '0.85rem' }}>
                {(selectedConvData?.recipientName || selectedUser?.fullName || '?').charAt(0)}
              </div>
              <div>
                <div style={{ fontWeight: 700, color: '#f4f4f5', fontSize: '0.95rem' }}>{selectedConvData?.recipientName || selectedUser?.fullName}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>{(selectedConvData?.recipientRole || selectedUser?.role)?.replace(/_/g, ' ')}</div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {messages.map((m: any) => {
                const isMine = m.senderId === user.id;
                return (
                  <div key={m.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '70%', padding: '12px 16px', borderRadius: isMine ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: isMine ? 'rgba(124,92,252,0.15)' : 'var(--bg-elevated)', border: `1px solid ${isMine ? 'rgba(124,92,252,0.3)' : 'var(--border)'}` }}>
                      {m.subject && m.subject !== 'Re: Conversation' && (
                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#a78bfa', marginBottom: 4 }}>{m.subject}</div>
                      )}
                      {m.priority !== 'NORMAL' && (
                        <div style={{ fontSize: '0.6rem', fontWeight: 800, color: m.priority === 'CRITICAL' ? '#ef4444' : '#f59e0b', marginBottom: 4 }}>
                          {m.priority === 'CRITICAL' ? '🔴 CRITICAL' : '⚡ URGENT'}
                        </div>
                      )}
                      <div style={{ color: 'var(--text-primary)', fontSize: '0.88rem', lineHeight: 1.5 }}>{m.content}</div>
                      <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', marginTop: 6, textAlign: isMine ? 'right' : 'left' }}>{new Date(m.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                );
              })}
              {messages.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '3rem' }}>No messages yet. Start the conversation.</div>}
            </div>

            {/* Input */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
              <input value={msgInput} onChange={e => setMsgInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendInConv()} placeholder="Type a message..." style={{ flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: 10, fontSize: '0.88rem' }} />
              <button onClick={handleSendInConv} disabled={!msgInput.trim()} style={{ background: 'linear-gradient(135deg, #7c5cfc, #a855f7)', border: 'none', color: 'white', padding: '12px 20px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', opacity: msgInput.trim() ? 1 : 0.5 }}>
                Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

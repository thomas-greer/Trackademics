import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import Navbar from "../components/Navbar";
import { colors, radius, shadows } from "../theme";

const API = "http://127.0.0.1:8000/api/users/messages";

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

function MessagesPage() {
  let authUser = useSelector((state) => state.auth.user);
  if (!authUser) {
    const raw = localStorage.getItem("user");
    if (raw && raw !== "undefined") authUser = JSON.parse(raw);
  }
  const viewerId = toNumber(authUser?.id);
  const [users, setUsers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupName, setGroupName] = useState("");

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId]
  );
  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users.slice(0, 12);
    return users.filter((u) => (u.username || "").toLowerCase().includes(q)).slice(0, 12);
  }, [users, userSearch]);

  const loadConversations = async () => {
    if (!viewerId) return;
    const res = await fetch(`${API}/conversations/?viewer_id=${viewerId}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || "Could not load conversations.");
    }
    if (Array.isArray(data)) {
      setConversations(data);
      if (data.length === 0) {
        setActiveId(null);
        return;
      }
      const hasActive = data.some((c) => c.id === activeId);
      if (!hasActive) setActiveId(data[0].id);
    }
  };

  useEffect(() => {
    if (!viewerId) return;
    loadConversations().catch(() => {});
    fetch(`http://127.0.0.1:8000/api/users/?viewer_id=${viewerId}`)
      .then((r) => r.json())
      .then((d) => setUsers(Array.isArray(d) ? d.filter((u) => toNumber(u.id) !== viewerId) : []))
      .catch(() => setUsers([]));
  }, [viewerId]);

  useEffect(() => {
    if (!viewerId || !activeId) {
      setMessages([]);
      return;
    }
    fetch(`${API}/conversations/${activeId}/messages/?viewer_id=${viewerId}`)
      .then((r) => r.json())
      .then((d) => setMessages(Array.isArray(d) ? d : []))
      .catch(() => setMessages([]));
  }, [viewerId, activeId]);

  const createConversation = async () => {
    if (!viewerId) return;
    if (selectedUsers.length === 0) return;
    const participant_ids = selectedUsers.map((u) => toNumber(u.id));
    const is_group = participant_ids.length > 1;
    const name = is_group ? groupName.trim() : "";
    const res = await fetch(`${API}/conversations/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ viewer_id: viewerId, participant_ids, is_group, name }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Could not create conversation.");
      return;
    }
    await loadConversations();
    setActiveId(data.id);
    setUserSearch("");
    setSelectedUsers([]);
    setGroupName("");
  };

  const deleteConversation = async (conversationId) => {
    if (!viewerId || !conversationId) return;
    if (!window.confirm("Delete this conversation for all participants?")) return;
    const res = await fetch(`${API}/conversations/${conversationId}/?viewer_id=${viewerId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      let data = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      alert(data.error || "Could not delete conversation.");
      return;
    }
    setMessages([]);
    await loadConversations();
  };

  const sendMessage = async () => {
    if (!viewerId || !activeId || !draft.trim()) return;
    const res = await fetch(`${API}/conversations/${activeId}/messages/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ viewer_id: viewerId, content: draft.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Could not send message.");
      return;
    }
    setMessages((prev) => [...prev, data]);
    setDraft("");
    loadConversations().catch(() => {});
  };

  return (
    <div>
      <Navbar />
      <div style={wrap}>
        <div style={leftCard}>
          <h2 style={title}>Study Groups</h2>
          <p style={subtitle}>Start conversations for study groups and class discussions.</p>
          <div style={composer}>
            <input
              placeholder="Search users to add..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              style={fullInput}
            />
            <div style={userResultsBox}>
              {filteredUsers.map((u) => {
                const selected = selectedUsers.some((s) => s.id === u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() =>
                      setSelectedUsers((prev) =>
                        selected ? prev.filter((p) => p.id !== u.id) : [...prev, u]
                      )
                    }
                    style={{ ...userResultRow, ...(selected ? userResultRowSelected : {}) }}
                  >
                    {selected ? "✓ " : ""}{u.username}
                  </button>
                );
              })}
            </div>
            <div style={chipWrap}>
              {selectedUsers.map((u) => (
                <span key={u.id} style={chip}>
                  {u.username}
                  <button type="button" onClick={() => setSelectedUsers((prev) => prev.filter((p) => p.id !== u.id))} style={chipX}>×</button>
                </span>
              ))}
            </div>
            {selectedUsers.length > 1 && (
              <input
                placeholder="Optional group name (defaults to Study Group)"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                style={fullInput}
              />
            )}
            <button type="button" onClick={createConversation}>Create Chat</button>
          </div>

          <div style={{ marginTop: 12 }}>
            {conversations.map((c) => (
              <div key={c.id} style={{ ...conversationRow, ...(activeId === c.id ? activeConversationRow : {}) }}>
                <button type="button" onClick={() => setActiveId(c.id)} style={conversationOpenBtn}>
                  <div style={{ fontWeight: 700 }}>{c.title}</div>
                  <div style={{ color: colors.textSubtle, fontSize: 12 }}>{c.latest_message?.content || "No messages yet"}</div>
                </button>
                <button type="button" onClick={() => deleteConversation(c.id)} style={deleteConvoBtn}>×</button>
              </div>
            ))}
          </div>
        </div>

        <div style={rightCard}>
          {activeConversation ? (
            <>
              <h3 style={{ marginTop: 0, color: colors.primary }}>{activeConversation.title}</h3>
              <p style={{ marginTop: -6, color: colors.textMuted, fontSize: 13 }}>
                {activeConversation.is_group ? "Group chat" : "Direct chat"}
              </p>
              <div style={messagesPane}>
                {messages.map((m) => (
                  <div key={m.id} style={{ ...msgBubble, ...(m.sender_id === viewerId ? myBubble : {}) }}>
                    <div style={msgSender}>{m.sender_username}</div>
                    <div>{m.content}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a message..." style={{ ...fullInput, marginBottom: 0 }} />
                <button type="button" onClick={sendMessage}>Send</button>
              </div>
            </>
          ) : (
            <p style={{ color: colors.textMuted }}>Open a conversation to start chatting.</p>
          )}
        </div>
      </div>
    </div>
  );
}

const wrap = {
  maxWidth: 1180,
  margin: "24px auto",
  padding: "0 20px",
  display: "grid",
  gridTemplateColumns: "360px 1fr",
  gap: 16,
};
const baseCard = {
  background: colors.card,
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: radius.lg,
  boxShadow: shadows.sm,
  padding: 16,
};
const leftCard = { ...baseCard, alignSelf: "start" };
const rightCard = { ...baseCard, minHeight: 540 };
const title = { margin: 0, color: colors.primary, fontWeight: 800 };
const subtitle = { marginTop: 6, color: colors.textMuted, fontSize: 13 };
const composer = { display: "grid", gap: 8, marginTop: 8 };
const fullInput = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${colors.cardBorder}` };
const userResultsBox = { border: `1px solid ${colors.cardBorder}`, borderRadius: radius.sm, maxHeight: 150, overflowY: "auto", background: colors.white };
const userResultRow = { width: "100%", textAlign: "left", border: "none", borderBottom: `1px solid ${colors.borderSubtle}`, padding: "8px 10px", background: "transparent", color: colors.text };
const userResultRowSelected = { background: colors.accentMuted, color: colors.primary };
const chipWrap = { display: "flex", flexWrap: "wrap", gap: 6 };
const chip = { background: colors.accentMuted, color: colors.primary, borderRadius: radius.pill, padding: "5px 9px", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700 };
const chipX = { border: "none", background: "transparent", color: colors.primary, padding: 0, lineHeight: 1, cursor: "pointer", fontSize: 14 };
const conversationRow = { width: "100%", textAlign: "left", padding: 0, border: `1px solid ${colors.borderSubtle}`, borderRadius: radius.sm, marginBottom: 8, background: colors.white, color: colors.text, display: "flex", alignItems: "stretch" };
const conversationOpenBtn = { flex: 1, border: "none", background: "transparent", textAlign: "left", padding: 10, color: colors.text };
const deleteConvoBtn = { width: 36, border: "none", borderLeft: `1px solid ${colors.borderSubtle}`, background: "transparent", color: colors.danger, fontSize: 18, fontWeight: 700, cursor: "pointer" };
const activeConversationRow = { borderColor: colors.primary, boxShadow: `0 0 0 2px ${colors.primaryMuted}` };
const messagesPane = { marginTop: 8, border: `1px solid ${colors.borderSubtle}`, borderRadius: radius.md, padding: 10, height: 390, overflowY: "auto", background: colors.white };
const msgBubble = { padding: "8px 10px", borderRadius: radius.sm, background: colors.card, marginBottom: 8, maxWidth: "75%" };
const myBubble = { marginLeft: "auto", background: colors.accentMuted };
const msgSender = { fontSize: 11, color: colors.textSubtle, marginBottom: 2 };

export default MessagesPage;

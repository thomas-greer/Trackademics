import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { fetchSessions, deleteSession } from "../features/sessionsSlice";
import Navbar from "../components/Navbar";
import FeedCommunityStats from "../components/FeedCommunityStats";
import UserAvatar from "../components/UserAvatar";
import { getSchoolAbbreviation } from "../constants/schools";
import { colors, shadows, radius } from "../theme";

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function FeedPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const sessions = useSelector(state => state.sessions.list);

  let user = useSelector(state => state.auth.user);
  if (!user) {
    const storedUser = localStorage.getItem("user");
    if (storedUser && storedUser !== "undefined") {
      user = JSON.parse(storedUser);
    }
  }

  const [users, setUsers] = useState([]);
  const [likes, setLikes] = useState({});
  const [comments, setComments] = useState({});
  const [commentInput, setCommentInput] = useState({});
  const [showCommentBox, setShowCommentBox] = useState({});
  const [updatingFollowId, setUpdatingFollowId] = useState(null);
  const [communityStats, setCommunityStats] = useState(undefined);
  const currentUserId = toNumber(user?.id);

  useEffect(() => {
    let cancelled = false;
    setCommunityStats(undefined);
    fetch("http://127.0.0.1:8000/api/users/community-stats/")
      .then((res) => {
        if (!res.ok) throw new Error("bad status");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setCommunityStats(data);
      })
      .catch(() => {
        if (!cancelled) setCommunityStats(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    dispatch(fetchSessions({ viewerId: currentUserId }));

    fetch(`http://127.0.0.1:8000/api/users/?viewer_id=${currentUserId || ""}`)
      .then((res) => res.json())
      .then((data) => {
        setUsers(Array.isArray(data) ? data : []);
      })
      .catch(() => setUsers([]));

  }, [dispatch, currentUserId]);

  useEffect(() => {
    const nextComments = {};
    const nextLikes = {};
    sessions.forEach((session) => {
      nextComments[session.id] = session.comments || [];
      nextLikes[session.id] = toNumber(session.likes_count);
    });
    setComments(nextComments);
    setLikes(nextLikes);
  }, [sessions]);

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return "just now";
    const now = new Date();
    const past = new Date(timestamp);
    const diff = Math.floor((now - past) / 1000);

    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;

    return past.toLocaleDateString();
  };

  const uniqueSessions = Array.from(
    new Map(sessions.map(s => [s.id, s])).values()
  );

  const currentSchool = (user?.school || "").trim().toLowerCase();
  const suggestedUsers = users
    .filter((u) => u.username !== user?.username)
    .sort((a, b) => {
      const aSame = currentSchool && (a.school || "").trim().toLowerCase() === currentSchool ? 1 : 0;
      const bSame = currentSchool && (b.school || "").trim().toLowerCase() === currentSchool ? 1 : 0;
      if (aSame !== bSame) return bSame - aSame;
      return (a.username || "").localeCompare(b.username || "");
    })
    .slice(0, 5);

  const handleLike = async (id) => {
    if (!user?.id) return;
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/users/sessions/${id}/likes/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: user.id }),
      });
      const data = await res.json();
      if (!res.ok) return;
      setLikes((prev) => ({ ...prev, [id]: toNumber(data.likes_count) }));
    } catch {
      // no-op
    }
  };

  const toggleCommentBox = (id) => {
    setShowCommentBox(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleComment = async (id) => {
    const content = commentInput[id]?.trim();
    if (!content) return;

    if (!user?.id) {
      alert("Please log in before commenting.");
      return;
    }

    try {
      const res = await fetch(`http://127.0.0.1:8000/api/users/sessions/${id}/comments/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user: user.id,
          content,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Could not post comment.");
        return;
      }

      setComments((prev) => ({
        ...prev,
        [id]: [...(prev[id] || []), data],
      }));

      setCommentInput((prev) => ({
        ...prev,
        [id]: "",
      }));
    } catch (error) {
      console.error(error);
      alert("Server error while posting comment.");
    }
  };

  const mySessions = sessions.filter(
    s => s.user_id === user?.id || s.user === user?.username
  );

  const totalMinutes = mySessions.reduce(
    (sum, s) => sum + Number(s.duration || 0),
    0
  );

  const handleDeleteSession = async (sessionId) => {
    if (!currentUserId) return;
    if (!window.confirm("Delete this post? This cannot be undone.")) return;
    try {
      await dispatch(
        deleteSession({ sessionId, userId: currentUserId })
      ).unwrap();
    } catch (err) {
      alert(err?.message || "Could not delete post.");
    }
  };

  const handleFollowUser = async (targetUserId) => {
    if (!currentUserId || !targetUserId || currentUserId === targetUserId) return;
    setUpdatingFollowId(targetUserId);

    try {
      const res = await fetch(`http://127.0.0.1:8000/api/users/${targetUserId}/follow/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          follower_id: currentUserId,
        }),
      });

      const raw = await res.text();
      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { error: raw || "Unexpected response format from server." };
      }

      if (!res.ok) {
        alert(data.error || "Could not follow user.");
        return;
      }

      setUsers((prev) =>
        prev.map((u) =>
          toNumber(u.id) === targetUserId
            ? {
                ...u,
                is_following: true,
                followers_count: toNumber(data.followers_count),
              }
            : u
        )
      );
      dispatch(fetchSessions({ viewerId: currentUserId }));
    } catch (error) {
      console.error(error);
      alert("Server error while following user.");
    } finally {
      setUpdatingFollowId(null);
    }
  };

  return (
    <div>
      <Navbar />

      <div style={{
        display: "grid",
        gridTemplateColumns: "260px 600px 260px",
        gap: "40px",
        justifyContent: "center",
        padding: "32px 20px 48px",
        backgroundColor: colors.white,
        minHeight: "100vh"
      }}>

        {/* LEFT PANEL */}
        <div>
          <div style={columnHeaderSpacer} aria-hidden />
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
              <UserAvatar avatarUrl={user?.avatar_url} username={user?.username} size={44} />
              <h3 style={{ margin: 0, color: colors.primary, fontWeight: 700 }}>{user?.username}</h3>
            </div>
            <p style={statText}>📚 {mySessions.length} sessions</p>
            <p style={statText}>⏱ {totalMinutes} minutes</p>
          </div>
        </div>

        {/* CENTER FEED */}
        <div>

          <h2 style={{
            margin: "0 0 20px",
            color: colors.primary,
            fontWeight: 800,
            fontSize: "28px",
            lineHeight: "40px",
            letterSpacing: "-0.02em",
          }}>Feed</h2>

          {uniqueSessions.length === 0 && (
            <div style={{ ...cardStyle, marginBottom: "20px", textAlign: "center" }}>
              <p style={{ margin: "0 0 16px", color: colors.textMuted, fontSize: "15px", lineHeight: 1.5 }}>
                Start following other students to begin viewing content.
              </p>
              <p style={{ margin: "0 0 10px", fontWeight: "700", color: colors.text }}>
                Suggested accounts
              </p>
              {suggestedUsers.length === 0 ? (
                <p style={{ color: colors.textSubtle, fontSize: "14px", margin: 0 }}>No suggestions yet.</p>
              ) : (
                suggestedUsers.map((u) => (
                  <div key={u.id} style={{ ...suggestedUserRow, marginTop: "10px" }}>
                    <span
                      style={{ ...userLink, display: "inline-flex", alignItems: "center", gap: "8px" }}
                      onClick={() => navigate(`/profile/${u.id}`)}
                    >
                      <UserAvatar avatarUrl={u.avatar_url} username={u.username} size={28} />
                      {u.username}
                      {u.school ? ` - ${getSchoolAbbreviation(u.school)}` : ""}
                    </span>
                    {!u.is_following && (
                      <button
                        type="button"
                        className="feed-follow-icon"
                        style={followIconButton}
                        onClick={() => handleFollowUser(toNumber(u.id))}
                        disabled={updatingFollowId === toNumber(u.id)}
                        title="Follow user"
                      >
                        +
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {uniqueSessions.map(session => (
            <div
              key={session.id}
              style={{
                ...cardStyle,
                marginBottom: "20px" // 🔥 THIS FIXES POSTS TOUCHING
              }}
            >

              <div style={headerRow}>
                <div style={userRow}>
                  <UserAvatar
                    avatarUrl={session.user_avatar}
                    username={session.user}
                    size={40}
                  />

                  <div>
                    <div
                      style={{ ...userLink, fontWeight: "600" }}
                      onClick={() => navigate(`/profile/${session.user_id}`)}
                    >
                      {session.user}
                    </div>
                    <div style={timeText}>
                      {formatTimeAgo(session.created_at)}
                    </div>
                  </div>
                </div>
                {toNumber(session.user_id) === currentUserId && currentUserId > 0 && (
                  <button
                    type="button"
                    className="delete-soft-btn"
                    onClick={() => handleDeleteSession(session.id)}
                    style={deletePostButton}
                  >
                    Delete
                  </button>
                )}
              </div>

              <p style={{ marginTop: "12px" }}>
                📚 Studied <strong>{session.subject}</strong>
              </p>

              <p style={statText}>
                ⏱ {session.duration} minutes
              </p>

              {session.caption && (
                <p style={caption}>{session.caption}</p>
              )}

              <div style={actionsRow}>
                <span onClick={() => handleLike(session.id)} style={clickable}>
                  ❤️ {likes[session.id] || 0}
                </span>

                <span onClick={() => toggleCommentBox(session.id)} style={clickable}>
                  💬 {showCommentBox[session.id] ? "Hide Comment Box" : "Add Comment"}
                </span>
              </div>

              {(comments[session.id] || []).length > 0 && (
                <div style={{ marginTop: "10px" }}>
                  {(comments[session.id] || []).map((c) => (
                    <div key={c.id} style={{ marginTop: "8px", display: "flex", gap: "8px", alignItems: "flex-start" }}>
                      <UserAvatar avatarUrl={c.user_avatar} username={c.user} size={28} />
                      <p style={{ margin: 0, flex: 1 }}>
                        <strong>{c.user}:</strong> {c.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {showCommentBox[session.id] && (
                <div style={{ marginTop: "10px" }}>
                  <input
                    placeholder="Write a comment..."
                    value={commentInput[session.id] || ""}
                    onChange={(e) =>
                      setCommentInput({
                        ...commentInput,
                        [session.id]: e.target.value
                      })
                    }
                    style={inputStyle}
                  />

                  <button type="button" onClick={() => handleComment(session.id)} style={buttonStyle}>
                    Post
                  </button>
                </div>
              )}

            </div>
          ))}

        </div>

        {/* RIGHT PANEL */}
        <div>
          <div style={columnHeaderSpacer} aria-hidden />
          <div style={cardStyle}>
            <h3 style={{ color: colors.primary, fontWeight: 700 }}>Suggested Users</h3>

            {suggestedUsers.map(u => (
                <div key={u.id} style={suggestedUserRow}>
                  <span
                    style={{ ...userLink, display: "inline-flex", alignItems: "center", gap: "8px" }}
                    onClick={() => navigate(`/profile/${u.id}`)}
                  >
                    <UserAvatar avatarUrl={u.avatar_url} username={u.username} size={28} />
                    {u.username}
                    {u.school ? ` - ${getSchoolAbbreviation(u.school)}` : ""}
                  </span>
                  {!u.is_following && (
                    <button
                      type="button"
                      className="feed-follow-icon"
                      style={followIconButton}
                      onClick={() => handleFollowUser(toNumber(u.id))}
                      disabled={updatingFollowId === toNumber(u.id)}
                      title="Follow user"
                    >
                      +
                    </button>
                  )}
                </div>
              ))}
          </div>

          <div style={{ ...cardStyle, marginTop: "20px" }}>
            <h3 style={{ marginTop: 0, color: colors.primary, fontWeight: 700 }}>Community Stats</h3>
            {communityStats === undefined && (
              <p style={{ color: colors.textSubtle, fontSize: "13px", margin: "8px 0 0" }}>Loading…</p>
            )}
            {communityStats === null && (
              <p style={{ color: colors.textSubtle, fontSize: "13px", margin: "8px 0 0" }}>
                Community stats could not be loaded.
              </p>
            )}
            {communityStats && <FeedCommunityStats stats={communityStats} />}
          </div>
        </div>

      </div>
    </div>
  );
}

/* STYLES */

const cardStyle = {
  background: colors.card,
  padding: "20px",
  borderRadius: radius.lg,
  border: `1px solid ${colors.cardBorder}`,
  boxShadow: shadows.sm,
};

const columnHeaderSpacer = {
  height: "60px",
};

const headerRow = {
  display: "flex",
  justifyContent: "space-between"
};

const userRow = {
  display: "flex",
  gap: "10px",
  alignItems: "center"
};

const statText = {
  color: colors.textMuted,
  fontSize: "14px"
};

const timeText = {
  fontSize: "12px",
  color: colors.textSubtle
};

const caption = {
  marginTop: "8px",
  fontStyle: "italic",
  color: colors.textMuted
};

const actionsRow = {
  marginTop: "12px",
  display: "flex",
  gap: "20px"
};

const clickable = {
  cursor: "pointer",
  color: colors.primary,
  fontWeight: 600,
  fontSize: "14px",
};

const userLink = {
  cursor: "pointer",
  textDecoration: "none",
  color: colors.primary,
  fontWeight: 600,
  borderBottom: `2px solid ${colors.accent}`,
  paddingBottom: "1px",
};

const suggestedUserRow = {
  marginTop: "8px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const followIconButton = {
  width: "28px",
  height: "28px",
  borderRadius: "50%",
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "18px",
  lineHeight: 1,
  background: colors.accent,
  color: colors.primary,
  border: `1px solid ${colors.accentHover}`,
  fontWeight: 700,
  boxShadow: `0 2px 6px ${colors.primaryMuted}`,
};

const inputStyle = {
  padding: "8px 12px",
  borderRadius: radius.sm,
  border: `1px solid ${colors.cardBorder}`,
  width: "70%",
  background: colors.white,
};

const buttonStyle = {
  marginLeft: "10px",
  padding: "8px 14px",
  borderRadius: radius.sm,
  border: "none",
  backgroundColor: colors.primary,
  color: colors.white,
  cursor: "pointer",
  fontWeight: 600,
};

const deletePostButton = {
  alignSelf: "flex-start",
  padding: "5px 12px",
  fontSize: "13px",
  borderRadius: radius.sm,
  border: `1px solid ${colors.border}`,
  background: colors.white,
  color: colors.danger,
  cursor: "pointer",
  fontWeight: 600,
};

export default FeedPage;
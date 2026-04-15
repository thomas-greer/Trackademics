import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchSessions } from "../features/sessionsSlice";
import Navbar from "../components/Navbar";

function FeedPage() {
  const dispatch = useDispatch();
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

  useEffect(() => {
    dispatch(fetchSessions());

    fetch("http://127.0.0.1:8000/api/users/")
      .then(res => res.json())
      .then(data => setUsers(data));

  }, [dispatch]);

  useEffect(() => {
    const nextComments = {};
    sessions.forEach((session) => {
      nextComments[session.id] = session.comments || [];
    });
    setComments(nextComments);
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

  const handleLike = (id) => {
    setLikes(prev => ({
      ...prev,
      [id]: (prev[id] || 0) + 1
    }));
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

  return (
    <div>
      <Navbar />

      <div style={{
        display: "grid",
        gridTemplateColumns: "260px 600px 260px",
        gap: "40px",
        justifyContent: "center",
        padding: "30px 20px",
        backgroundColor: "#f7f7f7",
        minHeight: "100vh"
      }}>

        {/* LEFT PANEL */}
        <div style={{ marginTop: "60px" }}>
          <div style={cardStyle}>
            <h3 style={{ marginBottom: "10px" }}>{user?.username}</h3>
            <p style={statText}>📚 {mySessions.length} sessions</p>
            <p style={statText}>⏱ {totalMinutes} minutes</p>
          </div>
        </div>

        {/* CENTER FEED */}
        <div>

          <h2 style={{ marginBottom: "20px" }}>Feed</h2>

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
                  <div style={avatar}>
                    {session.user?.[0]?.toUpperCase()}
                  </div>

                  <div>
                    <div style={{ fontWeight: "600" }}>{session.user}</div>
                    <div style={timeText}>
                      {formatTimeAgo(session.created_at)}
                    </div>
                  </div>
                </div>
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
                  💬 Comment
                </span>
              </div>

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

                  <button onClick={() => handleComment(session.id)} style={buttonStyle}>
                    Post
                  </button>

                  {(comments[session.id] || []).map((c) => (
                    <p key={c.id} style={{ marginTop: "6px" }}>
                      💬 <strong>{c.user}:</strong> {c.content}
                    </p>
                  ))}
                </div>
              )}

            </div>
          ))}

        </div>

        {/* RIGHT PANEL */}
        <div style={{ marginTop: "60px" }}>
          <div style={cardStyle}>
            <h3>Suggested Users</h3>

            {users
              .filter(u => u.username !== user?.username)
              .slice(0, 5)
              .map(u => (
                <div key={u.id} style={{ marginTop: "8px" }}>
                  👤 {u.username}
                </div>
              ))}
          </div>

          <div style={{ ...cardStyle, marginTop: "20px" }}>
            <h3>Community Stats</h3>
            <p>🔥 Coming soon</p>
            <p>📈 Weekly trends</p>
          </div>
        </div>

      </div>
    </div>
  );
}

/* STYLES */

const cardStyle = {
  background: "white",
  padding: "18px",
  borderRadius: "14px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.06)"
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

const avatar = {
  width: "40px",
  height: "40px",
  borderRadius: "50%",
  backgroundColor: "#ff5a5f",
  color: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "bold"
};

const statText = {
  color: "#666",
  fontSize: "14px"
};

const timeText = {
  fontSize: "12px",
  color: "#999"
};

const caption = {
  marginTop: "8px",
  fontStyle: "italic",
  color: "#444"
};

const actionsRow = {
  marginTop: "12px",
  display: "flex",
  gap: "20px"
};

const clickable = {
  cursor: "pointer"
};

const inputStyle = {
  padding: "6px",
  borderRadius: "6px",
  border: "1px solid #ccc",
  width: "70%"
};

const buttonStyle = {
  marginLeft: "10px",
  padding: "6px 10px",
  borderRadius: "6px",
  border: "none",
  backgroundColor: "#ff5a5f",
  color: "white",
  cursor: "pointer"
};

export default FeedPage;
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchSessions } from "../features/sessionsSlice";
import Navbar from "../components/Navbar";

function FeedPage() {
  const dispatch = useDispatch();
  const sessions = useSelector(state => state.sessions.list);

  const [likes, setLikes] = useState({});
  const [comments, setComments] = useState({});
  const [commentInput, setCommentInput] = useState({});
  const [showCommentBox, setShowCommentBox] = useState({});

  useEffect(() => {
    dispatch(fetchSessions());
  }, [dispatch]);

  // remove duplicates
  const uniqueSessions = Array.from(
    new Map(sessions.map(s => [s.id, s])).values()
  );

  // ❤️ like handler
  const handleLike = (id) => {
    setLikes(prev => ({
      ...prev,
      [id]: (prev[id] || 0) + 1
    }));
  };

  // 💬 toggle comment box
  const toggleCommentBox = (id) => {
    setShowCommentBox(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // 💬 submit comment
  const handleComment = (id) => {
    if (!commentInput[id]) return;

    setComments(prev => ({
      ...prev,
      [id]: [...(prev[id] || []), commentInput[id]]
    }));

    setCommentInput(prev => ({
      ...prev,
      [id]: ""
    }));
  };

  
  return (
    <div>
      <Navbar />

      <div className="container">
        <h1>Feed</h1>

        {uniqueSessions.length === 0 && (
          <p>No activity yet. Be the first to study 📚</p>
        )}

        {uniqueSessions.map(session => (
          <div className="card" key={session.id}>

            {/* HEADER */}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                
                <div style={{
                  width: "35px",
                  height: "35px",
                  borderRadius: "50%",
                  backgroundColor: "#ff5a5f",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "bold"
                }}>
                  {session.user?.[0]?.toUpperCase()}
                </div>

                <strong>{session.user}</strong>
              </div>

              <span style={{ color: "gray", fontSize: "12px" }}>
                just now
              </span>
            </div>

            {/* CONTENT */}
            <p style={{ marginTop: "10px" }}>
              📚 Studied <strong>{session.subject}</strong>
            </p>

            <p style={{ color: "#555" }}>
              ⏱ {session.duration} minutes
            </p>

            {/* 🆕 CAPTION */}
            {session.caption && (
              <p style={{ marginTop: "5px", fontStyle: "italic" }}>
                {session.caption}
              </p>
            )}

            {/* ACTIONS */}
            <div style={{
              marginTop: "10px",
              display: "flex",
              gap: "20px",
              fontSize: "14px"
            }}>
              <span
                style={{ cursor: "pointer" }}
                onClick={() => handleLike(session.id)}
              >
                ❤️ Like ({likes[session.id] || 0})
              </span>

              <span
                style={{ cursor: "pointer" }}
                onClick={() => toggleCommentBox(session.id)}
              >
                💬 Comment
              </span>
            </div>

            {/* COMMENT BOX (TOGGLED) */}
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
                  style={{ width: "70%" }}
                />

                <button onClick={() => handleComment(session.id)}>
                  Post
                </button>

                {(comments[session.id] || []).map((c, i) => (
                  <p key={i} style={{ fontSize: "13px", marginTop: "5px" }}>
                    💬 {c}
                  </p>
                ))}
              </div>
            )}

          </div>
        ))}
      </div>
    </div>
  );
}

export default FeedPage;
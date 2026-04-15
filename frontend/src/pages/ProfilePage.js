import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import Navbar from "../components/Navbar";

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function ProfilePage() {
  const sessions = useSelector(state => state.sessions.list);

  let user = useSelector(state => state.auth.user);

  if (!user) {
    const storedUser = localStorage.getItem("user");
    if (storedUser && storedUser !== "undefined") {
      user = JSON.parse(storedUser);
    }
  }

  const [streaks, setStreaks] = useState({
    current: 0,
    best: 0
  });

  useEffect(() => {
    const storedUserRaw = localStorage.getItem("user");
    let storedUser = null;
    if (storedUserRaw && storedUserRaw !== "undefined") {
      try {
        storedUser = JSON.parse(storedUserRaw);
      } catch (error) {
        console.error("Could not parse stored user", error);
      }
    }

    const targetUserId = toNumber(user?.id ?? storedUser?.id);
    if (!targetUserId) {
      setStreaks({ current: 0, best: 0 });
      return;
    }

    fetch("http://127.0.0.1:8000/api/users/")
      .then(res => res.json())
      .then(data => {
        const me = data.find(u => toNumber(u.id) === targetUserId);

        setStreaks({
          current: toNumber(me?.stats?.current_streak),
          best: toNumber(me?.stats?.best_streak)
        });
      })
      .catch(error => {
        console.error("Failed to load streaks", error);
        setStreaks({ current: 0, best: 0 });
      });
  }, [user?.id]);

  const mySessions = sessions.filter(
    s => s.user_id === user?.id || s.user === user?.username
  );

  const totalMinutes = mySessions.reduce(
    (sum, s) => sum + Number(s.duration || 0),
    0
  );

  // timestamp formatter
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

  return (
    <div>
      <Navbar />

      <div className="container">

        {/* PROFILE HEADER */}
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{
            width: "70px",
            height: "70px",
            borderRadius: "50%",
            backgroundColor: "#ff5a5f",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "24px",
            margin: "0 auto 10px auto"
          }}>
            {user?.username?.[0]?.toUpperCase()}
          </div>

          <h2>{user?.username}</h2>

          {/* 🔥 STREAKS */}
          <div style={{ marginTop: "10px" }}>
            <p style={{ fontWeight: "600" }}>
            Current Streak: {streaks.current} days
            </p>
            <p style={{ color: "#888", fontSize: "14px" }}>
            Best Streak: {streaks.best} days
            </p>
          </div>

          {/* STATS */}
          <p style={{ color: "#555", marginTop: "10px" }}>
            📚 {mySessions.length} sessions • ⏱ {totalMinutes} minutes studied
          </p>
        </div>

        {/* USER POSTS */}
        <h2 style={{ marginTop: "20px" }}>My Activity</h2>

        {mySessions.length === 0 && (
          <p>No study sessions yet</p>
        )}

        {mySessions.map(session => (
          <div className="card" key={session.id}>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>{user?.username}</strong>

              <span style={{ color: "gray", fontSize: "12px" }}>
                {formatTimeAgo(session.created_at)}
              </span>
            </div>

            <p style={{ marginTop: "10px" }}>
              📚 Studied <strong>{session.subject}</strong>
            </p>

            <p style={{ color: "#555" }}>
              ⏱ {session.duration} minutes
            </p>

            {session.caption && (
              <p style={{ marginTop: "5px", fontStyle: "italic" }}>
                {session.caption}
              </p>
            )}

          </div>
        ))}

      </div>
    </div>
  );
}

export default ProfilePage;
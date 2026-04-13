import { useSelector } from "react-redux";
import Navbar from "../components/Navbar";

function ProfilePage() {
  const sessions = useSelector(state => state.sessions.list);

  // get logged-in user (fallback to localStorage)
  let user = useSelector(state => state.auth.user);

  if (!user) {
    const storedUser = localStorage.getItem("user");
    if (storedUser && storedUser !== "undefined") {
      user = JSON.parse(storedUser);
    }
  }

  // filter sessions for this user
  const mySessions = sessions.filter(
    s => s.user_id === user?.id || s.user === user?.username
  );

  // stats
  const totalMinutes = mySessions.reduce(
    (sum, s) => sum + Number(s.duration || 0),
    0
  );

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

          {/* STATS */}
          <p style={{ color: "#555" }}>
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

            {/* header */}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>{user?.username}</strong>

              <span style={{ color: "gray", fontSize: "12px" }}>
                just now
              </span>
            </div>

            {/* content */}
            <p style={{ marginTop: "10px" }}>
              📚 Studied <strong>{session.subject}</strong>
            </p>

            <p style={{ color: "#555" }}>
              ⏱ {session.duration} minutes
            </p>

          </div>
        ))}

      </div>
    </div>
  );
}

export default ProfilePage;
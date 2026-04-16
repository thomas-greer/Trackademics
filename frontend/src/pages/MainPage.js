import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchUsers, createUser } from "../features/usersSlice";
import { fetchSessions, createSession } from "../features/sessionsSlice";
import { Link } from "react-router-dom";
import { colors } from "../theme";

function MainPage() {
  const dispatch = useDispatch();

  const users = useSelector(state => state.users.list);
  const sessions = useSelector(state => state.sessions.list);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [duration, setDuration] = useState("");

  useEffect(() => {
    dispatch(fetchUsers());
    dispatch(fetchSessions());
  }, [dispatch]);

  const handleCreateUser = () => {
    dispatch(createUser({ username, email }));
    setUsername("");
    setEmail("");
  };

  const handleCreateSession = () => {
    dispatch(createSession({
      user: 1,
      subject,
      duration
    }));

    setSubject("");
    setDuration("");
  };

  const linkSx = { color: colors.primary, fontWeight: 600, marginRight: "16px" };

  return (
    <div style={{ padding: "28px 20px", maxWidth: "720px", margin: "0 auto", minHeight: "100vh", background: colors.white }}>
      <h1 style={{ color: colors.primary, fontWeight: 800, letterSpacing: "-0.02em" }}>Trackademic</h1>
      <p style={{ color: colors.textMuted }}>Dev tools</p>
      <Link to="/feed" style={linkSx}>Global Feed</Link>
      <Link to="/create" style={linkSx}>Add Study Session</Link>
      

      <h2>Create User</h2>
      <input value={username} onChange={e => setUsername(e.target.value)} />
      <input value={email} onChange={e => setEmail(e.target.value)} />
      <button onClick={handleCreateUser}>Add User</button>

      <h2>Users:</h2>
      {users.map(user => (
        <p key={user.id}>{user.username}</p>
      ))}

      <hr />

      <h2>Study Sessions:</h2>
      {sessions.map(session => (
        <p key={session.id}>
          {session.subject} - {session.duration}
        </p>
      ))}
    </div>
  );
}

export default MainPage;
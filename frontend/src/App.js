import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchUsers, createUser } from "./features/usersSlice";
import { fetchSessions, createSession } from "./features/sessionsSlice";
import { login } from "./features/authSlice";

function App() {
  const dispatch = useDispatch();

  // Redux state
  const users = useSelector(state => state.users.list);
  const sessions = useSelector(state => state.sessions.list);
  const currentUser = useSelector(state => state.auth.user);

  // User inputs
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  // Session inputs
  const [subject, setSubject] = useState("");
  const [duration, setDuration] = useState("");

  // Load data on start
  useEffect(() => {
    dispatch(fetchUsers());
    dispatch(fetchSessions());
  }, [dispatch]);

  // Create user (acts like "create account + login")
  const handleCreateUser = async () => {
    const result = await dispatch(createUser({ username, email }));
    dispatch(login(result.payload)); // log them in

    setUsername("");
    setEmail("");
  };

  // Create study session
  const handleCreateSession = () => {
    if (!currentUser) {
      alert("Please create an account first");
      return;
    }

    dispatch(createSession({
      user: currentUser.id,
      subject,
      duration
    }));

    setSubject("");
    setDuration("");
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Trackademic</h1>

      {/* ACCOUNT SECTION */}
      {!currentUser && (
        <>
          <h2>Create Account</h2>
          <input
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
          <input
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
          <button onClick={handleCreateUser}>Create Account</button>
        </>
      )}

      {currentUser && (
        <p>Logged in as: <strong>{currentUser.username}</strong></p>
      )}

      <hr />

      {/* CREATE SESSION */}
      {currentUser && (
        <>
          <h2>Create Study Session</h2>
          <input
            placeholder="Subject"
            value={subject}
            onChange={e => setSubject(e.target.value)}
          />
          <input
            placeholder="Duration (minutes)"
            value={duration}
            onChange={e => setDuration(e.target.value)}
          />
          <button onClick={handleCreateSession}>Add Session</button>
        </>
      )}

      <hr />

      {/* MY SESSIONS */}
      {currentUser && (
        <>
          <h2>My Study Sessions</h2>
          {sessions
            .filter(session => session.user_id === currentUser.id)
            .map(session => (
              <p key={session.id}>
                {session.subject} - {session.duration} min
              </p>
            ))}
        </>
      )}

      <hr />

      {/* GLOBAL FEED */}
      <h2>Global Feed</h2>
      {sessions.map(session => (
        <p key={session.id}>
          User {session.user} studied {session.subject} for {session.duration} min
        </p>
      ))}
    </div>
  );
}

export default App;
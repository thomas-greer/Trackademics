import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { createSession } from "../features/sessionsSlice";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";

function CreateSessionPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const reduxUser = useSelector(state => state.auth.user);
  let currentUser = reduxUser;

  if (!currentUser) {
    const storedUser = localStorage.getItem("user");
    if (storedUser && storedUser !== "undefined") {
      currentUser = JSON.parse(storedUser);
    }
  }

  const [isRunning, setIsRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [intervalId, setIntervalId] = useState(null);

  const [subject, setSubject] = useState("");
  const [caption, setCaption] = useState("");
  const [showForm, setShowForm] = useState(false);

  // ⏱ start timer
  const startTimer = () => {
    const id = setInterval(() => {
      setSeconds(prev => prev + 1);
    }, 1000);

    setIntervalId(id);
    setIsRunning(true);
  };

  // ⏹ stop timer
  const stopTimer = () => {
    clearInterval(intervalId);
    setIsRunning(false);
    setShowForm(true);
  };

  // 💾 save session
  const saveSession = () => {
    if (!currentUser) {
      alert("You must be logged in");
      return;
    }

    const minutes = Math.floor(seconds / 60);

    dispatch(createSession({
      user: currentUser.id,
      subject,
      duration: minutes,
      caption
    }));

    navigate("/feed");
  };

  return (
    <div>
      <Navbar />

      <div className="container">

        <div className="card" style={{ textAlign: "center" }}>
          <h2>Record Study Session</h2>

          <h1 style={{ fontSize: "48px" }}>
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
          </h1>

          {!isRunning && !showForm && (
            <button onClick={startTimer}>Start</button>
          )}

          {isRunning && (
            <button onClick={stopTimer}>Stop</button>
          )}
        </div>

        {/* FORM AFTER STOP */}
        {showForm && (
          <div className="card">
            <h3>Session Details</h3>

            <input
              placeholder="Subject (e.g. Math)"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />

            <input
              placeholder="Caption (what did you do?)"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />

            <button onClick={saveSession}>
              Post Session
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

export default CreateSessionPage;
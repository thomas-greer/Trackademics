import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { createSession } from "../features/sessionsSlice";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { colors } from "../theme";

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
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualMinutes, setManualMinutes] = useState("");

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

  // 💾 save session (from timer)
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

  const openPastSessionForm = () => {
    setShowManualForm(true);
    setSubject("");
    setCaption("");
    setManualMinutes("");
  };

  const cancelPastSessionForm = () => {
    setShowManualForm(false);
    setManualMinutes("");
    setSubject("");
    setCaption("");
  };

  const savePastSession = () => {
    if (!currentUser) {
      alert("You must be logged in");
      return;
    }

    const trimmedSubject = subject.trim();
    if (!trimmedSubject) {
      alert("Please enter a subject.");
      return;
    }

    const mins = Number(manualMinutes);
    if (!Number.isFinite(mins) || mins < 1) {
      alert("Please enter a duration of at least 1 minute.");
      return;
    }

    dispatch(
      createSession({
        user: currentUser.id,
        subject: trimmedSubject,
        duration: Math.floor(mins),
        caption: caption.trim(),
      })
    );

    navigate("/feed");
  };

  return (
    <div>
      <Navbar />

      <div className="container">

        <div
          className="card"
          style={{
            textAlign: "center",
            borderTop: `4px solid ${colors.accent}`,
          }}
        >
          <h2 style={{ color: colors.primary, fontWeight: 800, letterSpacing: "-0.02em", marginTop: 0 }}>
            Record Study Session
          </h2>

          {!showManualForm && (
            <h1 style={{ fontSize: "48px", color: colors.text, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
              {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
            </h1>
          )}

          {!isRunning && !showForm && !showManualForm && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
                marginTop: "8px",
              }}
            >
              <button type="button" onClick={startTimer}>
                Start Recording Session
              </button>
              <button type="button" className="btn-secondary-outline" onClick={openPastSessionForm}>
                Record Past Study Session
              </button>
            </div>
          )}

          {isRunning && (
            <button type="button" onClick={stopTimer} style={{ marginTop: "8px" }}>
              Stop
            </button>
          )}

          {showManualForm && !isRunning && (
            <div style={{ marginTop: "16px", textAlign: "left", maxWidth: "400px", marginInline: "auto" }}>
              <p style={{ color: colors.textMuted, fontSize: "14px", marginTop: 0 }}>
                Log a session you already finished — enter the duration in minutes (no timer).
              </p>

              <div style={{ marginBottom: "10px" }}>
                <label htmlFor="past-duration" style={{ display: "block", fontSize: "13px", marginBottom: "4px", color: colors.textMuted }}>
                  Duration (minutes)
                </label>
                <input
                  id="past-duration"
                  type="number"
                  min={1}
                  step={1}
                  placeholder="e.g. 45"
                  value={manualMinutes}
                  onChange={(e) => setManualMinutes(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ marginBottom: "10px" }}>
                <label htmlFor="past-subject" style={{ display: "block", fontSize: "13px", marginBottom: "4px", color: colors.textMuted }}>
                  Subject
                </label>
                <input
                  id="past-subject"
                  placeholder="e.g. Math"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label htmlFor="past-caption" style={{ display: "block", fontSize: "13px", marginBottom: "4px", color: colors.textMuted }}>
                  Caption (optional)
                </label>
                <input
                  id="past-caption"
                  placeholder="What did you work on?"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  style={{ width: "100%", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
                <button type="button" onClick={savePastSession}>
                  Post session
                </button>
                <button type="button" className="btn-secondary-muted" onClick={cancelPastSessionForm}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* FORM AFTER STOP */}
        {showForm && !showManualForm && (
          <div className="card" style={{ borderTop: `4px solid ${colors.accent}` }}>
            <h3 style={{ color: colors.primary, fontWeight: 700, marginTop: 0 }}>Session Details</h3>

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
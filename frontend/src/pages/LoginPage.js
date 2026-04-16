import { useState } from "react";
import { useDispatch } from "react-redux";
import { login } from "../features/authSlice";
import { useNavigate } from "react-router-dom";

function LoginPage() {
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!username || !password) {
      alert("Please enter username and password");
      return;
    }

    try {
      const res = await fetch("http://127.0.0.1:8000/api/users/login/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (res.ok) {
        dispatch(login(data));
        localStorage.setItem("user", JSON.stringify(data));
        navigate("/feed");
      } else {
        alert(data.error || "Login failed");
      }

    } catch (err) {
      console.error(err);
      alert("Server error");
    }
  };

  const handleCreateAccount = async () => {
    if (!email || !username || !password || !confirmPassword) {
      alert("Please complete all fields");
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    try {
      const res = await fetch("http://127.0.0.1:8000/api/users/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, username, password })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Could not create account");
        return;
      }

      alert("Account created! You can now log in.");
      setIsCreateMode(false);
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error(err);
      alert("Server error");
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Trackademic</h1>
        <p className="subtitle">Make studying social</p>

        {isCreateMode && (
          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}

        <input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {isCreateMode && (
          <input
            type="password"
            placeholder="Rewrite Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        )}

        {isCreateMode ? (
          <button onClick={handleCreateAccount}>
            Create Account
          </button>
        ) : (
          <button onClick={handleLogin}>
            Log In
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            setIsCreateMode((prev) => !prev);
            setEmail("");
            setUsername("");
            setPassword("");
            setConfirmPassword("");
          }}
          style={{
            marginTop: "10px",
            cursor: "pointer",
          }}
        >
          {isCreateMode ? "Back to Log In" : "Create Account"}
        </button>
      </div>
    </div>
  );
}

export default LoginPage;
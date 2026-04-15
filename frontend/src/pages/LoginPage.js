import { useState } from "react";
import { useDispatch } from "react-redux";
import { createUser } from "../features/usersSlice";
import { login } from "../features/authSlice";
import { useNavigate } from "react-router-dom";

function LoginPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!email) {
      alert("Please enter email");
      return;
    }

    try {
      // 🔐 Try login first
      const res = await fetch("http://127.0.0.1:8000/api/users/login/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email })
      });

      const data = await res.json();

      if (res.ok) {
        // ✅ existing user
        dispatch(login(data));
        localStorage.setItem("user", JSON.stringify(data));
        navigate("/feed");
      } else {
        // 🆕 create new user
        if (!username) {
          alert("Enter username to create account");
          return;
        }

        const result = await dispatch(createUser({ username, email }));

        if (result.payload && result.payload.id) {
          dispatch(login(result.payload));
          localStorage.setItem("user", JSON.stringify(result.payload));
          navigate("/feed");
        } else {
          alert("Error creating account");
        }
      }

    } catch (err) {
      console.error(err);
      alert("Server error");
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 style={{ color: "#1f3b73" }}>Trackademic</h1>
        <p className="subtitle">Make studying social 📚</p>

        <input
          placeholder="Username (only needed for signup)"
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          placeholder="Email"
          onChange={(e) => setEmail(e.target.value)}
        />

        <button onClick={handleLogin}>
          Continue
        </button>
      </div>
    </div>
  );
}

export default LoginPage;
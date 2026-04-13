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
    const result = await dispatch(createUser({ username, email }));

    if (result.payload && result.payload.id) {
      dispatch(login(result.payload));
      localStorage.setItem("user", JSON.stringify(result.payload));
      navigate("/feed");
    } else {
      alert("Error creating account");
    }
  };

  return (
    <div className="login-page">

      <div className="login-card">
        <h1>Trackademic</h1>
        <p className="subtitle">Making studying fun</p>

        <input
          placeholder="Username"
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          placeholder="Email"
          onChange={(e) => setEmail(e.target.value)}
        />

        <button onClick={handleLogin}>
          Get Started
        </button>
      </div>

    </div>
  );
}

export default LoginPage;
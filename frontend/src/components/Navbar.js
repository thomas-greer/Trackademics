import { NavLink, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { logout } from "../features/authSlice";

function Navbar() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = () => {
    dispatch(logout());
    localStorage.removeItem("user");
    navigate("/");
  };

  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "12px 28px",
      margin: "14px auto 0",
      maxWidth: "1120px",
      borderRadius: "16px",
      backgroundColor: "#ffffff",
      border: "1px solid #eee",
      boxShadow: "0 6px 16px rgba(0,0,0,0.08)"
    }}>
      <h2 style={{ margin: 0, color: "#ff5a5f", letterSpacing: "0.3px" }}>
        Trackademic
      </h2>
  
      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        <NavLink
          to="/feed"
          style={({ isActive }) => ({
            textDecoration: "none",
            padding: "8px 14px",
            borderRadius: "999px",
            fontWeight: 600,
            color: isActive ? "#ffffff" : "#444",
            backgroundColor: isActive ? "#ff5a5f" : "transparent",
            transition: "all 0.2s ease",
          })}
        >
          Feed
        </NavLink>
        <NavLink
          to="/create"
          style={({ isActive }) => ({
            textDecoration: "none",
            padding: "8px 14px",
            borderRadius: "999px",
            fontWeight: 600,
            color: isActive ? "#ffffff" : "#444",
            backgroundColor: isActive ? "#ff5a5f" : "transparent",
            transition: "all 0.2s ease",
          })}
        >
          Record
        </NavLink>
        <NavLink
          to="/profile"
          style={({ isActive }) => ({
            textDecoration: "none",
            padding: "8px 14px",
            borderRadius: "999px",
            fontWeight: 600,
            color: isActive ? "#ffffff" : "#444",
            backgroundColor: isActive ? "#ff5a5f" : "transparent",
            transition: "all 0.2s ease",
          })}
        >
          Profile
        </NavLink>
        <button
          onClick={handleLogout}
          style={{
            marginLeft: "8px",
            padding: "8px 14px",
            borderRadius: "999px",
            fontWeight: 600
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}

export default Navbar;
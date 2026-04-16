import { NavLink, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { logout } from "../features/authSlice";
import NavbarUserSearch from "./NavbarUserSearch";
import { useTheme } from "./ThemeProvider";
import { colors, shadows, radius } from "../theme";

function Navbar() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = () => {
    dispatch(logout());
    localStorage.removeItem("user");
    navigate("/");
  };

  const linkBase = {
    textDecoration: "none",
    padding: "9px 16px",
    borderRadius: radius.pill,
    fontWeight: 600,
    fontSize: "14px",
    transition: "background-color 0.15s ease, color 0.15s ease",
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(120px, auto) minmax(0, 1fr) minmax(220px, auto)",
        alignItems: "center",
        gap: "16px",
        padding: "14px 28px",
        margin: "16px auto 0",
        maxWidth: "1180px",
        borderRadius: radius.lg,
        backgroundColor: colors.white,
        border: `1px solid ${colors.cardBorder}`,
        boxShadow: shadows.nav,
      }}
    >
      <h2
        style={{
          margin: 0,
          color: colors.primary,
          letterSpacing: "-0.02em",
          fontWeight: 800,
          fontSize: "22px",
          whiteSpace: "nowrap",
        }}
      >
        Trackademic
      </h2>

      <div style={{ justifySelf: "center", width: "100%", minWidth: 0, maxWidth: 400 }}>
        <NavbarUserSearch />
      </div>

      <div
        style={{
          display: "flex",
          gap: "8px",
          alignItems: "center",
          justifySelf: "end",
          flexWrap: "wrap",
          justifyContent: "flex-end",
        }}
      >
        <NavLink
          to="/feed"
          style={({ isActive }) => ({
            ...linkBase,
            color: isActive ? colors.white : colors.textMuted,
            backgroundColor: isActive ? colors.primary : "transparent",
            boxShadow: isActive ? `0 2px 12px ${colors.primaryMuted}` : "none",
          })}
        >
          Feed
        </NavLink>
        <NavLink
          to="/create"
          style={({ isActive }) => ({
            ...linkBase,
            color: isActive ? colors.white : colors.textMuted,
            backgroundColor: isActive ? colors.primary : "transparent",
            boxShadow: isActive ? `0 2px 12px ${colors.primaryMuted}` : "none",
          })}
        >
          Record
        </NavLink>
        <NavLink
          to="/profile"
          style={({ isActive }) => ({
            ...linkBase,
            color: isActive ? colors.white : colors.textMuted,
            backgroundColor: isActive ? colors.primary : "transparent",
            boxShadow: isActive ? `0 2px 12px ${colors.primaryMuted}` : "none",
          })}
        >
          Profile
        </NavLink>
        <button
          type="button"
          onClick={toggleTheme}
          style={{
            padding: "9px 14px",
            borderRadius: radius.pill,
            fontWeight: 600,
            fontSize: "13px",
            border: `1px solid ${colors.cardBorder}`,
            background: colors.card,
            color: colors.text,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
          title="Toggle dark mode"
        >
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
        <button
          type="button"
          className="nav-logout-btn"
          onClick={handleLogout}
          style={{
            marginLeft: "4px",
            padding: "9px 16px",
            borderRadius: radius.pill,
            fontWeight: 600,
            fontSize: "14px",
            border: `2px solid ${colors.primary}`,
            background: colors.white,
            color: colors.primary,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}

export default Navbar;

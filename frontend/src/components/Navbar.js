import { useCallback, useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../features/authSlice";
import NavbarUserSearch from "./NavbarUserSearch";
import { useTheme } from "./ThemeProvider";
import { colors, shadows, radius } from "../theme";

function Navbar() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const reduxUser = useSelector((state) => state.auth.user);
  let user = reduxUser;
  if (!user) {
    const raw = localStorage.getItem("user");
    if (raw && raw !== "undefined") user = JSON.parse(raw);
  }
  const userId = user?.id;
  const isAdmin = user?.username === "admin" && user?.email === "admin@gmail.com";
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifData, setNotifData] = useState({ unread_count: 0, notifications: [] });

  const loadNotifications = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/users/notifications/?user_id=${userId}`);
      const data = await res.json();
      if (res.ok) setNotifData(data);
    } catch {
      /* ignore */
    }
  }, [userId]);

  useEffect(() => {
    loadNotifications();
    const id = setInterval(loadNotifications, 15000);
    return () => clearInterval(id);
  }, [loadNotifications]);

  const handleLogout = () => {
    dispatch(logout());
    localStorage.removeItem("user");
    navigate("/");
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return "";
    const now = new Date();
    const then = new Date(timestamp);
    const sec = Math.floor((now - then) / 1000);
    if (sec < 60) return "just now";
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
    return then.toLocaleDateString();
  };

  const markAllNotificationsRead = async () => {
    if (!userId) return;
    try {
      await fetch("http://127.0.0.1:8000/api/users/notifications/mark-read/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      setNotifData((prev) => ({
        ...prev,
        unread_count: 0,
        notifications: (prev.notifications || []).map((n) => ({ ...n, is_read: true })),
      }));
    } catch {
      /* ignore */
    }
  };

  const openNotificationTarget = async (n) => {
    if (!userId) return;
    try {
      await fetch("http://127.0.0.1:8000/api/users/notifications/mark-read/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, notification_id: n.id }),
      });
    } catch {
      /* ignore */
    }
    setNotifData((prev) => ({
      ...prev,
      unread_count: Math.max(0, (prev.unread_count || 0) - (n.is_read ? 0 : 1)),
      notifications: prev.notifications.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)),
    }));
    setNotifOpen(false);
    if (n.conversation_id) navigate("/messages");
    else navigate("/feed");
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
        gridTemplateColumns: "minmax(120px, auto) minmax(0, 1fr) minmax(320px, auto)",
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
        {!isAdmin && (
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
        )}
        {!isAdmin && (
          <NavLink
            to="/messages"
            style={({ isActive }) => ({
              ...linkBase,
              color: isActive ? colors.white : colors.textMuted,
              backgroundColor: isActive ? colors.primary : "transparent",
              boxShadow: isActive ? `0 2px 12px ${colors.primaryMuted}` : "none",
            })}
          >
            Study Groups
          </NavLink>
        )}
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
        {isAdmin && (
          <NavLink
            to="/admin"
            style={({ isActive }) => ({
              ...linkBase,
              color: isActive ? colors.white : colors.textMuted,
              backgroundColor: isActive ? colors.primary : "transparent",
              boxShadow: isActive ? `0 2px 12px ${colors.primaryMuted}` : "none",
            })}
          >
            Admin
          </NavLink>
        )}
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => setNotifOpen((v) => !v)}
            style={{
              position: "relative",
              padding: "4px",
              borderRadius: radius.pill,
              border: "none",
              background: "transparent",
              color: colors.text,
              fontSize: "16px",
              lineHeight: 1,
              cursor: "pointer",
            }}
            title="Notifications"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M15 18H5C5 18 6.2 16.8 6.2 14.4V10.8C6.2 7.8 8 5.4 11 4.7V4.2C11 3.54 11.54 3 12.2 3C12.86 3 13.4 3.54 13.4 4.2V4.7C16.4 5.4 18.2 7.8 18.2 10.8V14.4C18.2 16.8 19.4 18 19.4 18H15Z"
                stroke={colors.primary}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M10.3 20C10.55 20.73 11.23 21.2 12 21.2C12.77 21.2 13.45 20.73 13.7 20"
                stroke={colors.primary}
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            {notifData.unread_count > 0 && (
              <span style={{
                position: "absolute",
                top: "-5px",
                right: "-5px",
                minWidth: "18px",
                height: "18px",
                borderRadius: "50%",
                background: colors.accent,
                color: colors.primary,
                fontSize: "11px",
                fontWeight: 800,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0 4px",
                border: `1px solid ${colors.accentHover}`,
              }}>
                {notifData.unread_count}
              </span>
            )}
          </button>
          {notifOpen && (
            <div style={{
              position: "absolute",
              right: 0,
              top: "calc(100% + 8px)",
              width: 320,
              maxHeight: 360,
              overflowY: "auto",
              background: colors.white,
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: radius.md,
              boxShadow: shadows.md,
              zIndex: 1000,
              padding: 8,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", gap: "8px" }}>
                <div style={{ fontWeight: 700, color: colors.primary }}>Notifications</div>
                {!!notifData.unread_count && (
                  <button
                    type="button"
                    onClick={markAllNotificationsRead}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: colors.primary,
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    Mark all as read
                  </button>
                )}
              </div>
              {notifData.notifications?.length ? notifData.notifications.map((n) => (
                <button key={n.id} type="button" onClick={() => openNotificationTarget(n)} style={{
                  width: "100%",
                  textAlign: "left",
                  border: "none",
                  background: n.is_read ? "transparent" : colors.accentMuted,
                  color: colors.text,
                  padding: "8px",
                  borderRadius: radius.sm,
                  marginBottom: "4px",
                }}>
                  <div style={{ fontSize: "13px" }}>{n.text}</div>
                  <div style={{ fontSize: "11px", color: colors.textSubtle, marginTop: "2px" }}>
                    {formatTimeAgo(n.created_at)}
                  </div>
                </button>
              )) : <p style={{ color: colors.textMuted, fontSize: "13px", margin: "8px" }}>No notifications yet.</p>}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          style={{
            width: "48px",
            height: "28px",
            borderRadius: radius.pill,
            border: `1px solid ${colors.cardBorder}`,
            background: theme === "dark" ? colors.primary : colors.card,
            padding: "2px",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: theme === "dark" ? "flex-end" : "flex-start",
            transition: "all 0.18s ease",
          }}
          title="Toggle dark mode"
        >
          <span
            style={{
              width: "22px",
              height: "22px",
              borderRadius: "50%",
              background: colors.white,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              lineHeight: 1,
            }}
          >
            {theme === "dark" ? "🌙" : "☀️"}
          </span>
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

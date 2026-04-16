import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import UserAvatar from "./UserAvatar";
import { colors, radius, shadows } from "../theme";

const API_BASE = "http://127.0.0.1:8000/api/users";

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function NavbarUserSearch() {
  const navigate = useNavigate();
  const reduxUser = useSelector((state) => state.auth.user);
  let currentUser = reduxUser;
  if (!currentUser) {
    const raw = localStorage.getItem("user");
    if (raw && raw !== "undefined") {
      try {
        currentUser = JSON.parse(raw);
      } catch {
        currentUser = null;
      }
    }
  }
  const viewerId = toNumber(currentUser?.id);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      setLoading(false);
      return;
    }

    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${API_BASE}/?viewer_id=${viewerId || ""}&search=${encodeURIComponent(q)}`
        );
        let data;
        try {
          data = await res.json();
        } catch {
          data = null;
        }
        setResults(Array.isArray(data) ? data : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => clearTimeout(handle);
  }, [query, viewerId]);

  const pickUser = (id) => {
    navigate(`/profile/${id}`);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const showPanel = open && query.trim().length >= 1;

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", maxWidth: 380 }}>
      <input
        type="search"
        placeholder="Search users…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        aria-label="Search users by username"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "10px 16px",
          borderRadius: radius.pill,
          border: `1px solid ${colors.cardBorder}`,
          fontSize: "14px",
          outline: "none",
          background: colors.card,
          color: colors.text,
          boxShadow: "inset 0 1px 2px rgba(78, 89, 140, 0.06)",
        }}
      />
      {showPanel && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "calc(100% + 8px)",
            maxHeight: "280px",
            overflowY: "auto",
            background: colors.white,
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: radius.md,
            boxShadow: shadows.md,
            zIndex: 50,
            textAlign: "left",
          }}
        >
          {loading && (
            <div style={{ padding: "12px 14px", color: colors.textMuted, fontSize: "13px" }}>
              Searching…
            </div>
          )}
          {!loading && results.length === 0 && (
            <div style={{ padding: "12px 14px", color: colors.textMuted, fontSize: "13px" }}>
              No users match that search.
            </div>
          )}
          {!loading &&
            results.map((u) => (
              <button
                key={u.id}
                type="button"
                className="nav-search-hit"
                onClick={() => pickUser(u.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  width: "100%",
                  textAlign: "left",
                  padding: "11px 14px",
                  border: "none",
                  borderBottom: `1px solid ${colors.borderSubtle}`,
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: "14px",
                  color: colors.text,
                  fontFamily: "inherit",
                  borderRadius: 0,
                  margin: 0,
                }}
              >
                <UserAvatar avatarUrl={u.avatar_url} username={u.username} size={34} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600 }}>{u.username}</span>
                  <span style={{ color: colors.textSubtle, fontSize: "12px", marginLeft: "8px" }}>
                    View profile
                  </span>
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

export default NavbarUserSearch;

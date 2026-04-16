import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { fetchSessions, deleteSession } from "../features/sessionsSlice";
import { updateUser } from "../features/authSlice";
import Navbar from "../components/Navbar";
import ProfileAnalyticsCharts from "../components/ProfileAnalyticsCharts";
import UserAvatar from "../components/UserAvatar";
import { colors, shadows, radius } from "../theme";

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function ProfilePage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { userId } = useParams();
  const sessions = useSelector(state => state.sessions.list);

  let authUser = useSelector(state => state.auth.user);

  if (!authUser) {
    const storedUser = localStorage.getItem("user");
    if (storedUser && storedUser !== "undefined") {
      authUser = JSON.parse(storedUser);
    }
  }

  const [profileUser, setProfileUser] = useState(null);
  const [streaks, setStreaks] = useState({
    current: 0,
    best: 0
  });
  const [followCounts, setFollowCounts] = useState({
    followers: 0,
    following: 0
  });
  const [isFollowing, setIsFollowing] = useState(false);
  const [isUpdatingFollow, setIsUpdatingFollow] = useState(false);
  const [connectionsModal, setConnectionsModal] = useState({
    isOpen: false,
    type: "followers",
    users: [],
    loading: false,
  });
  const [studyAnalytics, setStudyAnalytics] = useState(null);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editAvatarFile, setEditAvatarFile] = useState(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState(null);
  const [editSaving, setEditSaving] = useState(false);

  const viewerId = toNumber(authUser?.id);
  const targetUserId = useMemo(
    () => toNumber(userId || authUser?.id),
    [userId, authUser?.id]
  );
  const isOwnProfile = viewerId && targetUserId && viewerId === targetUserId;
  const displayUsername =
    profileUser?.username ||
    (isOwnProfile ? authUser?.username : null) ||
    (targetUserId ? `User ${targetUserId}` : "Profile");

  const headerAvatarUrl =
    profileUser?.avatar_url ||
    (isOwnProfile ? authUser?.avatar_url : "") ||
    "";

  useEffect(() => {
    if (targetUserId > 0) {
      dispatch(fetchSessions({ authorId: targetUserId }));
    }
  }, [dispatch, targetUserId]);

  useEffect(() => {
    if (!targetUserId) {
      setProfileUser(null);
      setStreaks({ current: 0, best: 0 });
      setFollowCounts({ followers: 0, following: 0 });
      setIsFollowing(false);
      return;
    }

    const loadProfile = async () => {
      try {
        const profileRes = await fetch(
          `http://127.0.0.1:8000/api/users/${targetUserId}/?viewer_id=${viewerId || ""}`
        );

        if (!profileRes.ok) {
          throw new Error(`Profile endpoint failed with ${profileRes.status}`);
        }

        const profile = await profileRes.json();
        if (!profile?.username) {
          throw new Error("Profile payload missing username");
        }

        setProfileUser(profile);
        setStreaks({
          current: toNumber(profile?.stats?.current_streak),
          best: toNumber(profile?.stats?.best_streak)
        });
        setFollowCounts({
          followers: toNumber(profile?.followers_count),
          following: toNumber(profile?.following_count)
        });
        setIsFollowing(Boolean(profile?.is_following));
      } catch (error) {
        console.error("Failed to load profile endpoint, trying users list", error);

        try {
          const usersRes = await fetch(
            `http://127.0.0.1:8000/api/users/?viewer_id=${viewerId || ""}`
          );

          if (!usersRes.ok) {
            throw new Error(`Users endpoint failed with ${usersRes.status}`);
          }

          const users = await usersRes.json();
          const fallbackUser = users.find(
            (u) => toNumber(u?.id) === targetUserId
          );

          if (!fallbackUser) {
            throw new Error("Could not find user in users list");
          }

          setProfileUser(fallbackUser);
          setStreaks({
            current: toNumber(fallbackUser?.stats?.current_streak),
            best: toNumber(fallbackUser?.stats?.best_streak)
          });
          setFollowCounts({
            followers: toNumber(fallbackUser?.followers_count),
            following: toNumber(fallbackUser?.following_count)
          });
          setIsFollowing(Boolean(fallbackUser?.is_following));
        } catch (fallbackError) {
          console.error("Failed to load fallback profile data", fallbackError);
          setProfileUser(null);
          setStreaks({ current: 0, best: 0 });
          setFollowCounts({ followers: 0, following: 0 });
          setIsFollowing(false);
        }
      }
    };

    loadProfile();
  }, [targetUserId, viewerId]);

  useEffect(() => {
    if (!targetUserId) {
      setStudyAnalytics(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `http://127.0.0.1:8000/api/users/${targetUserId}/study-analytics/`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.last_7_days) setStudyAnalytics(data);
      } catch {
        if (!cancelled) setStudyAnalytics(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetUserId, sessions.length]);

  const handleFollowToggle = async () => {
    if (!viewerId || !targetUserId || isOwnProfile || isUpdatingFollow) return;

    setIsUpdatingFollow(true);
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/users/${targetUserId}/follow/`,
        {
          method: isFollowing ? "DELETE" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ follower_id: viewerId }),
        }
      );

      const raw = await res.text();
      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { error: raw || "Unexpected response format from server." };
      }

      if (!res.ok) {
        alert(data.error || "Could not update follow status.");
        return;
      }

      setFollowCounts({
        followers: toNumber(data.followers_count),
        following: toNumber(data.following_count)
      });
      setIsFollowing(Boolean(data.is_following));
    } catch (error) {
      console.error(error);
      alert("Server error while updating follow status.");
    } finally {
      setIsUpdatingFollow(false);
    }
  };

  const openConnectionsModal = async (type) => {
    if (!targetUserId) return;

    setConnectionsModal({
      isOpen: true,
      type,
      users: [],
      loading: true,
    });

    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/users/${targetUserId}/connections/?type=${type}`
      );
      const raw = await res.text();
      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { error: raw || "Unexpected response format from server." };
      }

      if (!res.ok) {
        alert(data.error || "Could not load connections.");
        setConnectionsModal((prev) => ({ ...prev, loading: false }));
        return;
      }

      setConnectionsModal({
        isOpen: true,
        type,
        users: Array.isArray(data.users) ? data.users : [],
        loading: false,
      });
    } catch (error) {
      console.error(error);
      alert("Server error while loading connections.");
      setConnectionsModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const closeConnectionsModal = () => {
    setConnectionsModal({
      isOpen: false,
      type: "followers",
      users: [],
      loading: false,
    });
  };

  const openEditProfile = () => {
    const u = profileUser?.username || authUser?.username || "";
    const e = profileUser?.email || authUser?.email || "";
    setEditUsername(u);
    setEditEmail(e);
    setEditAvatarFile(null);
    if (editAvatarPreview) {
      URL.revokeObjectURL(editAvatarPreview);
    }
    setEditAvatarPreview(null);
    setEditProfileOpen(true);
  };

  const closeEditProfile = () => {
    setEditProfileOpen(false);
    setEditAvatarFile(null);
    if (editAvatarPreview) {
      URL.revokeObjectURL(editAvatarPreview);
    }
    setEditAvatarPreview(null);
  };

  const handleEditAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (editAvatarPreview) {
      URL.revokeObjectURL(editAvatarPreview);
    }
    setEditAvatarFile(file);
    setEditAvatarPreview(URL.createObjectURL(file));
  };

  const handleSaveProfile = async () => {
    if (!viewerId) {
      alert("You must be logged in to edit your profile.");
      return;
    }
    setEditSaving(true);
    try {
      const fd = new FormData();
      fd.append("viewer_id", String(viewerId));
      fd.append("username", editUsername.trim());
      fd.append("email", editEmail.trim());
      if (editAvatarFile) {
        fd.append("avatar", editAvatarFile);
      }

      const res = await fetch(
        `http://127.0.0.1:8000/api/users/${viewerId}/edit-profile/`,
        { method: "POST", body: fd }
      );

      const raw = await res.text();
      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { error: raw || "Unexpected response from server." };
      }

      if (!res.ok) {
        alert(data.error || "Could not save profile.");
        return;
      }

      setProfileUser((prev) => ({ ...(prev || {}), ...data }));
      const merged = { ...(authUser || {}), ...data };
      dispatch(updateUser(data));
      localStorage.setItem("user", JSON.stringify(merged));
      closeEditProfile();
    } catch (err) {
      console.error(err);
      alert("Server error while saving profile.");
    } finally {
      setEditSaving(false);
    }
  };

  const handleConnectionClick = (selectedUserId) => {
    closeConnectionsModal();
    navigate(`/profile/${selectedUserId}`);
  };

  const handleDeleteSession = async (sessionId) => {
    if (!viewerId) return;
    if (!window.confirm("Delete this post? This cannot be undone.")) return;
    try {
      await dispatch(
        deleteSession({ sessionId, userId: viewerId })
      ).unwrap();
    } catch (err) {
      alert(err?.message || "Could not delete post.");
    }
  };

  const userSessions = sessions.filter(
    s =>
      toNumber(s.user_id) === targetUserId ||
      s.user === profileUser?.username
  );

  const totalMinutes = userSessions.reduce(
    (sum, s) => sum + Number(s.duration || 0),
    0
  );

  // timestamp formatter
  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return "just now";

    const now = new Date();
    const past = new Date(timestamp);
    const diff = Math.floor((now - past) / 1000);

    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;

    return past.toLocaleDateString();
  };

  return (
    <div>
      <Navbar />

      <div className="container" style={{ paddingBottom: "48px" }}>

        {/* PROFILE HEADER */}
        <div className="card" style={{ textAlign: "center", borderTop: `4px solid ${colors.accent}` }}>
          <div style={{ margin: "0 auto 12px auto", width: "72px", height: "72px" }}>
            <UserAvatar
              avatarUrl={headerAvatarUrl}
              username={displayUsername}
              size={72}
              style={{ boxShadow: `0 6px 20px ${colors.primaryMuted}` }}
            />
          </div>

          <h2 style={{ color: colors.text, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 4px" }}>{displayUsername}</h2>

          {isOwnProfile && viewerId > 0 && (
            <button
              type="button"
              onClick={openEditProfile}
              style={{ marginTop: "10px" }}
            >
              Edit Profile
            </button>
          )}

          {!isOwnProfile && targetUserId > 0 && (
            <button
              type="button"
              onClick={handleFollowToggle}
              disabled={isUpdatingFollow}
              style={{ marginTop: "10px" }}
            >
              {isFollowing ? "Following" : "Follow"}
            </button>
          )}

          {/* 🔥 STREAKS */}
          <div style={{ marginTop: "10px" }}>
            <p style={{ fontWeight: "600" }}>
              Current Streak: {streaks.current} days
            </p>
            <p style={{ color: colors.textSubtle, fontSize: "14px" }}>
              Best Streak: {streaks.best} days
            </p>
          </div>

          <div style={{ color: colors.textMuted, marginTop: "10px", display: "flex", justifyContent: "center", gap: "14px" }}>
            <span style={countLink} onClick={() => openConnectionsModal("followers")}>
              Followers: {followCounts.followers}
            </span>
            <span>•</span>
            <span style={countLink} onClick={() => openConnectionsModal("following")}>
              Following: {followCounts.following}
            </span>
          </div>

          {/* STATS */}
          <p style={{ color: colors.textMuted, marginTop: "10px", fontSize: "15px" }}>
            📚 {userSessions.length} sessions • ⏱ {totalMinutes} minutes studied
          </p>
        </div>

        {studyAnalytics && <ProfileAnalyticsCharts analytics={studyAnalytics} />}

        {/* USER POSTS */}
        <h2 style={{
          marginTop: "24px",
          color: colors.primary,
          fontWeight: 800,
          fontSize: "22px",
          letterSpacing: "-0.02em",
        }}>
          {isOwnProfile ? "My Activity" : `${displayUsername}'s Activity`}
        </h2>

        {userSessions.length === 0 && (
          <p style={{ color: colors.textMuted }}>No study sessions yet</p>
        )}

        {userSessions.map(session => (
          <div className="card" key={session.id}>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>{displayUsername}</strong>

              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ color: colors.textSubtle, fontSize: "12px" }}>
                  {formatTimeAgo(session.created_at)}
                </span>
                {isOwnProfile && viewerId > 0 && (
                  <button
                    type="button"
                    className="delete-soft-btn"
                    onClick={() => handleDeleteSession(session.id)}
                    style={deletePostButton}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>

            <p style={{ marginTop: "10px" }}>
              📚 Studied <strong>{session.subject}</strong>
            </p>

            <p style={{ color: colors.textMuted }}>
              ⏱ {session.duration} minutes
            </p>

            {session.caption && (
              <p style={{ marginTop: "5px", fontStyle: "italic" }}>
                {session.caption}
              </p>
            )}

          </div>
        ))}

      </div>

      {editProfileOpen && (
        <div style={modalOverlay} onClick={closeEditProfile}>
          <div style={editProfileModalCard} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <h3 style={{ margin: 0, color: colors.primary, fontWeight: 800 }}>Edit profile</h3>
              <button type="button" className="modal-close-btn" onClick={closeEditProfile} style={closeButton}>
                ×
              </button>
            </div>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
              <UserAvatar
                avatarUrl={editAvatarPreview || headerAvatarUrl}
                username={editUsername || displayUsername}
                size={88}
                style={{ boxShadow: `0 6px 20px ${colors.primaryMuted}` }}
              />
            </div>
            <label style={editLabel} htmlFor="edit-avatar">Profile picture</label>
            <input
              id="edit-avatar"
              type="file"
              accept="image/*"
              onChange={handleEditAvatarChange}
              style={{ marginBottom: "14px", fontSize: "13px", width: "100%" }}
            />
            <label style={editLabel} htmlFor="edit-username">Username</label>
            <input
              id="edit-username"
              value={editUsername}
              onChange={(e) => setEditUsername(e.target.value)}
              style={editInput}
            />
            <label style={editLabel} htmlFor="edit-email">Email</label>
            <input
              id="edit-email"
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              style={editInput}
            />
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "18px" }}>
              <button type="button" className="btn-secondary-muted" onClick={closeEditProfile} disabled={editSaving}>
                Cancel
              </button>
              <button type="button" onClick={handleSaveProfile} disabled={editSaving}>
                {editSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {connectionsModal.isOpen && (
        <div style={modalOverlay} onClick={closeConnectionsModal}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <h3 style={{ margin: 0, color: colors.primary, fontWeight: 800 }}>
                {connectionsModal.type === "followers" ? "Followers" : "Following"}
              </h3>
              <button type="button" className="modal-close-btn" onClick={closeConnectionsModal} style={closeButton}>×</button>
            </div>

            {connectionsModal.loading ? (
              <p>Loading...</p>
            ) : connectionsModal.users.length === 0 ? (
              <p style={{ color: colors.textMuted }}>
                No {connectionsModal.type} yet.
              </p>
            ) : (
              connectionsModal.users.map((connectionUser) => (
                <div
                  key={connectionUser.id}
                  style={connectionRow}
                  onClick={() => handleConnectionClick(connectionUser.id)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <UserAvatar
                      avatarUrl={connectionUser.avatar_url}
                      username={connectionUser.username}
                      size={32}
                    />
                    <span>{connectionUser.username}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const countLink = {
  cursor: "pointer",
  textDecoration: "none",
  color: colors.primary,
  fontWeight: 600,
  borderBottom: `2px solid ${colors.accent}`,
  paddingBottom: "1px",
};

const modalOverlay = {
  position: "fixed",
  inset: 0,
  backgroundColor: colors.overlay,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalCard = {
  width: "360px",
  maxHeight: "70vh",
  overflowY: "auto",
  backgroundColor: colors.white,
  borderRadius: radius.lg,
  padding: "20px",
  boxShadow: shadows.md,
  border: `1px solid ${colors.cardBorder}`,
  borderTop: `4px solid ${colors.accent}`,
};

const editProfileModalCard = {
  ...modalCard,
  width: "400px",
  textAlign: "left",
};

const editLabel = {
  display: "block",
  fontSize: "13px",
  fontWeight: 600,
  color: colors.textMuted,
  marginBottom: "4px",
};

const editInput = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  marginBottom: "12px",
  borderRadius: radius.sm,
  border: `1px solid ${colors.cardBorder}`,
  fontSize: "14px",
};

const modalHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "12px",
};

const closeButton = {
  border: "none",
  background: "transparent",
  fontSize: "22px",
  cursor: "pointer",
  color: colors.textMuted,
  padding: 0,
  lineHeight: 1,
};

const connectionRow = {
  padding: "11px 8px",
  borderBottom: `1px solid ${colors.borderSubtle}`,
  cursor: "pointer",
  borderRadius: radius.sm,
};

const deletePostButton = {
  padding: "5px 12px",
  fontSize: "13px",
  borderRadius: radius.sm,
  border: `1px solid ${colors.border}`,
  background: colors.white,
  color: colors.danger,
  cursor: "pointer",
  fontWeight: 600,
};

export default ProfilePage;
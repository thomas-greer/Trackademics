import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { fetchSessions } from "../features/sessionsSlice";
import Navbar from "../components/Navbar";

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

  useEffect(() => {
    dispatch(fetchSessions());
  }, [dispatch]);

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

  const handleConnectionClick = (selectedUserId) => {
    closeConnectionsModal();
    navigate(`/profile/${selectedUserId}`);
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

      <div className="container">

        {/* PROFILE HEADER */}
        <div className="card" style={{ textAlign: "center" }}>
          <div style={{
            width: "70px",
            height: "70px",
            borderRadius: "50%",
            backgroundColor: "#1f3b73",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "24px",
            margin: "0 auto 10px auto"
          }}>
            {profileUser?.username?.[0]?.toUpperCase()}
          </div>

          <h2>{displayUsername}</h2>

          {!isOwnProfile && targetUserId > 0 && (
            <button
              onClick={handleFollowToggle}
              disabled={isUpdatingFollow}
              style={{ marginTop: "8px" }}
            >
              {isFollowing ? "Following" : "Follow"}
            </button>
          )}

          {/* 🔥 STREAKS */}
          <div style={{ marginTop: "10px" }}>
            <p style={{ fontWeight: "600" }}>
              Current Streak: {streaks.current} days
            </p>
            <p style={{ color: "#888", fontSize: "14px" }}>
              Best Streak: {streaks.best} days
            </p>
          </div>

          <div style={{ color: "#555", marginTop: "10px", display: "flex", justifyContent: "center", gap: "14px" }}>
            <span style={countLink} onClick={() => openConnectionsModal("followers")}>
              Followers: {followCounts.followers}
            </span>
            <span>•</span>
            <span style={countLink} onClick={() => openConnectionsModal("following")}>
              Following: {followCounts.following}
            </span>
          </div>

          {/* STATS */}
          <p style={{ color: "#555", marginTop: "10px" }}>
            📚 {userSessions.length} sessions • ⏱ {totalMinutes} minutes studied
          </p>
        </div>

        {/* USER POSTS */}
        <h2 style={{ marginTop: "20px" }}>
          {isOwnProfile ? "My Activity" : `${displayUsername}'s Activity`}
        </h2>

        {userSessions.length === 0 && (
          <p>No study sessions yet</p>
        )}

        {userSessions.map(session => (
          <div className="card" key={session.id}>

            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>{displayUsername}</strong>

              <span style={{ color: "gray", fontSize: "12px" }}>
                {formatTimeAgo(session.created_at)}
              </span>
            </div>

            <p style={{ marginTop: "10px" }}>
              📚 Studied <strong>{session.subject}</strong>
            </p>

            <p style={{ color: "#555" }}>
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

      {connectionsModal.isOpen && (
        <div style={modalOverlay} onClick={closeConnectionsModal}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <h3 style={{ margin: 0 }}>
                {connectionsModal.type === "followers" ? "Followers" : "Following"}
              </h3>
              <button onClick={closeConnectionsModal} style={closeButton}>×</button>
            </div>

            {connectionsModal.loading ? (
              <p>Loading...</p>
            ) : connectionsModal.users.length === 0 ? (
              <p style={{ color: "#666" }}>
                No {connectionsModal.type} yet.
              </p>
            ) : (
              connectionsModal.users.map((connectionUser) => (
                <div
                  key={connectionUser.id}
                  style={connectionRow}
                  onClick={() => handleConnectionClick(connectionUser.id)}
                >
                  👤 {connectionUser.username}
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
  textDecoration: "underline",
  textUnderlineOffset: "2px",
};

const modalOverlay = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0, 0, 0, 0.35)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalCard = {
  width: "360px",
  maxHeight: "70vh",
  overflowY: "auto",
  backgroundColor: "#fff",
  borderRadius: "14px",
  padding: "16px",
  boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
};

const modalHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "10px",
};

const closeButton = {
  border: "none",
  background: "transparent",
  fontSize: "20px",
  cursor: "pointer",
  color: "#555",
  padding: 0,
};

const connectionRow = {
  padding: "10px 8px",
  borderBottom: "1px solid #f0f0f0",
  cursor: "pointer",
};

export default ProfilePage;
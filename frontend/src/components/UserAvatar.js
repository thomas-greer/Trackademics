import { colors } from "../theme";

function UserAvatar({ avatarUrl, username, size = 40, style }) {
  const letter = (username || "?")[0]?.toUpperCase() || "?";
  const dim = {
    width: size,
    height: size,
    minWidth: size,
    minHeight: size,
    borderRadius: "50%",
    flexShrink: 0,
    ...style,
  };

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        style={{
          ...dim,
          objectFit: "cover",
          boxShadow: `0 2px 8px ${colors.primaryMuted}`,
          ...style,
        }}
      />
    );
  }

  return (
    <div
      style={{
        ...dim,
        background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primarySoft} 100%)`,
        color: colors.white,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: Math.max(12, Math.round(size * 0.38)),
        boxShadow: `0 2px 8px ${colors.primaryMuted}`,
        ...style,
      }}
    >
      {letter}
    </div>
  );
}

export default UserAvatar;

import { useEffect, useMemo, useRef, useState } from "react";
import { SCHOOLS } from "../constants/schools";
import { colors, radius, shadows } from "../theme";

function SchoolSelect({ id, value, onChange, placeholder = "Search school..." }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || "");
  const wrapRef = useRef(null);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = (query || "").trim().toLowerCase();
    if (!q) return SCHOOLS;
    return SCHOOLS.filter((s) => s.name.toLowerCase().includes(q));
  }, [query]);

  const chooseSchool = (schoolName) => {
    onChange(schoolName);
    setQuery(schoolName);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", marginBottom: "12px" }}>
      <input
        id={id}
        value={query}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          onChange(next);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        style={inputStyle}
      />
      {open && (
        <div style={dropdownStyle}>
          {filtered.length === 0 ? (
            <div style={emptyRow}>No matching schools</div>
          ) : (
            filtered.map((s) => (
              <button
                type="button"
                key={s.name}
                onClick={() => chooseSchool(s.name)}
                style={optionButton}
              >
                {s.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: radius.sm,
  border: `1px solid ${colors.cardBorder}`,
  fontSize: "14px",
  background: colors.white,
};

const dropdownStyle = {
  position: "absolute",
  left: 0,
  right: 0,
  top: "calc(100% + 6px)",
  maxHeight: "210px",
  overflowY: "auto",
  background: colors.white,
  border: `1px solid ${colors.cardBorder}`,
  borderRadius: radius.md,
  boxShadow: shadows.md,
  zIndex: 20,
};

const optionButton = {
  width: "100%",
  textAlign: "left",
  padding: "10px 12px",
  border: "none",
  borderBottom: `1px solid ${colors.borderSubtle}`,
  background: "transparent",
  cursor: "pointer",
  fontSize: "13px",
  color: colors.text,
  fontFamily: "inherit",
};

const emptyRow = {
  padding: "10px 12px",
  color: colors.textSubtle,
  fontSize: "13px",
};

export default SchoolSelect;

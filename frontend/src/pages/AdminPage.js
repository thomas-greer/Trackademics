import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { colors, radius, shadows } from "../theme";

const API = "http://127.0.0.1:8000/api/users/admin";

function AdminPage() {
  let user = useSelector((state) => state.auth.user);
  if (!user) {
    const raw = localStorage.getItem("user");
    if (raw && raw !== "undefined") user = JSON.parse(raw);
  }
  const isAdmin = user?.username === "admin" && user?.email === "admin@gmail.com";
  const viewerId = user?.id;

  const [users, setUsers] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ username: "", email: "" });

  const loadUsers = async () => {
    const res = await fetch(`${API}/users-overview/?viewer_id=${viewerId}`);
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Could not load admin data.");
      return;
    }
    setUsers(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    if (isAdmin && viewerId) loadUsers().catch(() => {});
  }, [isAdmin, viewerId]);

  const startEdit = (u) => {
    setEditingId(u.id);
    setForm({ username: u.username || "", email: u.email || "" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ username: "", email: "" });
  };

  const saveEdit = async (id) => {
    const res = await fetch(`${API}/users/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ viewer_id: viewerId, username: form.username, email: form.email }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Could not update user.");
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === id ? data : u)));
    cancelEdit();
  };

  const deleteUser = async (id) => {
    if (!window.confirm("Delete this user and all related data?")) return;
    const res = await fetch(`${API}/users/${id}/?viewer_id=${viewerId}`, { method: "DELETE" });
    if (!res.ok) {
      let data = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      alert(data.error || "Could not delete user.");
      return;
    }
    setUsers((prev) => prev.filter((u) => u.id !== id));
  };

  if (!isAdmin) return <Navigate to="/feed" />;

  return (
    <div>
      <Navbar />
      <div style={wrap}>
        <h2 style={title}>Admin Dashboard</h2>
        <p style={subtitle}>Manage users and monitor posting activity.</p>

        <div style={card}>
          <h3 style={cardTitle}>Users</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Username</th>
                  <th style={th}>Email</th>
                  <th style={th}>Posts</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={td}>
                      {editingId === u.id ? (
                        <input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} style={inlineInput} />
                      ) : u.username}
                    </td>
                    <td style={td}>
                      {editingId === u.id ? (
                        <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} style={inlineInput} />
                      ) : u.email}
                    </td>
                    <td style={td}>{u.post_count}</td>
                    <td style={td}>
                      {editingId === u.id ? (
                        <>
                          <button type="button" onClick={() => saveEdit(u.id)} style={actionBtn}>Save</button>
                          <button type="button" className="btn-secondary-muted" onClick={cancelEdit} style={actionBtn}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => startEdit(u)} style={actionBtn}>Edit</button>
                          <button type="button" onClick={() => deleteUser(u.id)} style={dangerBtn}>Delete</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

const wrap = { maxWidth: 1100, margin: "26px auto", padding: "0 20px 30px" };
const title = { margin: "0 0 6px", color: colors.primary, fontWeight: 800 };
const subtitle = { margin: "0 0 16px", color: colors.textMuted };
const card = { background: colors.card, border: `1px solid ${colors.cardBorder}`, borderRadius: radius.lg, boxShadow: shadows.sm, padding: "16px", marginBottom: "16px" };
const cardTitle = { marginTop: 0, color: colors.primary };
const table = { width: "100%", borderCollapse: "collapse", color: colors.text };
const th = { textAlign: "left", padding: "10px 8px", borderBottom: `1px solid ${colors.border}`, color: colors.textMuted, fontSize: "13px" };
const td = { padding: "10px 8px", borderBottom: `1px solid ${colors.borderSubtle}`, verticalAlign: "middle" };
const inlineInput = { width: "100%", boxSizing: "border-box" };
const actionBtn = { marginRight: 8, padding: "6px 10px", fontSize: "12px" };
const dangerBtn = { ...actionBtn, background: colors.white, color: colors.danger, border: `1px solid ${colors.border}` };

export default AdminPage;

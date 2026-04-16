import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// GET sessions — no args: all posts (legacy/dev). { viewerId } feed for a viewer.
// { authorId } all posts by that user (profile page).
export const fetchSessions = createAsyncThunk(
  'sessions/fetchSessions',
  async (arg) => {
    const params = new URLSearchParams();
    if (arg && typeof arg === 'object') {
      if (arg.authorId != null && Number(arg.authorId) > 0) {
        params.set('author_id', String(arg.authorId));
      } else if (arg.viewerId != null) {
        params.set('viewer_id', String(arg.viewerId));
      }
    }
    const qs = params.toString();
    const url = qs
      ? `http://127.0.0.1:8000/api/users/sessions/?${qs}`
      : 'http://127.0.0.1:8000/api/users/sessions/';
    const res = await fetch(url);
    return res.json();
  }
);

// POST session
export const createSession = createAsyncThunk(
  'sessions/createSession',
  async (session) => {
    const res = await fetch('http://127.0.0.1:8000/api/users/sessions/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session),
    });
    return res.json();
  }
);

export const deleteSession = createAsyncThunk(
  'sessions/deleteSession',
  async ({ sessionId, userId }) => {
    const res = await fetch(
      `http://127.0.0.1:8000/api/users/sessions/${sessionId}/?user_id=${encodeURIComponent(userId)}`,
      { method: 'DELETE' }
    );
    if (!res.ok) {
      let message = 'Could not delete post.';
      try {
        const data = await res.json();
        if (data?.error) message = data.error;
      } catch {
        /* ignore */
      }
      throw new Error(message);
    }
    return sessionId;
  }
);

const sessionsSlice = createSlice({
  name: 'sessions',
  initialState: { list: [] },
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(fetchSessions.fulfilled, (state, action) => {
      state.list = action.payload;
    });
    builder.addCase(createSession.fulfilled, (state, action) => {
      state.list.push(action.payload);
    });
    builder.addCase(deleteSession.fulfilled, (state, action) => {
      const id = Number(action.payload);
      state.list = Array.isArray(state.list)
        ? state.list.filter((s) => Number(s.id) !== id)
        : state.list;
    });
  },
});

export default sessionsSlice.reducer;
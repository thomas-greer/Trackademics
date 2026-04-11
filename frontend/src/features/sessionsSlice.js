import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// GET sessions
export const fetchSessions = createAsyncThunk(
  'sessions/fetchSessions',
  async () => {
    const res = await fetch('http://127.0.0.1:8000/api/users/sessions/');
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
  },
});

export default sessionsSlice.reducer;
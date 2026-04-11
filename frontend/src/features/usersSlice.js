import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

// GET users
export const fetchUsers = createAsyncThunk('users/fetchUsers', async () => {
  const res = await fetch('http://127.0.0.1:8000/api/users/');
  return res.json();
});

// POST user
export const createUser = createAsyncThunk('users/createUser', async (user) => {
  const res = await fetch('http://127.0.0.1:8000/api/users/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user),
  });
  return res.json();
});

const usersSlice = createSlice({
  name: 'users',
  initialState: {
    list: [],
  },
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(fetchUsers.fulfilled, (state, action) => {
      state.list = action.payload;
    });
    builder.addCase(createUser.fulfilled, (state, action) => {
      state.list.push(action.payload);
    });
  },
});

export default usersSlice.reducer;
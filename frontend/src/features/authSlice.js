import { createSlice } from '@reduxjs/toolkit';

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
  },
  reducers: {
    login: (state, action) => {
      state.user = action.payload;
    },
    updateUser: (state, action) => {
      if (!state.user) {
        state.user = action.payload;
        return;
      }
      state.user = { ...state.user, ...action.payload };
    },
    logout: (state) => {
      state.user = null;
    }
  }
});

export const { login, logout, updateUser } = authSlice.actions;
export default authSlice.reducer;
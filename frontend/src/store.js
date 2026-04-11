import { configureStore } from '@reduxjs/toolkit';
import usersReducer from './features/usersSlice';
import sessionsReducer from './features/sessionsSlice';
import authReducer from './features/authSlice';

export const store = configureStore({
  reducer: {
    users: usersReducer,
    sessions: sessionsReducer,
    auth: authReducer,
  },
});
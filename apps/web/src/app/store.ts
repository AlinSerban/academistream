import { configureStore } from '@reduxjs/toolkit'
import authReducer from '../features/auth/authSlice'
import { authApi } from '../features/auth/authApi'
import { contentApi } from '../features/content/contentApi'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    [authApi.reducerPath]: authApi.reducer,
    [contentApi.reducerPath]: contentApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(authApi.middleware, contentApi.middleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

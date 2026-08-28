import { configureStore } from '@reduxjs/toolkit'
import authReducer from '../features/auth/authSlice'
import { authApi } from '../features/auth/authApi'
import { contentApi } from '../features/content/contentApi'
import { trainingApi } from '../features/training/trainingApi'
import { orgApi } from '../features/org/orgApi'
import { notificationsApi } from '../features/notifications/notificationsApi'
import { quotasApi } from '../features/quotas/quotasApi'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    [authApi.reducerPath]: authApi.reducer,
    [contentApi.reducerPath]: contentApi.reducer,
    [trainingApi.reducerPath]: trainingApi.reducer,
    [orgApi.reducerPath]: orgApi.reducer,
    [notificationsApi.reducerPath]: notificationsApi.reducer,
    [quotasApi.reducerPath]: quotasApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      authApi.middleware,
      contentApi.middleware,
      trainingApi.middleware,
      orgApi.middleware,
      notificationsApi.middleware,
      quotasApi.middleware,
    ),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

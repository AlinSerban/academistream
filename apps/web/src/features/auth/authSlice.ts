import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { AuthTokens } from './types'

const initialState: AuthTokens = {
  accessToken: null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAccessToken(state, action: PayloadAction<string>) {
      state.accessToken = action.payload
    },
    clearSession(state) {
      state.accessToken = null
    },
  },
})

export const { setAccessToken, clearSession } = authSlice.actions
export default authSlice.reducer

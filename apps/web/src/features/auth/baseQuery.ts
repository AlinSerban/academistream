import {
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react'
import type { RootState } from '../../app/store'
import { clearSession, setAccessToken } from './authSlice'
import type { LoginResponse, MeResponse, MessageResponse } from './types'

export type AuthApiData = LoginResponse | MeResponse | MessageResponse

const rawBaseQuery = fetchBaseQuery({
  baseUrl: '/api',
  credentials: 'include',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.accessToken
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
    return headers
  },
}) as BaseQueryFn<string | FetchArgs, AuthApiData, FetchBaseQueryError>

export const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  AuthApiData,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions)

  if (result.error?.status !== 401) {
    return result
  }

  const refresh = await rawBaseQuery(
    { url: '/auth/refresh', method: 'POST' },
    api,
    extraOptions,
  )

  if (refresh.data && isLoginResponse(refresh.data)) {
    api.dispatch(setAccessToken(refresh.data.access_token))
    result = await rawBaseQuery(args, api, extraOptions)
    return result
  }

  api.dispatch(clearSession())
  return result
}

function isLoginResponse(data: AuthApiData): data is LoginResponse {
  return 'access_token' in data && typeof data.access_token === 'string'
}

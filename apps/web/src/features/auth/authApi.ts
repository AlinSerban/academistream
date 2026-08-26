import { createApi } from '@reduxjs/toolkit/query/react'
import { baseQueryWithReauth } from './baseQuery'
import { clearSession, setAccessToken } from './authSlice'
import { contentApi } from '../content/contentApi'
import type {
  LoginRequest,
  LoginResponse,
  MeResponse,
  MessageResponse,
} from './types'

export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Me'],
  endpoints: (builder) => ({
    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (body) => ({
        url: '/auth/login',
        method: 'POST',
        body,
      }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled
        dispatch(setAccessToken(data.access_token))
      },
      invalidatesTags: ['Me'],
    }),
    refresh: builder.mutation<LoginResponse, void>({
      query: () => ({
        url: '/auth/refresh',
        method: 'POST',
      }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled
          dispatch(setAccessToken(data.access_token))
        } catch {
          dispatch(clearSession())
        }
      },
    }),
    me: builder.query<MeResponse, void>({
      query: () => '/auth/me',
      providesTags: ['Me'],
    }),
    logout: builder.mutation<MessageResponse, void>({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled
        } finally {
          dispatch(clearSession())
          dispatch(authApi.util.resetApiState())
          dispatch(contentApi.util.resetApiState())
        }
      },
    }),
  }),
})

export const {
  useLoginMutation,
  useRefreshMutation,
  useMeQuery,
  useLazyMeQuery,
  useLogoutMutation,
} = authApi

import { createApi } from '@reduxjs/toolkit/query/react'
import { baseQueryWithReauth } from '../auth/baseQuery'
import type {
  AcceptInviteRequest,
  AcceptInviteResponse,
  AuditEvent,
  CreateInviteRequest,
  CreateInviteResponse,
  Invite,
  Member,
} from './types'

export const orgApi = createApi({
  reducerPath: 'orgApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Invites', 'Members', 'AuditEvents'],
  endpoints: (builder) => ({
    getInvites: builder.query<Invite[], void>({
      query: () => '/invites',
      providesTags: ['Invites'],
    }),
    createInvite: builder.mutation<CreateInviteResponse, CreateInviteRequest>({
      query: (body) => ({
        url: '/invites',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Invites', 'AuditEvents'],
    }),
    revokeInvite: builder.mutation<Invite, number>({
      query: (id) => ({
        url: `/invites/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Invites', 'AuditEvents'],
    }),
    acceptInvite: builder.mutation<AcceptInviteResponse, AcceptInviteRequest>({
      query: (body) => ({
        url: '/invites/accept',
        method: 'POST',
        body,
      }),
    }),
    getMembers: builder.query<Member[], void>({
      query: () => '/members',
      providesTags: ['Members'],
    }),
    removeMember: builder.mutation<unknown, number>({
      query: (userId) => ({
        url: `/members/${userId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Members', 'AuditEvents'],
    }),
    getAuditEvents: builder.query<AuditEvent[], number | void>({
      query: (limit = 100) => `/audit-events?limit=${limit ?? 100}`,
      providesTags: ['AuditEvents'],
    }),
  }),
})

export const {
  useGetInvitesQuery,
  useCreateInviteMutation,
  useRevokeInviteMutation,
  useAcceptInviteMutation,
  useGetMembersQuery,
  useRemoveMemberMutation,
  useGetAuditEventsQuery,
} = orgApi

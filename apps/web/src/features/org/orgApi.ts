import { createApi } from '@reduxjs/toolkit/query/react'
import { baseQueryWithReauth } from '../auth/baseQuery'
import type { PageResult } from '../../lib/pagination'
import type {
  AcceptInviteRequest,
  AcceptInviteResponse,
  AuditEvent,
  CreateInviteRequest,
  CreateInviteResponse,
  Invite,
  Member,
} from './types'

export type PageArgs = {
  page: number
  pageSize: number
}

export const orgApi = createApi({
  reducerPath: 'orgApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Invites', 'Members', 'AuditEvents'],
  endpoints: (builder) => ({
    getInvites: builder.query<PageResult<Invite>, PageArgs>({
      query: ({ page, pageSize }) =>
        `/invites?page=${page}&pageSize=${pageSize}`,
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
    getMembers: builder.query<PageResult<Member>, PageArgs>({
      query: ({ page, pageSize }) =>
        `/members?page=${page}&pageSize=${pageSize}`,
      providesTags: ['Members'],
    }),
    removeMember: builder.mutation<unknown, number>({
      query: (userId) => ({
        url: `/members/${userId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Members', 'AuditEvents'],
    }),
    getAuditEvents: builder.query<PageResult<AuditEvent>, PageArgs>({
      query: ({ page, pageSize }) =>
        `/audit-events?page=${page}&pageSize=${pageSize}`,
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

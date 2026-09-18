import { createApi } from '@reduxjs/toolkit/query/react'
import { baseQueryWithReauth } from '../auth/baseQuery'
import type { PageResult } from '../../lib/pagination'
import type {
  Assignment,
  Completion,
  CreateAssignmentRequest,
  LearnerOption,
  MyAssignmentsPage,
  UpsertProgressRequest,
  UpsertProgressResponse,
  WatchProgress,
} from './types'

export type PageArgs = {
  page: number
  pageSize: number
}

export const trainingApi = createApi({
  reducerPath: 'trainingApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Assignments', 'Progress', 'Completions', 'Learners'],
  endpoints: (builder) => ({
    getAssignments: builder.query<PageResult<Assignment>, PageArgs>({
      query: ({ page, pageSize }) =>
        `/assignments?page=${page}&pageSize=${pageSize}`,
      providesTags: ['Assignments'],
    }),
    getMyAssignments: builder.query<MyAssignmentsPage, PageArgs>({
      query: ({ page, pageSize }) =>
        `/assignments/mine?page=${page}&pageSize=${pageSize}`,
      providesTags: ['Assignments'],
    }),
    getLearners: builder.query<PageResult<LearnerOption>, PageArgs>({
      query: ({ page, pageSize }) =>
        `/assignments/learners?page=${page}&pageSize=${pageSize}`,
      providesTags: ['Learners'],
    }),
    createAssignment: builder.mutation<Assignment, CreateAssignmentRequest>({
      query: (body) => ({
        url: '/assignments',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Assignments'],
    }),
    deleteAssignment: builder.mutation<Assignment, number>({
      query: (id) => ({
        url: `/assignments/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Assignments'],
    }),
    upsertProgress: builder.mutation<
      UpsertProgressResponse,
      UpsertProgressRequest
    >({
      query: (body) => ({
        url: '/progress',
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Progress', 'Completions', 'Assignments'],
    }),
    getMyProgress: builder.query<PageResult<WatchProgress>, PageArgs>({
      query: ({ page, pageSize }) =>
        `/progress/mine?page=${page}&pageSize=${pageSize}`,
      providesTags: ['Progress'],
    }),
    getProgress: builder.query<PageResult<WatchProgress>, PageArgs>({
      query: ({ page, pageSize }) =>
        `/progress?page=${page}&pageSize=${pageSize}`,
      providesTags: ['Progress'],
    }),
    getMyCompletions: builder.query<PageResult<Completion>, PageArgs>({
      query: ({ page, pageSize }) =>
        `/completions/mine?page=${page}&pageSize=${pageSize}`,
      providesTags: ['Completions'],
    }),
    getCompletions: builder.query<PageResult<Completion>, PageArgs>({
      query: ({ page, pageSize }) =>
        `/completions?page=${page}&pageSize=${pageSize}`,
      providesTags: ['Completions'],
    }),
  }),
})

export const {
  useGetAssignmentsQuery,
  useGetMyAssignmentsQuery,
  useGetLearnersQuery,
  useCreateAssignmentMutation,
  useDeleteAssignmentMutation,
  useUpsertProgressMutation,
  useGetMyProgressQuery,
  useGetProgressQuery,
  useGetMyCompletionsQuery,
  useGetCompletionsQuery,
} = trainingApi


import { createApi } from '@reduxjs/toolkit/query/react'
import { baseQueryWithReauth } from '../auth/baseQuery'
import type {
  Assignment,
  Completion,
  CreateAssignmentRequest,
  LearnerOption,
  UpsertProgressRequest,
  UpsertProgressResponse,
  WatchProgress,
} from './types'

export const trainingApi = createApi({
  reducerPath: 'trainingApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Assignments', 'Progress', 'Completions', 'Learners'],
  endpoints: (builder) => ({
    getAssignments: builder.query<Assignment[], void>({
      query: () => '/assignments',
      providesTags: ['Assignments'],
    }),
    getMyAssignments: builder.query<Assignment[], void>({
      query: () => '/assignments/mine',
      providesTags: ['Assignments'],
    }),
    getLearners: builder.query<LearnerOption[], void>({
      query: () => '/assignments/learners',
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
      invalidatesTags: ['Progress', 'Completions'],
    }),
    getMyProgress: builder.query<WatchProgress[], void>({
      query: () => '/progress/mine',
      providesTags: ['Progress'],
    }),
    getProgress: builder.query<WatchProgress[], void>({
      query: () => '/progress',
      providesTags: ['Progress'],
    }),
    getMyCompletions: builder.query<Completion[], void>({
      query: () => '/completions/mine',
      providesTags: ['Completions'],
    }),
    getCompletions: builder.query<Completion[], void>({
      query: () => '/completions',
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

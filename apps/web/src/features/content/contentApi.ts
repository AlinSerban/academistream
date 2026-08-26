import { createApi } from '@reduxjs/toolkit/query/react'
import { baseQueryWithReauth } from '../auth/baseQuery'
import type {
  Course,
  CreateCourseRequest,
  CreateVideoRequest,
  PlaybackResponse,
  UploadVideoArg,
  Video,
} from './types'

export const contentApi = createApi({
  reducerPath: 'contentApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Courses', 'Videos'],
  endpoints: (builder) => ({
    getCourses: builder.query<Course[], void>({
      query: () => '/courses',
      providesTags: ['Courses'],
    }),
    createCourse: builder.mutation<Course, CreateCourseRequest>({
      query: (body) => ({
        url: '/courses/create',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Courses'],
    }),
    getVideos: builder.query<Video[], void>({
      query: () => '/videos',
      providesTags: ['Videos'],
    }),
    createVideo: builder.mutation<Video, CreateVideoRequest>({
      query: (body) => ({
        url: '/videos/create',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Videos'],
    }),
    uploadVideo: builder.mutation<Video, UploadVideoArg>({
      query: ({ videoId, file }) => {
        const body = new FormData()
        body.append('file', file)
        return {
          url: `/videos/${videoId}/upload`,
          method: 'POST',
          body,
        }
      },
      invalidatesTags: ['Videos'],
    }),
    getPlaybackUrl: builder.query<PlaybackResponse, number>({
      query: (videoId) => `/videos/${videoId}/playback`,
    }),
  }),
})

export const {
  useGetCoursesQuery,
  useCreateCourseMutation,
  useGetVideosQuery,
  useCreateVideoMutation,
  useUploadVideoMutation,
  useLazyGetPlaybackUrlQuery,
} = contentApi

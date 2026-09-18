import { createApi } from '@reduxjs/toolkit/query/react'
import { baseQueryWithReauth } from '../auth/baseQuery'
import type { PageResult } from '../../lib/pagination'
import type {
  Course,
  CourseOption,
  CreateCourseRequest,
  CreateVideoRequest,
  PlaybackResponse,
  PublishState,
  UploadVideoArg,
  Video,
  VideoListResult,
} from './types'

export type ListCoursesArgs = {
  page: number
  pageSize: number
  q?: string
}

export type ListVideosArgs = {
  page: number
  pageSize: number
  mediaStatus?: string
}

export type ListAssignableArgs = {
  page?: number
  pageSize?: number
}

export const contentApi = createApi({
  reducerPath: 'contentApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Courses', 'CourseOptions', 'Videos', 'AssignableVideos'],
  endpoints: (builder) => ({
    getCourses: builder.query<PageResult<Course>, ListCoursesArgs>({
      query: ({ page, pageSize, q }) => {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        })
        if (q?.trim()) params.set('q', q.trim())
        return `/courses?${params}`
      },
      providesTags: ['Courses'],
    }),
    getCourseOptions: builder.query<CourseOption[], void>({
      query: () => '/courses/options',
      providesTags: ['CourseOptions'],
    }),
    createCourse: builder.mutation<Course, CreateCourseRequest>({
      query: (body) => ({
        url: '/courses/create',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Courses', 'CourseOptions'],
    }),
    getVideos: builder.query<VideoListResult, ListVideosArgs>({
      query: ({ page, pageSize, mediaStatus }) => {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        })
        if (mediaStatus && mediaStatus !== 'all') {
          params.set('mediaStatus', mediaStatus)
        }
        return `/videos?${params}`
      },
      providesTags: ['Videos'],
    }),
    getAssignableVideos: builder.query<
      PageResult<{ id: number; title: string }>,
      ListAssignableArgs | void
    >({
      query: (args) => {
        const page = args?.page ?? 1
        const pageSize = args?.pageSize ?? 50
        return `/videos/assignable?page=${page}&pageSize=${pageSize}`
      },
      providesTags: ['AssignableVideos'],
    }),
    createVideo: builder.mutation<Video, CreateVideoRequest>({
      query: (body) => ({
        url: '/videos/create',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Videos', 'AssignableVideos'],
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
      invalidatesTags: ['Videos', 'AssignableVideos'],
    }),
    publishVideo: builder.mutation<
      Video,
      { videoId: number; publishState: PublishState }
    >({
      query: ({ videoId, publishState }) => ({
        url: `/videos/${videoId}/publish`,
        method: 'PATCH',
        body: { publishState },
      }),
      invalidatesTags: ['Videos', 'AssignableVideos'],
    }),
    getPlaybackUrl: builder.query<PlaybackResponse, number>({
      query: (videoId) => `/videos/${videoId}/playback`,
    }),
  }),
})

export const {
  useGetCoursesQuery,
  useGetCourseOptionsQuery,
  useCreateCourseMutation,
  useGetVideosQuery,
  useGetAssignableVideosQuery,
  useCreateVideoMutation,
  useUploadVideoMutation,
  usePublishVideoMutation,
  useLazyGetPlaybackUrlQuery,
} = contentApi

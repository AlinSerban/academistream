import { createApi } from '@reduxjs/toolkit/query/react'
import { baseQueryWithReauth } from '../auth/baseQuery'
import type { TenantQuotaStatus } from './types'

export const quotasApi = createApi({
  reducerPath: 'quotasApi',
  baseQuery: baseQueryWithReauth,
  endpoints: (builder) => ({
    getQuotaUsage: builder.query<TenantQuotaStatus, void>({
      query: () => '/quotas/usage',
    }),
  }),
})

export const { useGetQuotaUsageQuery } = quotasApi

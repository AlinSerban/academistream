export const DEFAULT_PAGE = 1
export const DEFAULT_PAGE_SIZE = 5

export type PageParams = {
  page: number
  pageSize: number
}

export type PageResult<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export function emptyPage<T>(
  page = DEFAULT_PAGE,
  pageSize = DEFAULT_PAGE_SIZE,
): PageResult<T> {
  return { items: [], total: 0, page, pageSize }
}

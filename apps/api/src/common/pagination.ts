export const DEFAULT_PAGE = 1
export const DEFAULT_PAGE_SIZE = 5
export const MAX_PAGE_SIZE = 100

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

export function parsePageQuery(
  pageRaw?: string,
  pageSizeRaw?: string,
  defaults: { pageSize?: number } = {},
): PageParams {
  const defaultSize = defaults.pageSize ?? DEFAULT_PAGE_SIZE
  const page = Math.max(1, Math.floor(Number(pageRaw) || DEFAULT_PAGE))
  let pageSize = Math.floor(Number(pageSizeRaw) || defaultSize)
  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = defaultSize
  pageSize = Math.min(MAX_PAGE_SIZE, pageSize)
  return { page, pageSize }
}

export function pageOffset({ page, pageSize }: PageParams): number {
  return (page - 1) * pageSize
}

export function toPageResult<T>(
  items: T[],
  total: number,
  params: PageParams,
): PageResult<T> {
  return {
    items,
    total,
    page: params.page,
    pageSize: params.pageSize,
  }
}

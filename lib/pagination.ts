export function paginationFromRequest(
  request: Request,
  options?: {
    defaultPageSize?: number;
    maxPageSize?: number;
    maxAll?: number;
  },
) {
  const url = new URL(request.url);
  const all = url.searchParams.get("all") === "1";
  const defaultPageSize = options?.defaultPageSize || 50;
  const maxPageSize = options?.maxPageSize || 100;
  const maxAll = options?.maxAll || 5000;

  if (all) {
    return {
      all: true,
      page: 1,
      pageSize: maxAll,
      skip: 0,
      take: maxAll,
      search: url.searchParams.get("search")?.trim() || "",
    };
  }

  const rawPage = Number(url.searchParams.get("page") || 1);
  const rawPageSize = Number(
    url.searchParams.get("pageSize") || defaultPageSize,
  );

  const page =
    Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const pageSize =
    Number.isInteger(rawPageSize) && rawPageSize > 0
      ? Math.min(maxPageSize, rawPageSize)
      : defaultPageSize;

  return {
    all: false,
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
    search: url.searchParams.get("search")?.trim() || "",
  };
}

export function paginationMeta(
  total: number,
  page: number,
  pageSize: number,
) {
  return {
    page,
    pageSize,
    total,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

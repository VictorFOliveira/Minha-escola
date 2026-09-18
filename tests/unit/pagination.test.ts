import test from "node:test";
import assert from "node:assert/strict";
import { paginationFromRequest, paginationMeta } from "../../lib/pagination";

test("pagination applies defaults and caps page size", () => {
  const request = new Request("https://example.test/api/items?page=3&pageSize=999&search=ana");
  const pagination = paginationFromRequest(request, {
    defaultPageSize: 50,
    maxPageSize: 100,
  });

  assert.equal(pagination.page, 3);
  assert.equal(pagination.pageSize, 100);
  assert.equal(pagination.skip, 200);
  assert.equal(pagination.take, 100);
  assert.equal(pagination.search, "ana");
});

test("all mode remains bounded", () => {
  const request = new Request("https://example.test/api/items?all=1");
  const pagination = paginationFromRequest(request, { maxAll: 2500 });

  assert.equal(pagination.all, true);
  assert.equal(pagination.take, 2500);
  assert.equal(pagination.skip, 0);
});

test("pagination metadata reports pages", () => {
  assert.deepEqual(paginationMeta(251, 2, 100), {
    page: 2,
    pageSize: 100,
    total: 251,
    pages: 3,
  });
});

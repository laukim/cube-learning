import { handleTimesRequest } from "./times-api.js";

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/times") return handleTimesRequest(request, env);
    return new Response("Not found", { status: 404 });
  },
};

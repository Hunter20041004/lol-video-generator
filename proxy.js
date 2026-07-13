import handleOperatorProxy from "./utils/proxyHandler";

export function proxy(request) {
  return handleOperatorProxy(request);
}

export const config = { matcher: "/api/:path*" };

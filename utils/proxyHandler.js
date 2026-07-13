const { NextResponse } = require("next/server");
const { hasOperatorAccess } = require("./operatorAccess");

function handleOperatorProxy(request) {
  const pathname = new URL(request.url).pathname;
  if (
    request.method !== "POST" ||
    !pathname.startsWith("/api/") ||
    hasOperatorAccess(request)
  ) {
    return NextResponse.next();
  }

  return NextResponse.json(
    { success: false, error: "operator_access_required" },
    { status: 401 }
  );
}

module.exports = handleOperatorProxy;

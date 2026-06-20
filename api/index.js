const { handleApi } = require("../server");

module.exports = async function handler(request, response) {
  const url = new URL(request.url, `https://${request.headers.host || "www.load-link.co.za"}`);
  const routedPath = url.searchParams.get("path");
  const pathname = routedPath ? `/api/${routedPath}` : url.pathname;

  await handleApi(request, response, pathname);
};

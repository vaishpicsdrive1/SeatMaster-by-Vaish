export default async function handler(req, res) {
  const upstreamBase =
    process.env.SHEETS_API_BASE || process.env.VITE_SHEETS_API_BASE || "";

  if (!upstreamBase) {
    res.status(500).json({ error: "missing-sheets-api-base" });
    return;
  }

  try {
    if (req.method === "GET") {
      const upstreamUrl = new URL(upstreamBase);
      upstreamUrl.searchParams.set("route", "get-seats");
      console.log("GET request to sheets API:", upstreamUrl.toString());
      const upstreamRes = await fetch(upstreamUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-store",
        },
      });

      const text = await upstreamRes.text();
      console.log("GET response status:", upstreamRes.status, "text:", text);
      res.status(upstreamRes.status);
      res.setHeader(
        "Content-Type",
        upstreamRes.headers.get("content-type") || "application/json; charset=utf-8"
      );
      res.send(text);
      return;
    }

    if (req.method === "POST") {
      const upstreamUrl = new URL(upstreamBase);
      upstreamUrl.searchParams.set("route", "update-seat");
      const rawBody =
        typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
      console.log(
        "POST request to sheets API:",
        upstreamUrl.toString(),
        "body:",
        rawBody
      );

      const upstreamRes = await fetch(upstreamUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: rawBody,
      });

      const text = await upstreamRes.text();
      console.log("POST response status:", upstreamRes.status, "text:", text);
      res.status(upstreamRes.status);
      res.setHeader(
        "Content-Type",
        upstreamRes.headers.get("content-type") || "application/json; charset=utf-8"
      );
      res.send(text);
      return;
    }

    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ error: "method-not-allowed" });
  } catch (error) {
    console.error("Error in seat-status API proxy:", error);
    res.status(502).json({
      error: "upstream-request-failed",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

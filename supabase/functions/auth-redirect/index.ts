Deno.serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  // PKCE flow: code is in query params — redirect server-side
  if (code) {
    const target = new URL("betaapp://auth/callback");
    target.searchParams.set("code", code);
    return Response.redirect(target.toString(), 302);
  }

  // Implicit flow: tokens are in the hash fragment — only visible client-side.
  // Return a minimal HTML page that reads the hash and redirects to the app.
  const html = `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /></head>
  <body>
    <script>
      const hash = window.location.hash;
      if (hash) {
        window.location.href = "betaapp://auth/callback" + hash;
      }
    </script>
  </body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});

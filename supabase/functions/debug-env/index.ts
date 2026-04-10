const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const urls = [
    "https://ai-gateway.lovable.dev/v1/models",
    "https://ai-gateway.lovable.app/v1/models",
    "https://ai.lovable.dev/v1/models",
    "https://gateway.lovable.dev/v1/models",
  ];
  
  const results: Record<string, string> = {};
  for (const url of urls) {
    try {
      const resp = await fetch(url, {
        headers: { "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY") || ""}` },
        signal: AbortSignal.timeout(5000),
      });
      results[url] = `status: ${resp.status}`;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      results[url] = msg.length > 100 ? msg.slice(0, 100) : msg;
    }
  }

  return new Response(JSON.stringify(results, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

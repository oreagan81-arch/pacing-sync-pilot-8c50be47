import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { subject, courseId, pageUrl, pageTitle, bodyHtml, published, weekId } = await req.json();

    if (!courseId || !pageUrl || !pageTitle || !bodyHtml) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const canvasToken = Deno.env.get("CANVAS_API_TOKEN");
    let canvasBase = Deno.env.get("CANVAS_BASE_URL") || "https://thalesacademy.instructure.com";
    if (!canvasBase.startsWith("http")) canvasBase = `https://${canvasBase}`;
    if (!canvasToken) {
      return new Response(JSON.stringify({ error: "CANVAS_API_TOKEN not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const canvasHeaders = {
      Authorization: `Bearer ${canvasToken}`,
      "Content-Type": "application/json",
    };

    const courseBase = `${canvasBase}/api/v1/courses/${courseId}`;

    // 1. GET page to check existence + front_page
    const getRes = await fetch(`${courseBase}/pages/${pageUrl}`, { headers: canvasHeaders });
    let exists = false;
    let isFrontPage = false;
    let existingBody = "";

    if (getRes.ok) {
      const pageData = await getRes.json();
      exists = true;
      isFrontPage = pageData.front_page === true;
      existingBody = pageData.body || "";
    } else {
      await getRes.text(); // consume body
    }

    // 2. Content hash check — skip if body matches
    if (exists && existingBody === bodyHtml) {
      await sb.from("deploy_log").insert({
        week_id: weekId || null,
        subject: subject || null,
        action: "page_deploy",
        status: "NO_CHANGE",
        canvas_url: `${canvasBase}/courses/${courseId}/pages/${pageUrl}`,
        message: "Content unchanged — skipped",
      });

      return new Response(JSON.stringify({
        status: "NO_CHANGE",
        canvasUrl: `${canvasBase}/courses/${courseId}/pages/${pageUrl}`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Front page protection: force published=true if front_page
    let pub = published ?? false;
    if (isFrontPage) pub = true;

    const payload = {
      wiki_page: {
        title: pageTitle,
        body: bodyHtml,
        published: pub,
      },
    };

    const method = exists ? "PUT" : "POST";
    const url = exists ? `${courseBase}/pages/${pageUrl}` : `${courseBase}/pages`;

    const res = await fetch(url, {
      method,
      headers: canvasHeaders,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      await sb.from("deploy_log").insert({
        week_id: weekId || null,
        subject: subject || null,
        action: "page_deploy",
        status: "ERROR",
        message: `${method} ${res.status}: ${errText}`,
        payload: payload as unknown as Record<string, unknown>,
      });

      return new Response(JSON.stringify({ error: errText, status: "ERROR" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await res.json();
    const canvasUrl = `${canvasBase}/courses/${courseId}/pages/${result.url || pageUrl}`;

    await sb.from("deploy_log").insert({
      week_id: weekId || null,
      subject: subject || null,
      action: "page_deploy",
      status: "DEPLOYED",
      canvas_url: canvasUrl,
      message: `${exists ? "Updated" : "Created"} page: ${pageTitle}`,
    });

    return new Response(JSON.stringify({ status: "DEPLOYED", canvasUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

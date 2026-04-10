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
    const { courseId, title, message, delayedPostAt, weekId, subject } = await req.json();

    if (!courseId || !title) {
      return new Response(JSON.stringify({ error: "Missing courseId or title" }), {
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

    const payload = {
      title,
      message: message || "",
      is_announcement: true,
      published: true,
      ...(delayedPostAt ? { delayed_post_at: delayedPostAt } : {}),
    };

    const res = await fetch(
      `${canvasBase}/api/v1/courses/${courseId}/discussion_topics`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${canvasToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      await sb.from("deploy_log").insert({
        week_id: weekId || null,
        subject: subject || null,
        action: "announcement_post",
        status: "ERROR",
        message: `POST ${res.status}: ${errText}`,
      });
      return new Response(JSON.stringify({ error: errText, status: "ERROR" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await res.json();
    const canvasUrl = `${canvasBase}/courses/${courseId}/discussion_topics/${result.id}`;

    await sb.from("deploy_log").insert({
      week_id: weekId || null,
      subject: subject || null,
      action: "announcement_post",
      status: "DEPLOYED",
      canvas_url: canvasUrl,
      message: `Posted announcement: ${title}`,
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

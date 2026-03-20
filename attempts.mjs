import { getStore } from "@netlify/blobs";

const store = () => getStore({ name: "secureexam-attempts", consistency: "strong" });

export default async (req) => {
  const method = req.method;
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    // GET all attempts (teacher dashboard)
    if (method === "GET" && action === "list") {
      const { blobs } = await store().list();
      const attempts = [];
      for (const b of blobs) {
        const a = await store().get(b.key, { type: "json" });
        if (a) attempts.push(a);
      }
      attempts.sort((a, b) => b.submittedAt - a.submittedAt);
      return Response.json({ ok: true, attempts });
    }

    // GET single attempt
    if (method === "GET" && action === "get") {
      const id = url.searchParams.get("id");
      const attempt = await store().get("attempt-" + id, { type: "json" });
      if (!attempt) return Response.json({ ok: false, error: "Not found" }, { status: 404 });
      return Response.json({ ok: true, attempt });
    }

    // POST — save new attempt
    if (method === "POST" && action === "save") {
      const body = await req.json();
      const id = Date.now();
      const attempt = { ...body, id, submittedAt: id };
      await store().setJSON("attempt-" + id, attempt);
      return Response.json({ ok: true, attempt });
    }

    // PATCH — save essay grade
    if (method === "PATCH" && action === "grade") {
      const { id, essayScores, comments } = await req.json();
      const s = store();
      const attempt = await s.get("attempt-" + id, { type: "json" });
      if (!attempt) return Response.json({ ok: false, error: "Not found" }, { status: 404 });
      attempt.essayScores = essayScores;
      attempt.essayComments = comments;
      attempt.status = "graded";
      // Recalculate total
      const essayTotal = Object.values(essayScores || {}).reduce((s, v) => s + Number(v), 0);
      attempt.totalScore = (attempt.earned || 0) + essayTotal;
      attempt.totalPossible = (attempt.mcPossible || 0) + (attempt.essayPossible || 0);
      attempt.totalPct = attempt.totalPossible > 0
        ? Math.round(attempt.totalScore / attempt.totalPossible * 100) : null;
      await s.setJSON("attempt-" + id, attempt);
      return Response.json({ ok: true, attempt });
    }

    return Response.json({ ok: false, error: "Unknown action" }, { status: 400 });

  } catch (err) {
    console.error("attempts function error:", err);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
};

export const config = { path: "/api/attempts" };

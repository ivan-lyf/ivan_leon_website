// Vercel serverless function: proxies LeetCode's public GraphQL so the browser
// can read live solve stats without hitting CORS. Cached at the edge (15 min).
// CommonJS (no package.json "type":"module" in this repo). Node 18+ has global fetch.
module.exports = async function handler(req, res) {
  const username = ((req.query && req.query.u) || "brownguest3123").toString();
  const query =
    "query($u:String!){ matchedUser(username:$u){ username profile{ ranking } " +
    "submitStatsGlobal{ acSubmissionNum{ difficulty count } } } }";
  try {
    const r = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Referer": "https://leetcode.com",
        "User-Agent": "Mozilla/5.0",
      },
      body: JSON.stringify({ query, variables: { u: username } }),
    });
    const j = await r.json();
    const u = j && j.data && j.data.matchedUser;
    if (!u) { res.status(404).json({ error: "user not found" }); return; }
    const m = {};
    (u.submitStatsGlobal.acSubmissionNum || []).forEach((s) => { m[s.difficulty] = s.count; });
    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=86400");
    res.status(200).json({
      username: u.username,
      ranking: (u.profile && u.profile.ranking) || null,
      total: m.All || 0, easy: m.Easy || 0, medium: m.Medium || 0, hard: m.Hard || 0,
    });
  } catch (e) {
    res.status(502).json({ error: "leetcode fetch failed" });
  }
};

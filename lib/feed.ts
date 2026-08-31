const REPO = "ranveerlabs/learnova-v2";
const TTL = 60 * 1000;

export type Ticket = {
  sha: string;
  subject: string;
  body: string;
  author: string;
  at: string;
  url: string;
  build: Build | null;
};

export type Build = {
  state: string;
  at: string;
  url: string | null;
  environment: string;
};

type Cached = { tickets: Ticket[]; at: number; stale: boolean };

// on globalThis, dev reloads hand out a fresh empty box otherwise
const K = Symbol.for("learnova.feed");
const g = globalThis as unknown as { [K]?: { held: Cached | null } };
const box = (g[K] ??= { held: null });

// unauthenticated github is 60 an hour per ip, shared across everyone on the
// deployment, so every poll past the first minute is served from here
async function gh(path: string) {
  const r = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    headers: { accept: "application/vnd.github+json" },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`github:${r.status}`);
  return r.json();
}

type ApiCommit = {
  sha: string;
  html_url: string;
  commit: { message: string; author: { name: string; date: string } };
};

type ApiDeployment = { id: number; sha: string; environment: string };
type ApiStatus = {
  state: string;
  created_at: string;
  environment_url: string | null;
  target_url: string | null;
};

export async function feed(): Promise<Cached> {
  const held = box.held;
  if (held && Date.now() - held.at < TTL) return held;

  try {
    const [commits, deployments] = (await Promise.all([
      gh("/commits?per_page=12"),
      gh("/deployments?per_page=20"),
    ])) as [ApiCommit[], ApiDeployment[]];

    // newest deployment per sha, and only that one gets its statuses fetched
    const latest = new Map<string, ApiDeployment>();
    for (const d of deployments) if (!latest.has(d.sha)) latest.set(d.sha, d);

    const wanted = commits.map((c) => c.sha).filter((s) => latest.has(s));
    const builds = new Map<string, Build>();
    await Promise.all(
      wanted.map(async (sha) => {
        const d = latest.get(sha)!;
        try {
          const statuses = (await gh(
            `/deployments/${d.id}/statuses?per_page=1`,
          )) as ApiStatus[];
          const s = statuses[0];
          if (!s) return;
          builds.set(sha, {
            state: s.state,
            at: s.created_at,
            url: s.environment_url ?? s.target_url,
            environment: d.environment,
          });
        } catch {
          // a deployment with no readable status is just a commit with no build
        }
      }),
    );

    const tickets = commits.map((c) => {
      const [subject, ...rest] = c.commit.message.split("\n");
      return {
        sha: c.sha,
        subject,
        body: rest.join("\n").trim(),
        author: c.commit.author.name,
        at: c.commit.author.date,
        url: c.html_url,
        build: builds.get(c.sha) ?? null,
      };
    });

    box.held = { tickets, at: Date.now(), stale: false };
    return box.held;
  } catch (e) {
    // rate limited or github is down. last good answer beats an empty screen,
    // and the page says which it is looking at
    if (held) return { ...held, stale: true };
    throw e;
  }
}

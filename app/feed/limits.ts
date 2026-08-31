// every entry here is real and is written down somewhere else too. the open
// ones come out of the README's status section, the chaos out of the commits
// that fixed them. if you fix one, close it here and in the README

export type Limit = {
  what: string;
  where: string;
  open: boolean;
};

export const LIMITS: Limit[] = [
  {
    what: "No auth and no per-user rate limiting. One ai key is shared across everyone on the deployment, 450 requests per thirty minutes between them.",
    where: "README, status",
    open: true,
  },
  {
    what: "Prompt injection hardening is outstanding. Pasted material and typed topics reach prompts directly.",
    where: "app/api/round/route.ts, TODOs at the top",
    open: true,
  },
  {
    what: "Browser testing is one machine, headless chrome on windows with mobile viewports emulated. Checked to 360pt. Not a device lab.",
    where: "README, status",
    open: true,
  },
  {
    what: "A judge call made from inside a live room and mirrored to the guest has never been run. Mirroring is verified against a stubbed ballot only.",
    where: "README, status",
    open: true,
  },
  {
    what: "The disconnect endings have not been re-triggered with two real browsers since the behaviour changed.",
    where: "README, status",
    open: true,
  },
  {
    what: "The deployed build can lag this repo. If the app does not match what is here, it has not been redeployed.",
    where: "README, status",
    open: true,
  },
  {
    what: "learnova.standing.v1 and learnova.debate.v1 are left on devices that have them. Nothing in the app reads, writes or deletes them.",
    where: "README, privacy",
    open: true,
  },
];

export type Chaos = {
  what: string;
  fix: string;
};

export const CHAOS: Chaos[] = [
  {
    what: "The bank cache was a module level Map, which is per module instance and not per process. The warmer reached the route through a dynamic import from another bundle and got its own copy, so four topics were generated at boot, cached, and never found again. Warmed topics measured 12.0s and 6.2s, exactly what they cost unwarmed.",
    fix: "warm the starter topics at boot",
  },
  {
    what: 'A case insensitive bare letter swap in the ballot matched the article "a" and shipped "with they cheaper alternative" through a live judge call before anybody caught it.',
    fix: "one palette / one voice / lists that survive the scrub",
  },
  {
    what: "The run clock only moved inside a requestAnimationFrame loop that is skipped unless it is animating, and it is never animating. It rendered 0:00.0 on every screen in every session.",
    fix: "one measure, and its the clock",
  },
  {
    what: 'The source gauge was exported and every one of its ternaries ended on the healthy branch, so a source over the ceiling painted mint and read "ready" while the button refused it.',
    fix: "state the paste ceiling in the interface",
  },
  {
    what: "A topic-only run on Tritoflex insisted the whole way through that a spray-applied roofing compound was torch-applied. The only reason it got caught is that the person already knew.",
    fix: "stop the ungrounded path claiming a source it never had",
  },
  {
    what: "The round timer was a conic-gradient ring with a bg-ground disc punched out of the middle. bg-ground became the desktop, so it drew a dark circle on a white toolbar.",
    fix: "notes panel / scrollbars / drag by the title bar / square the timer",
  },
];

export const openCount = LIMITS.filter((l) => l.open).length;

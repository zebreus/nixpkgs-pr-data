import { Octokit, App } from "https://esm.sh/octokit?dts";
import { format } from "https://deno.land/std@0.215.0/datetime/format.ts";

const octokit = new Octokit({
  userAgent: "nixpkgs-pr-data",
  auth: Deno.env.get("GITHUB_TOKEN"),
});

type User = {
  /* User name */
  name: string;
  // Build avater URL like https://avatars.githubusercontent.com/u/83867734?v=4
  /* User id */
  id: string;
};

type PullRequest = {
  /* Author name */
  author: User;
  /* Requested reviewers */
  reviewers: User[];
  /* PR title */
  title: string;
  /* PR state */
  state: "open" | "closed";
  /* PR base branch */
  base: string;

  labels: string[];
  draft?: boolean;

  /* In milliseconds since midnight, January 1, 1970 UTC. */
  created_at: number;
  /* In milliseconds since midnight, January 1, 1970 UTC. */
  updated_at: number;
  /* In milliseconds since midnight, January 1, 1970 UTC. */
  closed_at?: number;
  /* In milliseconds since midnight, January 1, 1970 UTC. */
  merged_at?: number;
};

// deno-lint-ignore no-explicit-any
const processUser = (data: any): User => {
  return {
    name: data.login,
    id: data.id,
  };
};

const processData = (data: any): PullRequest & { number: number } => {
  return {
    author: processUser(data.user),
    reviewers: data.requested_reviewers.map(processUser),
    number: data.number,
    title: data.title,
    state: data.state,
    labels: data.labels.map((label: { name: string }) => label.name),
    base: data.base.ref,
    ...(data.draft ? { draft: data.draft } : {}),
    created_at: new Date(data.created_at).getTime(),
    updated_at: new Date(data.updated_at).getTime(),
    ...(data.closed_at
      ? { closed_at: new Date(data.closed_at).getTime() }
      : {}),
    ...(data.merged_at
      ? { merged_at: new Date(data.merged_at).getTime() }
      : {}),
  };
};

const savePullRequests = async (pullRequests: Record<string, PullRequest>) => {
  const entries = Object.entries(pullRequests);
  const oldPrs = Object.fromEntries(
    entries.filter(([id]) => parseInt(id) < 200000)
  );
  const newPrs = Object.fromEntries(
    entries.filter(([id]) => parseInt(id) >= 200000)
  );

  await Deno.writeTextFile(
    "./pull-requests_0-200000.json",
    JSON.stringify(oldPrs, null, 1)
  );
  await Deno.writeTextFile(
    "./pull-requests_200000-400000.json",
    JSON.stringify(newPrs, null, 1)
  );
};

const loadPullRequests = async (): Record<string, PullRequest> => {
  const oldPrs = JSON.parse(
    Deno.readTextFileSync("./pull-requests_0-200000.json")
  ) as Record<string, PullRequest>;
  const newPrs = JSON.parse(
    Deno.readTextFileSync("./pull-requests_200000-400000.json")
  ) as Record<string, PullRequest>;

  return { ...oldPrs, ...newPrs };
};

const fetchAllPullRequests = async (base = "master") => {
  const allPullRequests: Record<string, PullRequest> = {};

  let fetchedPullRequests = 0;
  let page = 0;
  const perPage = 100;
  do {
    const result = await octokit.request("GET /repos/nixos/nixpkgs/pulls", {
      owner: "nixos",
      repo: "nixpkgs",
      per_page: perPage,
      page: page++,
      base: base,
      sort: "created",
      direction: "desc",
      state: "all",
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    fetchedPullRequests = result.data.length;

    for (const pullRequest of result.data) {
      allPullRequests["" + pullRequest.number] = {
        ...processData(pullRequest),
        number: undefined,
      };
    }

    const numbers = (
      result.data.map((pr: { number: number }) => pr.number) as number[]
    ).toSorted((a, b) => b - a);
    console.log(
      `Fetched pull requests ${numbers[0]} to ${numbers[numbers.length - 1]}`
    );
  } while (fetchedPullRequests !== 0);
  return allPullRequests;
};

const fetchUpdatedPullRequests = async (newerThan: number, base = "master") => {
  const updatedPullRequests: Record<string, PullRequest> = {};

  let fetchedPullRequests = 0;
  let page = 0;
  const perPage = 100;
  let oldestFetched = new Date().getTime();
  do {
    const result = await octokit.request("GET /repos/nixos/nixpkgs/pulls", {
      owner: "nixos",
      repo: "nixpkgs",
      per_page: perPage,
      page: page++,
      base: base,
      sort: "updated",
      direction: "desc",
      state: "all",
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    fetchedPullRequests = result.data.length;

    for (const pullRequest of result.data) {
      updatedPullRequests["" + pullRequest.number] = {
        ...processData(pullRequest),
        number: undefined,
      };
    }

    oldestFetched = new Date(
      result.data[result.data.length - 1].updated_at
    ).getTime();

    const numbers = (
      result.data.map((pr: { number: number }) => pr.number) as number[]
    ).toSorted((a, b) => b - a);
    console.log(
      `Fetched pull requests ${numbers[0]} to ${numbers[numbers.length - 1]}`
    );
  } while (fetchedPullRequests !== 0 && oldestFetched > newerThan);
  return updatedPullRequests;
};

async function init() {
  const pullRequests = await fetchAllPullRequests();
  await savePullRequests(pullRequests);
}

async function update(): Promise<void> {
  const devMode = (() => {
    try {
      Deno.statSync("dev");
      return true;
    } catch (_) {
      return false;
    }
  })();

  console.log("Dev mode: ", devMode ? "enabled" : "disabled");

  const previousPrs = await loadPullRequests();

  const newestChangeDate = Object.values(previousPrs)
    .map(({ updated_at }) => updated_at)
    .sort((a, b) => b - a)[0];
  const twoHours = 1000 * 60 * 60 * 2;

  console.log(
    "Fetching all updated pull requests since ",
    new Date(newestChangeDate - twoHours)
  );

  const updatedPrs = await fetchUpdatedPullRequests(
    newestChangeDate - twoHours
  );

  console.log(`Got ${Object.keys(updatedPrs).length} updated pull requests`);
  for (const [id, pr] of Object.entries(updatedPrs)) {
    previousPrs[id] = pr;
  }

  await savePullRequests(previousPrs);

  if (!devMode) {
    [
      'config --global user.email "lennarteichhorn+nixpkgs-pr-data@googlemail.com"'.split(
        " "
      ),
      'config --global user.name "Zebreus"'.split(" "),
      "add pull-requests_0-200000.json".split(" "),
      "add pull-requests_200000-400000.json".split(" "),
      [
        "commit",
        "-m",
        `Update pull request data on ${format(new Date(), "yyyy-MM-dd HH:mm")}`,
      ],
      ["tag", format(new Date(), "yyyy-MM-dd")],
    ].forEach((command) => {
      new Deno.Command("git", {
        args: command,
        cwd: import.meta.dirname,
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      }).outputSync();
    });

    new Deno.Command("git", {
      args: ["push", "--follow-tags", "origin", "main"],
      cwd: import.meta.dirname,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    }).outputSync();
  }
}

// Internal function to adjust the pull requests file
async function rework() {
  const pullRequests = await loadPullRequests();
  await savePullRequests(pullRequests);
}

const mode = Deno.args[0];

if (mode === "update") {
  await update();
  Deno.exit(0);
}
if (mode === "init") {
  await init();
  Deno.exit(0);
}

if (mode === "rework") {
  await rework();
  Deno.exit(0);
}
console.error("Invalid mode. Use 'update' or 'init' as argument.");
Deno.exit(1);

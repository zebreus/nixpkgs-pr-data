# nixpkgs pr data

This repo contains all PRs that have been opened against nixpkgs. The data is updated every day by a github action.

The github API only allows fetching 100 PRs at a time which is a pain to work with. This repo scrapes the PRs daily and commits the data to this repo.

The pull requests with the ids from 0 to 200000 are stored in `pull-requests_0-200000.json`, the newer PRs are in `pull-requests_200000-400000.json`

The schema for both files is as follows:

```typescript
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

/* The json consists of an object with the key being the PR number and the value being the PR object */
type PullRequestsFile = {
  [prNumber: string]: PullRequest;
};
```

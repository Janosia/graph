// Builds github_catalog.json — a Composio-style tool catalog for the GitHub toolkit.
// Real Composio catalogs expose ~893 GitHub tools; slugs below are taken verbatim from
// https://docs.composio.dev/toolkits/github. To keep this a reviewable, hand-checkable
// fixture we include a representative ~65-tool slice spanning issues, PRs, reviews,
// comments, branches, commits, labels, releases, milestones, workflow runs, gists, teams.
// Each entry mirrors the shape Composio exposes: slug, name, description, an
// input_parameters JSON-Schema (with `required`), and an output_parameters JSON-Schema
// describing the response shape (flattened for list endpoints via `items`).
//
// The generator (src/generate.ts) only assumes this shape — it does not hardcode any
// tool names — so it will work against the full 893-tool catalog or any other toolkit's
// catalog that follows the same { slug, name, description, input_parameters,
// output_parameters } shape.

const fs = require("fs");
const path = require("path");

const owner = { name: "owner", type: "string", description: "The account owner of the repository (username or org)." };
const repo = { name: "repo", type: "string", description: "The name of the repository, without the .git extension." };

function obj(properties, required = []) {
  const props = {};
  for (const p of properties) props[p.name] = { type: p.type, description: p.description, ...(p.items ? { items: p.items } : {}) };
  return { type: "object", properties: props, required };
}

function arrayOf(itemProps) {
  return { type: "array", items: obj(itemProps) };
}

const tools = [];

function tool(slug, name, description, service, input, output) {
  tools.push({ slug, name, description, service, input_parameters: input, output_parameters: output });
}

// ---------- Issues ----------
tool("GITHUB_CREATE_AN_ISSUE", "Create an issue", "Creates an issue in a repository.", "issues",
  obj([owner, repo, { name: "title", type: "string", description: "The title of the issue." },
    { name: "body", type: "string", description: "The contents of the issue." },
    { name: "milestone", type: "integer", description: "The milestone number to associate this issue with." },
    { name: "labels", type: "array", description: "Labels to associate with this issue.", items: { type: "string" } },
    { name: "assignees", type: "array", description: "Logins for users to assign to this issue.", items: { type: "string" } }],
    ["owner", "repo", "title"]),
  obj([{ name: "id", type: "integer", description: "Issue id." }, { name: "number", type: "integer", description: "The issue number, unique within the repository." },
    { name: "html_url", type: "string", description: "URL of the created issue." }, { name: "state", type: "string", description: "Issue state." }]));

tool("GITHUB_GET_AN_ISSUE", "Get an issue", "Fetches a single issue by number.", "issues",
  obj([owner, repo, { name: "issue_number", type: "integer", description: "The number that identifies the issue." }], ["owner", "repo", "issue_number"]),
  obj([{ name: "id", type: "integer", description: "Issue id." }, { name: "number", type: "integer", description: "Issue number." }, { name: "state", type: "string", description: "Issue state." }, { name: "title", type: "string", description: "Issue title." }]));

tool("GITHUB_UPDATE_AN_ISSUE", "Update an issue", "Updates the title, body, state, or metadata of an issue.", "issues",
  obj([owner, repo, { name: "issue_number", type: "integer", description: "The number that identifies the issue." },
    { name: "title", type: "string", description: "New title." }, { name: "body", type: "string", description: "New body." },
    { name: "state", type: "string", description: "New state (open or closed)." }, { name: "milestone", type: "integer", description: "Milestone number to attach." }],
    ["owner", "repo", "issue_number"]),
  obj([{ name: "id", type: "integer", description: "Issue id." }, { name: "number", type: "integer", description: "Issue number." }]));

tool("GITHUB_CLOSE_ISSUE", "Close an issue", "Closes an open issue.", "issues",
  obj([owner, repo, { name: "issue_number", type: "integer", description: "The number that identifies the issue." }], ["owner", "repo", "issue_number"]),
  obj([{ name: "number", type: "integer", description: "Issue number." }, { name: "state", type: "string", description: "New state." }]));

tool("GITHUB_REOPEN_ISSUE", "Reopen an issue", "Reopens a closed issue.", "issues",
  obj([owner, repo, { name: "issue_number", type: "integer", description: "The number that identifies the issue." }], ["owner", "repo", "issue_number"]),
  obj([{ name: "number", type: "integer", description: "Issue number." }, { name: "state", type: "string", description: "New state." }]));

tool("GITHUB_LOCK_AN_ISSUE", "Lock an issue", "Locks an issue's conversation.", "issues",
  obj([owner, repo, { name: "issue_number", type: "integer", description: "The number that identifies the issue." },
    { name: "lock_reason", type: "string", description: "Reason for locking." }], ["owner", "repo", "issue_number"]),
  obj([{ name: "locked", type: "boolean", description: "Whether the issue is locked." }]));

tool("GITHUB_ADD_ASSIGNEES_TO_AN_ISSUE", "Add assignees to an issue", "Adds up to 10 assignees to an issue.", "issues",
  obj([owner, repo, { name: "issue_number", type: "integer", description: "The number that identifies the issue." },
    { name: "assignees", type: "array", description: "Usernames to assign.", items: { type: "string" } }], ["owner", "repo", "issue_number", "assignees"]),
  obj([{ name: "number", type: "integer", description: "Issue number." }, { name: "assignees", type: "array", description: "Current assignees.", items: { type: "object" } }]));

tool("GITHUB_ADD_LABELS_TO_AN_ISSUE", "Add labels to an issue", "Adds labels to an issue.", "issues",
  obj([owner, repo, { name: "issue_number", type: "integer", description: "The number that identifies the issue." },
    { name: "labels", type: "array", description: "Label names to add.", items: { type: "string" } }], ["owner", "repo", "issue_number", "labels"]),
  obj([{ name: "labels", type: "array", description: "Labels now on the issue.", items: { type: "object" } }]));

tool("GITHUB_LIST_REPOSITORY_ISSUES", "List repository issues", "Lists issues in a repository, optionally filtered by state, labels, or milestone.", "issues",
  obj([owner, repo, { name: "state", type: "string", description: "Filter by state: open, closed, all." },
    { name: "labels", type: "string", description: "Comma separated list of label names." },
    { name: "milestone", type: "string", description: "Milestone number, 'none', or '*'." },
    { name: "assignee", type: "string", description: "Username, 'none', or '*'." }], ["owner", "repo"]),
  arrayOf([{ name: "id", type: "integer", description: "Issue id." }, { name: "number", type: "integer", description: "The issue number." },
    { name: "title", type: "string", description: "Issue title." }, { name: "state", type: "string", description: "Issue state." },
    { name: "html_url", type: "string", description: "Issue URL." }]));

tool("GITHUB_LIST_ISSUES_ASSIGNED_TO_THE_AUTHENTICATED_USER", "List issues for user", "Lists issues assigned to the authenticated user across repositories.", "issues",
  obj([{ name: "filter", type: "string", description: "assigned, created, mentioned, subscribed, repos, all." },
    { name: "state", type: "string", description: "open, closed, all." }], []),
  arrayOf([{ name: "id", type: "integer", description: "Issue id." }, { name: "number", type: "integer", description: "Issue number." }, { name: "repository", type: "object", description: "Repository the issue belongs to (contains name/owner)." }]));

// ---------- Issue comments ----------
tool("GITHUB_CREATE_AN_ISSUE_COMMENT", "Create an issue comment", "Creates a comment on an issue (or PR, since PRs are issues).", "issue_comments",
  obj([owner, repo, { name: "issue_number", type: "integer", description: "The number that identifies the issue." },
    { name: "body", type: "string", description: "The comment text." }], ["owner", "repo", "issue_number", "body"]),
  obj([{ name: "id", type: "integer", description: "The comment id." }, { name: "html_url", type: "string", description: "URL of the comment." }]));

tool("GITHUB_GET_AN_ISSUE_COMMENT", "Get an issue comment", "Fetches a single issue comment by id.", "issue_comments",
  obj([owner, repo, { name: "comment_id", type: "integer", description: "The unique identifier of the comment." }], ["owner", "repo", "comment_id"]),
  obj([{ name: "id", type: "integer", description: "Comment id." }, { name: "body", type: "string", description: "Comment body." }]));

tool("GITHUB_UPDATE_AN_ISSUE_COMMENT", "Update an issue comment", "Updates the body of an issue comment.", "issue_comments",
  obj([owner, repo, { name: "comment_id", type: "integer", description: "The unique identifier of the comment." },
    { name: "body", type: "string", description: "New comment text." }], ["owner", "repo", "comment_id", "body"]),
  obj([{ name: "id", type: "integer", description: "Comment id." }]));

tool("GITHUB_DELETE_ISSUE_COMMENT", "Delete an issue comment", "Deletes an issue comment.", "issue_comments",
  obj([owner, repo, { name: "comment_id", type: "integer", description: "The unique identifier of the comment." }], ["owner", "repo", "comment_id"]),
  obj([]));

tool("GITHUB_LIST_ISSUE_COMMENTS", "List issue comments", "Lists comments on an issue.", "issue_comments",
  obj([owner, repo, { name: "issue_number", type: "integer", description: "The number that identifies the issue." }], ["owner", "repo", "issue_number"]),
  arrayOf([{ name: "id", type: "integer", description: "The comment id." }, { name: "body", type: "string", description: "Comment text." }]));

// ---------- Pull requests ----------
tool("GITHUB_CREATE_A_PULL_REQUEST", "Create a pull request", "Opens a new pull request.", "pulls",
  obj([owner, repo, { name: "title", type: "string", description: "PR title." },
    { name: "head", type: "string", description: "Branch containing changes, e.g. 'feature-x' or 'octocat:feature-x'." },
    { name: "base", type: "string", description: "Branch you want changes pulled into." },
    { name: "body", type: "string", description: "PR description." },
    { name: "draft", type: "boolean", description: "Open as a draft PR." }], ["owner", "repo", "title", "head", "base"]),
  obj([{ name: "id", type: "integer", description: "PR id." }, { name: "number", type: "integer", description: "The pull request number, unique within the repository." },
    { name: "html_url", type: "string", description: "PR URL." }, { name: "state", type: "string", description: "PR state." }]));

tool("GITHUB_GET_A_PULL_REQUEST", "Get a pull request", "Fetches a single pull request by number.", "pulls",
  obj([owner, repo, { name: "pull_number", type: "integer", description: "The number that identifies the pull request." }], ["owner", "repo", "pull_number"]),
  obj([{ name: "id", type: "integer", description: "PR id." }, { name: "number", type: "integer", description: "PR number." }, { name: "state", type: "string", description: "PR state." }, { name: "head", type: "object", description: "Head ref info, contains sha." }, { name: "merged", type: "boolean", description: "Whether merged." }]));

tool("GITHUB_UPDATE_A_PULL_REQUEST", "Update a pull request", "Updates title, body, state, or base branch of a PR.", "pulls",
  obj([owner, repo, { name: "pull_number", type: "integer", description: "The number that identifies the pull request." },
    { name: "title", type: "string", description: "New title." }, { name: "body", type: "string", description: "New body." },
    { name: "state", type: "string", description: "open or closed." }, { name: "base", type: "string", description: "New base branch name." }],
    ["owner", "repo", "pull_number"]),
  obj([{ name: "id", type: "integer", description: "PR id." }, { name: "number", type: "integer", description: "PR number." }]));

tool("GITHUB_LIST_PULL_REQUESTS", "List pull requests", "Lists pull requests in a repository, optionally filtered by state, head, or base.", "pulls",
  obj([owner, repo, { name: "state", type: "string", description: "open, closed, all." },
    { name: "head", type: "string", description: "Filter by head user/org and branch, e.g. 'user:ref-name'." },
    { name: "base", type: "string", description: "Filter by base branch name." }], ["owner", "repo"]),
  arrayOf([{ name: "id", type: "integer", description: "PR id." }, { name: "number", type: "integer", description: "The pull request number." },
    { name: "title", type: "string", description: "PR title." }, { name: "state", type: "string", description: "PR state." },
    { name: "head", type: "object", description: "Head branch ref/sha." }, { name: "base", type: "object", description: "Base branch ref." }]));

tool("GITHUB_MERGE_A_PULL_REQUEST", "Merge a pull request", "Merges a pull request.", "pulls",
  obj([owner, repo, { name: "pull_number", type: "integer", description: "The number that identifies the pull request." },
    { name: "commit_title", type: "string", description: "Title for the merge commit." },
    { name: "merge_method", type: "string", description: "merge, squash, or rebase." }], ["owner", "repo", "pull_number"]),
  obj([{ name: "sha", type: "string", description: "SHA of the merge commit." }, { name: "merged", type: "boolean", description: "Whether the merge succeeded." }]));

tool("GITHUB_CLOSE_PULL_REQUEST", "Close a pull request", "Closes a pull request without merging.", "pulls",
  obj([owner, repo, { name: "pull_number", type: "integer", description: "The number that identifies the pull request." }], ["owner", "repo", "pull_number"]),
  obj([{ name: "number", type: "integer", description: "PR number." }, { name: "state", type: "string", description: "New state." }]));

tool("GITHUB_REOPEN_PULL_REQUEST", "Reopen a pull request", "Reopens a closed pull request.", "pulls",
  obj([owner, repo, { name: "pull_number", type: "integer", description: "The number that identifies the pull request." }], ["owner", "repo", "pull_number"]),
  obj([{ name: "number", type: "integer", description: "PR number." }, { name: "state", type: "string", description: "New state." }]));

tool("GITHUB_MARK_PULL_REQUEST_READY_FOR_REVIEW", "Mark pull request ready for review", "Converts a draft PR into one ready for review.", "pulls",
  obj([owner, repo, { name: "pull_number", type: "integer", description: "The number that identifies the pull request." }], ["owner", "repo", "pull_number"]),
  obj([{ name: "number", type: "integer", description: "PR number." }, { name: "draft", type: "boolean", description: "Whether still a draft." }]));

tool("GITHUB_CONVERT_PULL_REQUEST_TO_DRAFT", "Convert pull request to draft", "Converts an open PR into a draft.", "pulls",
  obj([owner, repo, { name: "pull_number", type: "integer", description: "The number that identifies the pull request." }], ["owner", "repo", "pull_number"]),
  obj([{ name: "number", type: "integer", description: "PR number." }, { name: "draft", type: "boolean", description: "Whether the PR is a draft." }]));

tool("GITHUB_REQUEST_REVIEWERS_FOR_A_PULL_REQUEST", "Request reviewers for a pull request", "Requests reviews from users or teams on a PR.", "pulls",
  obj([owner, repo, { name: "pull_number", type: "integer", description: "The number that identifies the pull request." },
    { name: "reviewers", type: "array", description: "Usernames to request a review from.", items: { type: "string" } },
    { name: "team_reviewers", type: "array", description: "Team slugs to request a review from.", items: { type: "string" } }], ["owner", "repo", "pull_number"]),
  obj([{ name: "number", type: "integer", description: "PR number." }, { name: "requested_reviewers", type: "array", description: "Users requested.", items: { type: "object" } }]));

tool("GITHUB_LIST_COMMITS_ON_A_PULL_REQUEST", "List commits on a pull request", "Lists commits belonging to a PR.", "pulls",
  obj([owner, repo, { name: "pull_number", type: "integer", description: "The number that identifies the pull request." }], ["owner", "repo", "pull_number"]),
  arrayOf([{ name: "sha", type: "string", description: "Commit SHA." }, { name: "commit", type: "object", description: "Commit metadata." }]));

tool("GITHUB_LIST_PULL_REQUESTS_FILES", "List pull requests files", "Lists the files changed in a PR.", "pulls",
  obj([owner, repo, { name: "pull_number", type: "integer", description: "The number that identifies the pull request." }], ["owner", "repo", "pull_number"]),
  arrayOf([{ name: "sha", type: "string", description: "Blob SHA." }, { name: "filename", type: "string", description: "Path of the changed file." }]));

tool("GITHUB_CHECK_IF_PULL_REQUEST_MERGED", "Check if pull request merged", "Checks whether a PR has been merged.", "pulls",
  obj([owner, repo, { name: "pull_number", type: "integer", description: "The number that identifies the pull request." }], ["owner", "repo", "pull_number"]),
  obj([{ name: "merged", type: "boolean", description: "Whether the PR is merged." }]));

// ---------- PR reviews & review comments ----------
tool("GITHUB_CREATE_A_REVIEW_FOR_A_PULL_REQUEST", "Create a review for a pull request", "Creates a review on a PR (comment, approve, or request changes).", "pull_reviews",
  obj([owner, repo, { name: "pull_number", type: "integer", description: "The number that identifies the pull request." },
    { name: "body", type: "string", description: "Review body text." },
    { name: "event", type: "string", description: "APPROVE, REQUEST_CHANGES, or COMMENT." },
    { name: "commit_id", type: "string", description: "SHA of the commit to review." }], ["owner", "repo", "pull_number"]),
  obj([{ name: "id", type: "integer", description: "The review id." }, { name: "state", type: "string", description: "Review state." }]));

tool("GITHUB_GET_A_REVIEW_FOR_A_PULL_REQUEST", "Get a review for a pull request", "Fetches a single PR review by id.", "pull_reviews",
  obj([owner, repo, { name: "pull_number", type: "integer", description: "The number that identifies the pull request." },
    { name: "review_id", type: "integer", description: "The unique identifier of the review." }], ["owner", "repo", "pull_number", "review_id"]),
  obj([{ name: "id", type: "integer", description: "Review id." }, { name: "state", type: "string", description: "Review state." }]));

tool("GITHUB_LIST_REVIEWS_FOR_A_PULL_REQUEST", "List reviews for a pull request", "Lists all reviews left on a PR.", "pull_reviews",
  obj([owner, repo, { name: "pull_number", type: "integer", description: "The number that identifies the pull request." }], ["owner", "repo", "pull_number"]),
  arrayOf([{ name: "id", type: "integer", description: "The review id." }, { name: "state", type: "string", description: "Review state." }, { name: "commit_id", type: "string", description: "SHA reviewed." }]));

tool("GITHUB_SUBMIT_A_REVIEW_FOR_A_PULL_REQUEST", "Submit a review for a pull request", "Submits a pending review.", "pull_reviews",
  obj([owner, repo, { name: "pull_number", type: "integer", description: "The number that identifies the pull request." },
    { name: "review_id", type: "integer", description: "The unique identifier of the pending review." },
    { name: "event", type: "string", description: "APPROVE, REQUEST_CHANGES, or COMMENT." }], ["owner", "repo", "pull_number", "review_id", "event"]),
  obj([{ name: "id", type: "integer", description: "Review id." }, { name: "state", type: "string", description: "Review state." }]));

tool("GITHUB_DISMISS_A_REVIEW_FOR_A_PULL_REQUEST", "Dismiss a review for a pull request", "Dismisses a PR review.", "pull_reviews",
  obj([owner, repo, { name: "pull_number", type: "integer", description: "The number that identifies the pull request." },
    { name: "review_id", type: "integer", description: "The unique identifier of the review." },
    { name: "message", type: "string", description: "Reason for dismissing." }], ["owner", "repo", "pull_number", "review_id", "message"]),
  obj([{ name: "id", type: "integer", description: "Review id." }, { name: "state", type: "string", description: "Review state." }]));

tool("GITHUB_CREATE_A_REVIEW_COMMENT_FOR_A_PULL_REQUEST", "Create a review comment for a pull request", "Creates a comment on a specific diff line of a PR.", "pull_review_comments",
  obj([owner, repo, { name: "pull_number", type: "integer", description: "The number that identifies the pull request." },
    { name: "body", type: "string", description: "Comment text." }, { name: "commit_id", type: "string", description: "SHA of commit to comment on." },
    { name: "path", type: "string", description: "File path." }, { name: "line", type: "integer", description: "Line number in the diff." }],
    ["owner", "repo", "pull_number", "body", "commit_id", "path"]),
  obj([{ name: "id", type: "integer", description: "The comment id." }]));

tool("GITHUB_LIST_REVIEW_COMMENTS_ON_A_PULL_REQUEST", "List review comments on a pull request", "Lists diff-line comments on a PR.", "pull_review_comments",
  obj([owner, repo, { name: "pull_number", type: "integer", description: "The number that identifies the pull request." }], ["owner", "repo", "pull_number"]),
  arrayOf([{ name: "id", type: "integer", description: "The comment id." }, { name: "body", type: "string", description: "Comment text." }]));

tool("GITHUB_GET_A_REVIEW_COMMENT_FOR_A_PULL_REQUEST", "Get a review comment for a pull request", "Fetches a single PR review comment by id.", "pull_review_comments",
  obj([owner, repo, { name: "comment_id", type: "integer", description: "The unique identifier of the comment." }], ["owner", "repo", "comment_id"]),
  obj([{ name: "id", type: "integer", description: "Comment id." }]));

// ---------- Branches / refs ----------
tool("GITHUB_LIST_BRANCHES", "List branches", "Lists branches in a repository.", "branches",
  obj([owner, repo, { name: "protected", type: "boolean", description: "Only return protected branches." }], ["owner", "repo"]),
  arrayOf([{ name: "name", type: "string", description: "Branch name." }, { name: "commit", type: "object", description: "Commit object with sha." }]));

tool("GITHUB_GET_A_BRANCH", "Get a branch", "Fetches a single branch by name.", "branches",
  obj([owner, repo, { name: "branch", type: "string", description: "The branch name." }], ["owner", "repo", "branch"]),
  obj([{ name: "name", type: "string", description: "Branch name." }, { name: "commit", type: "object", description: "Commit object with sha." }]));

tool("GITHUB_RENAME_A_BRANCH", "Rename a branch", "Renames a branch.", "branches",
  obj([owner, repo, { name: "branch", type: "string", description: "Current branch name." },
    { name: "new_name", type: "string", description: "New branch name." }], ["owner", "repo", "branch", "new_name"]),
  obj([{ name: "name", type: "string", description: "New branch name." }]));

tool("GITHUB_MERGE_A_BRANCH", "Merge a branch", "Merges one branch into another.", "branches",
  obj([owner, repo, { name: "base", type: "string", description: "Branch to merge into." },
    { name: "head", type: "string", description: "Branch or SHA to merge from." }], ["owner", "repo", "base", "head"]),
  obj([{ name: "sha", type: "string", description: "SHA of the merge commit." }]));

tool("GITHUB_CREATE_A_REFERENCE", "Create a reference", "Creates a new branch/tag ref, typically from a commit sha.", "refs",
  obj([owner, repo, { name: "ref", type: "string", description: "Fully qualified ref, e.g. refs/heads/my-branch." },
    { name: "sha", type: "string", description: "SHA the ref should point to." }], ["owner", "repo", "ref", "sha"]),
  obj([{ name: "ref", type: "string", description: "The created ref." }, { name: "object", type: "object", description: "Object the ref points to, contains sha." }]));

tool("GITHUB_GET_A_REFERENCE", "Get a reference", "Fetches a git reference.", "refs",
  obj([owner, repo, { name: "ref", type: "string", description: "Ref, e.g. heads/my-branch." }], ["owner", "repo", "ref"]),
  obj([{ name: "ref", type: "string", description: "The ref." }, { name: "object", type: "object", description: "Object the ref points to, contains sha." }]));

tool("GITHUB_DELETE_A_REFERENCE", "Delete a reference", "Deletes a git reference (branch or tag).", "refs",
  obj([owner, repo, { name: "ref", type: "string", description: "Ref to delete, e.g. heads/my-branch." }], ["owner", "repo", "ref"]),
  obj([]));

// ---------- Commits ----------
tool("GITHUB_LIST_COMMITS", "List commits", "Lists commits on a repository, optionally filtered by branch/path/author.", "commits",
  obj([owner, repo, { name: "sha", type: "string", description: "SHA or branch name to list commits from." },
    { name: "path", type: "string", description: "Only commits touching this file path." }], ["owner", "repo"]),
  arrayOf([{ name: "sha", type: "string", description: "The commit SHA." }, { name: "commit", type: "object", description: "Commit metadata (message, author)." }]));

tool("GITHUB_GET_A_COMMIT", "Get a commit", "Fetches a single commit by SHA.", "commits",
  obj([owner, repo, { name: "ref", type: "string", description: "Commit SHA, branch, or tag." }], ["owner", "repo", "ref"]),
  obj([{ name: "sha", type: "string", description: "Commit SHA." }, { name: "commit", type: "object", description: "Commit metadata." }]));

tool("GITHUB_COMPARE_TWO_COMMITS", "Compare two commits", "Compares two commits/branches and returns the diff summary.", "commits",
  obj([owner, repo, { name: "basehead", type: "string", description: "'base...head' comparison, e.g. main...feature-x." }], ["owner", "repo", "basehead"]),
  obj([{ name: "merge_base_commit", type: "object", description: "Common ancestor commit, contains sha." }, { name: "commits", type: "array", description: "Commits between base and head." }]));

tool("GITHUB_CREATE_A_COMMIT_COMMENT", "Create a commit comment", "Comments on a specific commit.", "commit_comments",
  obj([owner, repo, { name: "commit_sha", type: "string", description: "SHA of the commit to comment on." },
    { name: "body", type: "string", description: "Comment text." }], ["owner", "repo", "commit_sha", "body"]),
  obj([{ name: "id", type: "integer", description: "The comment id." }]));

tool("GITHUB_LIST_COMMIT_COMMENTS", "List commit comments", "Lists comments on a specific commit.", "commit_comments",
  obj([owner, repo, { name: "commit_sha", type: "string", description: "SHA of the commit." }], ["owner", "repo", "commit_sha"]),
  arrayOf([{ name: "id", type: "integer", description: "The comment id." }, { name: "body", type: "string", description: "Comment text." }]));

// ---------- Labels ----------
tool("GITHUB_CREATE_A_LABEL", "Create a label", "Creates a label in a repository.", "labels",
  obj([owner, repo, { name: "name", type: "string", description: "Label name." }, { name: "color", type: "string", description: "Hex color, no leading #." }], ["owner", "repo", "name"]),
  obj([{ name: "id", type: "integer", description: "Label id." }, { name: "name", type: "string", description: "Label name." }]));

tool("GITHUB_GET_LABEL", "Get a label", "Fetches a single label by name.", "labels",
  obj([owner, repo, { name: "name", type: "string", description: "The label name." }], ["owner", "repo", "name"]),
  obj([{ name: "id", type: "integer", description: "Label id." }, { name: "name", type: "string", description: "Label name." }]));

tool("GITHUB_LIST_LABELS_FOR_A_REPOSITORY", "List labels for a repository", "Lists all labels defined in a repository.", "labels",
  obj([owner, repo], ["owner", "repo"]),
  arrayOf([{ name: "id", type: "integer", description: "Label id." }, { name: "name", type: "string", description: "The label name." }]));

tool("GITHUB_UPDATE_A_LABEL", "Update a label", "Updates a label's name, color, or description.", "labels",
  obj([owner, repo, { name: "name", type: "string", description: "The current label name." },
    { name: "new_name", type: "string", description: "New label name." }], ["owner", "repo", "name"]),
  obj([{ name: "name", type: "string", description: "Label name." }]));

tool("GITHUB_DELETE_LABEL", "Delete a label", "Deletes a label from a repository.", "labels",
  obj([owner, repo, { name: "name", type: "string", description: "The label name." }], ["owner", "repo", "name"]),
  obj([]));

// ---------- Milestones ----------
tool("GITHUB_CREATE_A_MILESTONE", "Create a milestone", "Creates a milestone in a repository.", "milestones",
  obj([owner, repo, { name: "title", type: "string", description: "Milestone title." },
    { name: "due_on", type: "string", description: "Due date, ISO 8601." }], ["owner", "repo", "title"]),
  obj([{ name: "number", type: "integer", description: "The milestone number, unique within the repository." }, { name: "id", type: "integer", description: "Milestone id." }]));

tool("GITHUB_GET_A_MILESTONE", "Get a milestone", "Fetches a single milestone by number.", "milestones",
  obj([owner, repo, { name: "milestone_number", type: "integer", description: "The number that identifies the milestone." }], ["owner", "repo", "milestone_number"]),
  obj([{ name: "number", type: "integer", description: "Milestone number." }, { name: "title", type: "string", description: "Milestone title." }]));

tool("GITHUB_LIST_MILESTONES", "List milestones", "Lists milestones in a repository.", "milestones",
  obj([owner, repo, { name: "state", type: "string", description: "open, closed, all." }], ["owner", "repo"]),
  arrayOf([{ name: "number", type: "integer", description: "The milestone number." }, { name: "title", type: "string", description: "Milestone title." }]));

tool("GITHUB_UPDATE_A_MILESTONE", "Update a milestone", "Updates a milestone's title, state, or due date.", "milestones",
  obj([owner, repo, { name: "milestone_number", type: "integer", description: "The number that identifies the milestone." },
    { name: "title", type: "string", description: "New title." }, { name: "state", type: "string", description: "open or closed." }], ["owner", "repo", "milestone_number"]),
  obj([{ name: "number", type: "integer", description: "Milestone number." }]));

tool("GITHUB_DELETE_A_MILESTONE", "Delete a milestone", "Deletes a milestone.", "milestones",
  obj([owner, repo, { name: "milestone_number", type: "integer", description: "The number that identifies the milestone." }], ["owner", "repo", "milestone_number"]),
  obj([]));

// ---------- Releases ----------
tool("GITHUB_CREATE_A_RELEASE", "Create a release", "Creates a release from a tag.", "releases",
  obj([owner, repo, { name: "tag_name", type: "string", description: "Tag name for the release." },
    { name: "name", type: "string", description: "Release title." }, { name: "body", type: "string", description: "Release notes." },
    { name: "draft", type: "boolean", description: "Create as a draft." }], ["owner", "repo", "tag_name"]),
  obj([{ name: "id", type: "integer", description: "The release id, unique within the repository." }, { name: "tag_name", type: "string", description: "Tag name." }]));

tool("GITHUB_GET_A_RELEASE", "Get a release", "Fetches a single release by id.", "releases",
  obj([owner, repo, { name: "release_id", type: "integer", description: "The unique identifier of the release." }], ["owner", "repo", "release_id"]),
  obj([{ name: "id", type: "integer", description: "Release id." }, { name: "tag_name", type: "string", description: "Tag name." }]));

tool("GITHUB_LIST_RELEASES", "List releases", "Lists releases in a repository.", "releases",
  obj([owner, repo], ["owner", "repo"]),
  arrayOf([{ name: "id", type: "integer", description: "The release id." }, { name: "tag_name", type: "string", description: "Tag name." }]));

tool("GITHUB_GET_THE_LATEST_RELEASE", "Get the latest release", "Fetches the most recent non-prerelease, non-draft release.", "releases",
  obj([owner, repo], ["owner", "repo"]),
  obj([{ name: "id", type: "integer", description: "The release id." }, { name: "tag_name", type: "string", description: "Tag name." }]));

tool("GITHUB_UPDATE_A_RELEASE", "Update a release", "Updates a release's metadata.", "releases",
  obj([owner, repo, { name: "release_id", type: "integer", description: "The unique identifier of the release." },
    { name: "name", type: "string", description: "New title." }, { name: "body", type: "string", description: "New notes." }], ["owner", "repo", "release_id"]),
  obj([{ name: "id", type: "integer", description: "Release id." }]));

tool("GITHUB_DELETE_A_RELEASE", "Delete a release", "Deletes a release.", "releases",
  obj([owner, repo, { name: "release_id", type: "integer", description: "The unique identifier of the release." }], ["owner", "repo", "release_id"]),
  obj([]));

tool("GITHUB_LIST_RELEASE_ASSETS", "List release assets", "Lists assets uploaded to a release.", "releases",
  obj([owner, repo, { name: "release_id", type: "integer", description: "The unique identifier of the release." }], ["owner", "repo", "release_id"]),
  arrayOf([{ name: "id", type: "integer", description: "The asset id." }, { name: "name", type: "string", description: "Asset filename." }]));

tool("GITHUB_UPLOAD_RELEASE_ASSET", "Upload a release asset", "Uploads a binary asset to a release.", "releases",
  obj([owner, repo, { name: "release_id", type: "integer", description: "The unique identifier of the release." },
    { name: "name", type: "string", description: "Asset filename." }, { name: "data", type: "string", description: "Base64-encoded file contents." }],
    ["owner", "repo", "release_id", "name", "data"]),
  obj([{ name: "id", type: "integer", description: "Asset id." }]));

// ---------- Workflow runs ----------
tool("GITHUB_LIST_WORKFLOW_RUNS_FOR_A_REPOSITORY", "List workflow runs for a repository", "Lists Actions workflow runs for a repository.", "actions",
  obj([owner, repo, { name: "branch", type: "string", description: "Filter by branch name." },
    { name: "status", type: "string", description: "Filter by run status." }], ["owner", "repo"]),
  arrayOf([{ name: "id", type: "integer", description: "The workflow run id." }, { name: "status", type: "string", description: "Run status." }, { name: "head_sha", type: "string", description: "SHA that triggered the run." }]));

tool("GITHUB_GET_A_WORKFLOW_RUN", "Get a workflow run", "Fetches a single workflow run by id.", "actions",
  obj([owner, repo, { name: "run_id", type: "integer", description: "The unique identifier of the workflow run." }], ["owner", "repo", "run_id"]),
  obj([{ name: "id", type: "integer", description: "Workflow run id." }, { name: "status", type: "string", description: "Run status." }]));

tool("GITHUB_CANCEL_WORKFLOW_RUN", "Cancel a workflow run", "Cancels a workflow run that is in progress.", "actions",
  obj([owner, repo, { name: "run_id", type: "integer", description: "The unique identifier of the workflow run." }], ["owner", "repo", "run_id"]),
  obj([]));

tool("GITHUB_RE_RUN_A_WORKFLOW", "Rerun a workflow", "Re-runs all jobs in a workflow run.", "actions",
  obj([owner, repo, { name: "run_id", type: "integer", description: "The unique identifier of the workflow run." }], ["owner", "repo", "run_id"]),
  obj([]));

tool("GITHUB_DELETE_A_WORKFLOW_RUN", "Delete a workflow run", "Deletes a workflow run and its logs.", "actions",
  obj([owner, repo, { name: "run_id", type: "integer", description: "The unique identifier of the workflow run." }], ["owner", "repo", "run_id"]),
  obj([]));

tool("GITHUB_LIST_JOBS_FOR_A_WORKFLOW_RUN", "List jobs for a workflow run", "Lists the jobs that make up a workflow run.", "actions",
  obj([owner, repo, { name: "run_id", type: "integer", description: "The unique identifier of the workflow run." }], ["owner", "repo", "run_id"]),
  arrayOf([{ name: "id", type: "integer", description: "The job id." }, { name: "status", type: "string", description: "Job status." }]));

tool("GITHUB_GET_WORKFLOW_RUN_JOB", "Get a job for a workflow run", "Fetches a single job by id.", "actions",
  obj([owner, repo, { name: "job_id", type: "integer", description: "The unique identifier of the job." }], ["owner", "repo", "job_id"]),
  obj([{ name: "id", type: "integer", description: "Job id." }, { name: "status", type: "string", description: "Job status." }]));

// ---------- Gists ----------
tool("GITHUB_CREATE_A_GIST", "Create a gist", "Creates a new gist.", "gists",
  obj([{ name: "description", type: "string", description: "Gist description." },
    { name: "public", type: "boolean", description: "Whether the gist is public." },
    { name: "files", type: "object", description: "Map of filename to content." }], ["files"]),
  obj([{ name: "id", type: "string", description: "The gist id." }, { name: "html_url", type: "string", description: "Gist URL." }]));

tool("GITHUB_GET_GIST", "Get a gist", "Fetches a single gist by id.", "gists",
  obj([{ name: "gist_id", type: "string", description: "The unique identifier of the gist." }], ["gist_id"]),
  obj([{ name: "id", type: "string", description: "Gist id." }]));

tool("GITHUB_LIST_GISTS_FOR_THE_AUTHENTICATED_USER", "List gists for the authenticated user", "Lists gists owned by the authenticated user.", "gists",
  obj([], []),
  arrayOf([{ name: "id", type: "string", description: "The gist id." }, { name: "description", type: "string", description: "Gist description." }]));

tool("GITHUB_DELETE_GIST", "Delete a gist", "Deletes a gist.", "gists",
  obj([{ name: "gist_id", type: "string", description: "The unique identifier of the gist." }], ["gist_id"]),
  obj([]));

tool("GITHUB_CREATE_A_GIST_COMMENT", "Create a gist comment", "Creates a comment on a gist.", "gist_comments",
  obj([{ name: "gist_id", type: "string", description: "The unique identifier of the gist." },
    { name: "body", type: "string", description: "Comment text." }], ["gist_id", "body"]),
  obj([{ name: "id", type: "integer", description: "The comment id." }]));

tool("GITHUB_LIST_GIST_COMMENTS", "List gist comments", "Lists comments on a gist.", "gist_comments",
  obj([{ name: "gist_id", type: "string", description: "The unique identifier of the gist." }], ["gist_id"]),
  arrayOf([{ name: "id", type: "integer", description: "The comment id." }, { name: "body", type: "string", description: "Comment text." }]));

// ---------- Teams ----------
tool("GITHUB_CREATE_A_TEAM", "Create a team", "Creates a team in an organization.", "teams",
  obj([{ name: "org", type: "string", description: "Organization login." }, { name: "name", type: "string", description: "Team name." }], ["org", "name"]),
  obj([{ name: "id", type: "integer", description: "Team id." }, { name: "slug", type: "string", description: "The team slug, used to identify the team in other endpoints." }]));

tool("GITHUB_GET_A_TEAM_BY_NAME", "Get a team by name", "Fetches a team by its slug.", "teams",
  obj([{ name: "org", type: "string", description: "Organization login." }, { name: "team_slug", type: "string", description: "The slug of the team." }], ["org", "team_slug"]),
  obj([{ name: "id", type: "integer", description: "Team id." }, { name: "slug", type: "string", description: "Team slug." }]));

tool("GITHUB_LIST_TEAMS", "List teams", "Lists teams in an organization.", "teams",
  obj([{ name: "org", type: "string", description: "Organization login." }], ["org"]),
  arrayOf([{ name: "id", type: "integer", description: "The team id." }, { name: "slug", type: "string", description: "The team slug." }]));

tool("GITHUB_ADD_OR_UPDATE_TEAM_MEMBERSHIP_FOR_USER", "Add or update team membership for a user", "Adds a user to a team or updates their role.", "teams",
  obj([{ name: "org", type: "string", description: "Organization login." }, { name: "team_slug", type: "string", description: "The slug of the team." },
    { name: "username", type: "string", description: "The user to add." }, { name: "role", type: "string", description: "member or maintainer." }],
    ["org", "team_slug", "username"]),
  obj([{ name: "state", type: "string", description: "Membership state." }]));

tool("GITHUB_LIST_TEAM_MEMBERS", "List team members", "Lists members of a team.", "teams",
  obj([{ name: "org", type: "string", description: "Organization login." }, { name: "team_slug", type: "string", description: "The slug of the team." }], ["org", "team_slug"]),
  arrayOf([{ name: "login", type: "string", description: "The member's username." }, { name: "id", type: "integer", description: "User id." }]));

// ---------- Repositories ----------
tool("GITHUB_CREATE_A_REPOSITORY_FOR_THE_AUTHENTICATED_USER", "Create a repository for the authenticated user", "Creates a new repository owned by the authenticated user.", "repos",
  obj([{ name: "name", type: "string", description: "Repository name." }, { name: "private", type: "boolean", description: "Whether the repo is private." }], ["name"]),
  obj([{ name: "id", type: "integer", description: "Repository id." }, { name: "name", type: "string", description: "Repository name." }, { name: "owner", type: "object", description: "Owner object, contains login." }]));

tool("GITHUB_GET_A_REPOSITORY", "Get a repository", "Fetches a repository's details.", "repos",
  obj([owner, repo], ["owner", "repo"]),
  obj([{ name: "id", type: "integer", description: "Repository id." }, { name: "full_name", type: "string", description: "owner/repo." }, { name: "default_branch", type: "string", description: "Default branch name." }]));

tool("GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER", "List repositories for the authenticated user", "Lists repositories the authenticated user has access to.", "repos",
  obj([{ name: "type", type: "string", description: "all, owner, member." }], []),
  arrayOf([{ name: "id", type: "integer", description: "Repository id." }, { name: "name", type: "string", description: "The repository name." }, { name: "owner", type: "object", description: "Owner object, contains login." }]));

tool("GITHUB_DELETE_A_REPOSITORY", "Delete a repository", "Deletes a repository.", "repos",
  obj([owner, repo], ["owner", "repo"]),
  obj([]));

tool("GITHUB_ADD_A_REPOSITORY_COLLABORATOR", "Add a repository collaborator", "Invites a user as a collaborator on a repository.", "repos",
  obj([owner, repo, { name: "username", type: "string", description: "The user to invite." },
    { name: "permission", type: "string", description: "pull, push, admin, maintain, triage." }], ["owner", "repo", "username"]),
  obj([{ name: "id", type: "integer", description: "Invitation id." }]));

tool("GITHUB_LIST_REPOSITORY_COLLABORATORS", "List repository collaborators", "Lists users with access to a repository.", "repos",
  obj([owner, repo], ["owner", "repo"]),
  arrayOf([{ name: "login", type: "string", description: "Collaborator username." }, { name: "id", type: "integer", description: "User id." }]));

fs.writeFileSync(path.join(__dirname, "..", "github_catalog.json"), JSON.stringify({ toolkit: "github", tools }, null, 2));
console.log(`Wrote ${tools.length} tools to github_catalog.json`);

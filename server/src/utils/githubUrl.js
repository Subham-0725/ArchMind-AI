// src/utils/githubUrl.js
//
// Utility functions for parsing and validating GitHub repository URLs.

/**
 * Validates and extracts owner and repository name from various GitHub URL formats.
 *
 * Supported formats:
 * - https://github.com/owner/repo
 * - http://github.com/owner/repo
 * - github.com/owner/repo
 * - owner/repo
 * - https://github.com/owner/repo.git
 * - https://github.com/owner/repo/tree/main
 *
 * @param {string} input - The input string provided by the user
 * @returns {{ valid: boolean, owner?: string, repo?: string, fullName?: string, cleanUrl?: string, error?: string }}
 */
export const parseGithubUrl = (input) => {
  if (!input || typeof input !== "string") {
    return { valid: false, error: "GitHub repository URL is required." };
  }

  let cleaned = input.trim();

  // Strip trailing slashes
  cleaned = cleaned.replace(/\/+$/, "");

  // Remove protocol and domain prefix if present
  cleaned = cleaned
    .replace(/^(https?:\/\/)?(www\.)?github\.com\//i, "")
    .replace(/^git@github\.com:/i, "");

  // Remove .git suffix if present
  cleaned = cleaned.replace(/\.git$/i, "");

  // Remove /tree/branch or /blob/branch subpaths
  cleaned = cleaned.replace(/\/(tree|blob)\/.*$/, "");

  // Split into owner and repo parts
  const parts = cleaned.split("/").filter(Boolean);

  if (parts.length < 2) {
    return {
      valid: false,
      error: "Invalid GitHub URL format. Please provide a URL like 'https://github.com/owner/repository' or 'owner/repository'.",
    };
  }

  const [owner, repo] = parts;

  // GitHub username: alphanumeric and single hyphens, 1-39 chars, cannot start/end with hyphen
  const ownerRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;
  // GitHub repo name: alphanumeric, hyphens, underscores, dots, 1-100 chars
  const repoRegex = /^[a-zA-Z0-9_.-]{1,100}$/;

  if (!ownerRegex.test(owner)) {
    return {
      valid: false,
      error: `Invalid GitHub owner or organization name: '${owner}'.`,
    };
  }

  if (!repoRegex.test(repo)) {
    return {
      valid: false,
      error: `Invalid GitHub repository name: '${repo}'.`,
    };
  }

  const fullName = `${owner}/${repo}`;
  const cleanUrl = `https://github.com/${fullName}`;

  return {
    valid: true,
    owner,
    repo,
    fullName,
    cleanUrl,
  };
};

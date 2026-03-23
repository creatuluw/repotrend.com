import fs from "fs";
import path from "path";
import { BskyAgent } from "@atproto/api";

// File paths
const REPOS_FILE = path.join(process.cwd(), "site", "repos.json");
const POSTED_FILE = path.join(process.cwd(), "bsky", "posted-repos.json");
const BSKY_DIR = path.join(process.cwd(), "bsky");

// Bluesky credentials from environment
const BSKY_HANDLE = process.env.BSKY_HANDLE;
const BSKY_APP_PASSWORD = process.env.BSKY_APP_PASSWORD;

// Ensure bsky directory exists
if (!fs.existsSync(BSKY_DIR)) {
  fs.mkdirSync(BSKY_DIR, { recursive: true });
}

// Read repos data
function readRepos() {
  try {
    const data = fs.readFileSync(REPOS_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading repos file:", error.message);
    return [];
  }
}

// Read posted repos
function readPostedRepos() {
  try {
    if (!fs.existsSync(POSTED_FILE)) {
      return [];
    }
    const data = fs.readFileSync(POSTED_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading posted repos file:", error.message);
    return [];
  }
}

// Save posted repos
function savePostedRepos(postedRepos) {
  fs.writeFileSync(POSTED_FILE, JSON.stringify(postedRepos, null, 2));
  console.log("Updated posted repos tracking file.");
}

// Pick a random repo that hasn't been posted yet
function pickUnpostedRepo(repos, postedRepos) {
  const postedIds = new Set(postedRepos.map((r) => r.id));
  const unpostedRepos = repos.filter((repo) => !postedIds.has(repo.id));

  if (unpostedRepos.length === 0) {
    console.log("All repos have been posted already!");
    return null;
  }

  // Pick a random unposted repo
  const randomIndex = Math.floor(Math.random() * unpostedRepos.length);
  return unpostedRepos[randomIndex];
}

// Format repo for Bluesky post (max 300 characters)
function formatRepoPost(repo) {
  // Format matches the site's Bluesky share button
  // Format: 'Check out "Repo Name": URL'
  const text = `Check out "${repo.name}": ${repo.html_url}`;
  return text;
}

// Post to Bluesky
async function postToBluesky(text) {
  const agent = new BskyAgent({
    service: "https://bsky.social",
  });

  try {
    console.log(`Logging in as ${BSKY_HANDLE}...`);
    await agent.login({
      identifier: BSKY_HANDLE,
      password: BSKY_APP_PASSWORD,
    });
    console.log("Logged in successfully!");

    const post = {
      $type: "app.bsky.feed.post",
      text: text,
      createdAt: new Date().toISOString(),
    };

    const response = await agent.post(post);
    console.log("Post created successfully!");
    console.log("Post URI:", response.uri);

    return response;
  } catch (error) {
    console.error("Error posting to Bluesky:", error.message);
    throw error;
  }
}

// Main function
async function main() {
  console.log("=== RepoTrend Bluesky Poster ===\n");

  // Validate credentials
  if (!BSKY_HANDLE || !BSKY_APP_PASSWORD) {
    console.error(
      "Error: BSKY_HANDLE and BSKY_APP_PASSWORD environment variables must be set.",
    );
    process.exit(1);
  }

  // Read repos
  console.log("Reading repos from site/repos.json...");
  const repos = readRepos();

  if (repos.length === 0) {
    console.error("Error: No repos found in site/repos.json");
    process.exit(1);
  }
  console.log(`Found ${repos.length} repos.\n`);

  // Read posted repos
  console.log("Reading posted repos tracking...");
  const postedRepos = readPostedRepos();
  console.log(`Already posted ${postedRepos.length} repos.\n`);

  // Pick an unposted repo
  console.log("Picking a random unposted repo...");
  const repo = pickUnpostedRepo(repos, postedRepos);

  if (!repo) {
    console.log("No new repos to post.");
    process.exit(0);
  }
  console.log(`Selected: ${repo.name} (${repo.html_url})\n`);

  // Format post
  const postText = formatRepoPost(repo);
  console.log("Post text:");
  console.log("---");
  console.log(postText);
  console.log("---\n");

  // Post to Bluesky
  console.log("Posting to Bluesky...");
  try {
    await postToBluesky(postText);

    // Save to posted repos
    postedRepos.push({
      id: repo.id,
      name: repo.name,
      html_url: repo.html_url,
      posted_at: new Date().toISOString(),
    });
    savePostedRepos(postedRepos);

    console.log("\n=== Post completed successfully! ===");
  } catch (error) {
    console.error("\n=== Failed to post ===");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

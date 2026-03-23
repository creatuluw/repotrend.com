import fs from "fs";
import path from "path";
import React from "react";
import { BskyAgent } from "@atproto/api";
import { ImageResponse, GoogleFont, cache } from "@cf-wasm/og/node";

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

  const randomIndex = Math.floor(Math.random() * unpostedRepos.length);
  return unpostedRepos[randomIndex];
}

// Format number for display (e.g., 16885 -> "16.9k")
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "k";
  }
  return num.toString();
}

// Generate custom OG image using @cf-wasm/og
async function generateOgImage(repo) {
  console.log("Generating custom OG image...");

  // Simple fallback values
  const repoName = repo.name || "Unknown Repo";
  const ownerName = repo.owner?.login || "unknown";
  const description = (repo.description || "No description").substring(0, 100);

  try {
    // Simple test - just text with background, no flex
    const imageBuffer = await ImageResponse.async(
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          backgroundColor: "#0d1117",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px",
        }}
      >
        <div style={{ color: "#58a6ff", fontSize: "64px", fontWeight: 700 }}>
          {repoName}
        </div>
        <div style={{ color: "#8b949e", fontSize: "32px", marginTop: "20px" }}>
          by {ownerName}
        </div>
        <div
          style={{
            color: "#c9d1d9",
            fontSize: "28px",
            marginTop: "30px",
            textAlign: "center",
          }}
        >
          {description}
        </div>
        <div style={{ color: "#8b949e", fontSize: "24px", marginTop: "50px" }}>
          te9.dev
        </div>
      </div>,
      {
        width: 1200,
        height: 630,
      },
    );

    console.log("OG image generated successfully!");
    return imageBuffer;
  } catch (error) {
    console.error("Error generating OG image:", error.message);
    console.error(error.stack);
    return null;
  }
}

// Upload blob to Bluesky
async function uploadBlob(agent, imageBuffer) {
  try {
    console.log("Uploading image blob to Bluesky...");
    const result = await agent.uploadBlob(imageBuffer, {
      headers: {
        "Content-Type": "image/png",
      },
    });
    console.log("Blob uploaded successfully");
    return result.blob;
  } catch (error) {
    console.error("Error uploading blob:", error.message);
    return null;
  }
}

// Post to Bluesky with embed
async function postToBluesky(repo, imageBlob) {
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

    // Build the embed with custom OG image
    const external = {
      $type: "app.bsky.embed.external",
      external: {
        uri: repo.html_url,
        title: repo.name,
        description: repo.description || "Trending GitHub Repository",
      },
    };

    // Add thumbnail if we have a blob
    if (imageBlob) {
      external.external.thumb = imageBlob;
    }

    // Create the post
    const post = {
      $type: "app.bsky.feed.post",
      text: `${repo.name} - Trending on te9.dev`,
      createdAt: new Date().toISOString(),
      embed: external,
    };

    console.log("Creating post with custom OG image...");
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

  // Generate custom OG image
  const imageBuffer = await generateOgImage(repo);

  // Upload image and post to Bluesky
  let imageBlob = null;
  if (imageBuffer) {
    console.log("Posting to Bluesky with custom OG image...");
    try {
      const agent = new BskyAgent({ service: "https://bsky.social" });
      await agent.login({
        identifier: BSKY_HANDLE,
        password: BSKY_APP_PASSWORD,
      });
      imageBlob = await uploadBlob(agent, imageBuffer);
      await postToBluesky(repo, imageBlob);
    } catch (error) {
      console.error("\n=== Failed to post ===");
      process.exit(1);
    }
  } else {
    console.error("Failed to generate OG image, skipping post");
    process.exit(1);
  }

  // Save to posted repos
  postedRepos.push({
    id: repo.id,
    name: repo.name,
    html_url: repo.html_url,
    posted_at: new Date().toISOString(),
  });
  savePostedRepos(postedRepos);

  console.log("\n=== Post completed successfully! ===");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

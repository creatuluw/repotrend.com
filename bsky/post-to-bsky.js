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

  // Truncate description if too long
  let description = repo.description || "No description";
  if (description.length > 120) {
    description = description.substring(0, 117) + "...";
  }

  // Truncate name if too long
  const repoName =
    repo.name.length > 40 ? repo.name.substring(0, 37) + "..." : repo.name;
  const ownerName =
    repo.owner.login.length > 30
      ? repo.owner.login.substring(0, 27) + "..."
      : repo.owner.login;

  // Prepare topics (max 4)
  const topics = (repo.topics || []).slice(0, 4);

  try {
    const fontData = await fetch(
      "https://github.com/JetBrains/JetBrainsMono/raw/master/fonts/ttf/JetBrainsMono-Regular.ttf",
    ).then((res) => res.arrayBuffer());

    const imageBuffer = await ImageResponse.async(
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          backgroundColor: "#0d1117",
          fontFamily: "JetBrains Mono, monospace",
        }}
      >
        {/* Left side - gradient accent */}
        <div
          style={{
            width: "6px",
            height: "100%",
            background: "linear-gradient(180deg, #ff9500 0%, #00ff88 100%)",
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            padding: "48px",
            boxSizing: "border-box",
          }}
        >
          {/* Header with rank badge */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            {/* te9.dev branding */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span
                style={{
                  color: "#8b949e",
                  fontSize: "24px",
                  fontWeight: 400,
                }}
              >
                te9.dev
              </span>
            </div>

            {/* Trending label */}
            <div
              style={{
                backgroundColor: "#161b22",
                border: "1px solid #30363d",
                borderRadius: "20px",
                padding: "8px 16px",
              }}
            >
              <span
                style={{
                  color: "#ff9500",
                  fontSize: "18px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "2px",
                }}
              >
                Trending
              </span>
            </div>
          </div>

          {/* Center content */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "24px",
              flex: 1,
              justifyContent: "center",
            }}
          >
            {/* Repo name */}
            <div
              style={{
                color: "#58a6ff",
                fontSize: "56px",
                fontWeight: 700,
                lineHeight: 1.2,
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {repoName}
            </div>

            {/* Owner */}
            <div
              style={{
                color: "#8b949e",
                fontSize: "28px",
                fontWeight: 400,
              }}
            >
              by {ownerName}
            </div>

            {/* Description */}
            <div
              style={{
                color: "#c9d1d9",
                fontSize: "28px",
                lineHeight: 1.4,
                maxHeight: "120px",
                overflow: "hidden",
              }}
            >
              {description}
            </div>

            {/* Topics */}
            {topics.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "12px",
                  marginTop: "8px",
                }}
              >
                {topics.map((topic, index) => (
                  <span
                    key={index}
                    style={{
                      backgroundColor: "#161b22",
                      border: "1px solid #30363d",
                      borderRadius: "16px",
                      padding: "6px 14px",
                      color: "#7ee787",
                      fontSize: "18px",
                      fontWeight: 500,
                    }}
                  >
                    {topic}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Footer with stats */}
          <div
            style={{
              display: "flex",
              gap: "32px",
              alignItems: "center",
            }}
          >
            {/* Stars */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#e3b341">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span
                style={{
                  color: "#e3b341",
                  fontSize: "24px",
                  fontWeight: 600,
                }}
              >
                {formatNumber(repo.stargazers_count)}
              </span>
            </div>

            {/* Forks */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#8b949e">
                <path d="M6 3a3 3 0 00-3 3v4a3 3 0 003 3h1v2a2 2 0 002 2h4a2 2 0 002-2v-2h1a3 3 0 003-3V6a3 3 0 00-3-3H6zm1 2a1 1 0 011-1h8a1 1 0 011 1v4a1 1 0 01-1 1h-1v2a2 2 0 01-2 2h-4a2 2 0 01-2-2V10H7a1 1 0 01-1-1V5z" />
              </svg>
              <span
                style={{
                  color: "#8b949e",
                  fontSize: "24px",
                  fontWeight: 600,
                }}
              >
                {formatNumber(repo.forks_count)}
              </span>
            </div>

            {/* Language */}
            {repo.language && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    borderRadius: "50%",
                    backgroundColor:
                      repo.language === "JavaScript"
                        ? "#f1e05a"
                        : repo.language === "TypeScript"
                          ? "#3178c6"
                          : repo.language === "Python"
                            ? "#3572A5"
                            : repo.language === "Rust"
                              ? "#dea584"
                              : repo.language === "Go"
                                ? "#00ADD8"
                                : repo.language === "C++"
                                  ? "#f34b7d"
                                  : "#8b949e",
                  }}
                />
                <span
                  style={{
                    color: "#c9d1d9",
                    fontSize: "24px",
                    fontWeight: 500,
                  }}
                >
                  {repo.language}
                </span>
              </div>
            )}

            {/* GitHub link */}
            <div
              style={{
                marginLeft: "auto",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="#c9d1d9">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              <span
                style={{
                  color: "#8b949e",
                  fontSize: "20px",
                }}
              >
                github.com/{ownerName}
              </span>
            </div>
          </div>
        </div>
      </div>,
      {
        fonts: [
          {
            name: "JetBrains Mono",
            data: fontData,
            weight: 400,
            style: "normal",
          },
          {
            name: "JetBrains Mono",
            data: fontData,
            weight: 600,
            style: "normal",
          },
          {
            name: "JetBrains Mono",
            data: fontData,
            weight: 700,
            style: "normal",
          },
        ],
        width: 1200,
        height: 630,
      },
    );

    console.log("OG image generated successfully!");
    return imageBuffer;
  } catch (error) {
    console.error("Error generating OG image:", error.message);
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

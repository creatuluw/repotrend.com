repotrend\bsky\post-to-bsky.js
```

```javascript
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

  const randomIndex = Math.floor(Math.random() * unpostedRepos.length);
  return unpostedRepos[randomIndex];
}

// Fetch og:image from GitHub repo page
async function fetchOgImage(url) {
  console.log(`Fetching OG image from: ${url}`);

  try {
    const response = await fetch(url);
    const html = await response.text();

    // Parse og:image from HTML
    const match = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i);
    let imageUrl = null;

    if (match) {
      imageUrl = match[1];
    } else {
      // Try alternate format
      const altMatch = html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:image["']/i);
      if (altMatch) {
        imageUrl = altMatch[1];
      }
    }

    // Handle relative image URLs
    if (imageUrl && !imageUrl.startsWith("http")) {
      const urlObj = new URL(url);
      imageUrl = imageUrl.startsWith("//")
        ? `${urlObj.protocol}${imageUrl}`
        : `${urlObj.origin}${imageUrl}`;
    }

    if (imageUrl) {
      console.log(`Found OG image: ${imageUrl}`);
    } else {
      console.log("No OG image found");
    }

    return imageUrl;
  } catch (error) {
    console.error("Error fetching OG image:", error.message);
    return null;
  }
}

// Download image and return as buffer
async function downloadImage(imageUrl) {
  if (!imageUrl) return null;

  try {
    console.log(`Downloading image: ${imageUrl}`);
    const response = await fetch(imageUrl);
    const buffer = await response.arrayBuffer();

    // Check size (limit to 1MB)
    if (buffer.byteLength > 1000000) {
      console.warn("Image too large, skipping thumbnail");
      return null;
    }

    return Buffer.from(buffer);
  } catch (error) {
    console.error("Error downloading image:", error.message);
    return null;
  }
}

// Upload blob to Bluesky
async function uploadBlob(agent, imageBuffer) {
  try {
    console.log("Uploading image blob to Bluesky...");
    const result = await agent.uploadBlob(imageBuffer, {
      headers: {
        "Content-Type": "image/jpeg",
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

    // Build the embed with GitHub OG image
    let embed = null;
    if (imageBlob) {
      embed = {
        $type: "app.bsky.embed.external",
        external: {
          uri: repo.html_url,
          title: repo.name,
          description: repo.description || "Trending GitHub Repository",
          thumb: imageBlob,
        },
      };
    }

    // Create the post
    const post = {
      $type: "app.bsky.feed.post",
      text: `${repo.name} - Trending on te9.dev\n\n${repo.html_url}`,
      createdAt: new Date().toISOString(),
    };

    // Add embed if available
    if (embed) {
      post.embed = embed;
    }

    console.log("Creating post with embed...");
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

  // Fetch OG image from GitHub
  const ogImageUrl = await fetchOgImage(repo.html_url);

  // Download og:image if available
  let imageBlob = null;
  if (ogImageUrl) {
    const imageBuffer = await downloadImage(ogImageUrl);
    if (imageBuffer) {
      // Login and upload blob
      const agent = new BskyAgent({ service: "https://bsky.social" });
      await agent.login({
        identifier: BSKY_HANDLE,
        password: BSKY_APP_PASSWORD,
      });
      imageBlob = await uploadBlob(agent, imageBuffer);
    }
  }

  // Post to Bluesky with embed
  console.log("Posting to Bluesky with URL card...");
  try {
    await postToBluesky(repo, imageBlob);

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

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

// Fetch OG meta tags from a URL
async function fetchOgTags(url) {
  console.log(`Fetching OG tags from: ${url}`);

  try {
    const response = await fetch(url);
    const html = await response.text();

    // Parse OG tags from HTML
    const getMetaContent = (property) => {
      const match = html.match(
        new RegExp(
          `<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']*)["']`,
          "i",
        ),
      );
      if (match) return match[1];
      // Try alternate format: <meta content="..." property="...">
      const altMatch = html.match(
        new RegExp(
          `<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${property}["']`,
          "i",
        ),
      );
      if (altMatch) return altMatch[1];
      return null;
    };

    const title =
      getMetaContent("og:title") || getMetaContent("twitter:title") || "";
    const description =
      getMetaContent("og:description") ||
      getMetaContent("twitter:description") ||
      "";
    const image =
      getMetaContent("og:image") || getMetaContent("twitter:image") || "";

    // Handle relative image URLs
    let fullImageUrl = image;
    if (image && !image.startsWith("http")) {
      const urlObj = new URL(url);
      fullImageUrl = image.startsWith("//")
        ? `${urlObj.protocol}${image}`
        : `${urlObj.origin}${image}`;
    }

    console.log(`OG Title: ${title}`);
    console.log(
      `OG Description: ${description ? description.substring(0, 50) + "..." : "none"}`,
    );
    console.log(
      `OG Image: ${fullImageUrl ? fullImageUrl.substring(0, 50) + "..." : "none"}`,
    );

    return { title, description, image: fullImageUrl };
  } catch (error) {
    console.error("Error fetching OG tags:", error.message);
    return { title: "", description: "", image: "" };
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
async function postToBluesky(repo, ogTags, imageBlob) {
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

    // Build the embed
    let embed = null;
    if (ogTags.title || ogTags.description) {
      const external = {
        $type: "app.bsky.embed.external",
        external: {
          uri: repo.html_url,
          title: ogTags.title || repo.name,
          description: ogTags.description || repo.description || "",
        },
      };

      // Add thumbnail if we have a blob
      if (imageBlob) {
        external.external.thumb = imageBlob;
      }

      embed = external;
    }

    // Create the post
    const post = {
      $type: "app.bsky.feed.post",
      text: `${repo.name}`,
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

  // Fetch OG tags from the GitHub repo
  const ogTags = await fetchOgTags(repo.html_url);

  // Download og:image if available
  let imageBlob = null;
  if (ogTags.image) {
    const imageBuffer = await downloadImage(ogTags.image);
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
    await postToBluesky(repo, ogTags, imageBlob);

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

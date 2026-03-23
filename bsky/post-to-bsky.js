import fs from "fs";
import path from "path";
import { BskyAgent } from "@atproto/api";

// File paths
const REPOS_FILE = path.join(process.cwd(), "site", "repos.json");
const POSTED_FILE = path.join(process.cwd(), "bsky", "posted-repos.json");
const BSKY_DIR = path.join(process.cwd(), "bsky");
const CARD_TEMPLATE_FILE = path.join(
  process.cwd(),
  "bsky",
  "og-card-template.html",
);

// Bluesky credentials from environment
const BSKY_HANDLE = process.env.BSKY_HANDLE;
const BSKY_APP_PASSWORD = process.env.BSKY_APP_PASSWORD;
const MARKUPGO_API_KEY = process.env.MARKUPGO_API_KEY;

// Base URL for the deployed repo pages
const BASE_URL = "https://te9.dev/repotrend/repo";

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

// Get CSS class for language color
function getLanguageCss(language) {
  const langMap = {
    JavaScript: "javascript",
    TypeScript: "typescript",
    Python: "python",
    Rust: "rust",
    Go: "go",
    "C++": "cpp",
    Java: "java",
    Ruby: "ruby",
    PHP: "php",
    Swift: "swift",
    Kotlin: "kotlin",
  };
  return langMap[language] || "default";
}

// Load HTML card template
function loadCardTemplate() {
  try {
    return fs.readFileSync(CARD_TEMPLATE_FILE, "utf8");
  } catch (error) {
    console.error("Error reading card template:", error.message);
    return null;
  }
}

// Generate HTML card for OG image
function generateCardHtml(repo) {
  let html = loadCardTemplate();
  if (!html) return null;

  // Truncate description if too long
  let description = repo.description || "No description";
  if (description.length > 150) {
    description = description.substring(0, 147) + "...";
  }

  // Truncate name if too long
  let repoName = repo.name || "Unknown Repo";
  if (repoName.length > 50) {
    repoName = repoName.substring(0, 47) + "...";
  }

  // Get owner name
  let ownerName = repo.owner?.login;
  if (!ownerName && repo.html_url) {
    // Extract owner from html_url like https://github.com/owner/repo
    const match = repo.html_url.match(/github\.com\/([^\/]+)/);
    if (match) {
      ownerName = match[1];
    }
  }
  ownerName = ownerName || "unknown";

  // Get topics (max 4)
  const topics = (repo.topics || []).slice(0, 4);

  // Format stars and forks
  const stars = formatNumber(repo.stargazers_count || 0);
  const forks = formatNumber(repo.forks_count || 0);
  const language = repo.language || "Code";
  const languageCss = getLanguageCss(language);

  // Replace placeholders
  html = html.replace(/\{\{REPO_NAME\}\}/g, repoName);
  html = html.replace(/\{\{OWNER_NAME\}\}/g, ownerName);
  html = html.replace(/\{\{DESCRIPTION\}\}/g, description);
  html = html.replace(/\{\{STARS\}\}/g, stars);
  html = html.replace(/\{\{FORKS\}\}/g, forks);
  html = html.replace(/\{\{LANGUAGE\}\}/g, language);
  html = html.replace(/\{\{LANGUAGE_CSS\}\}/g, languageCss);

  // Handle topics - build HTML for each topic
  const topicsHtml = topics
    .map((topic) => `<span class="topic">${topic}</span>`)
    .join("");

  // Replace topics section
  const topicsRegex = /\{\{#each TOPICS\}\}[\s\S]*?\{\{\/each\}\}/;
  if (topics.length > 0) {
    html = html.replace(topicsRegex, topicsHtml);
  } else {
    // Remove topics section if no topics
    html = html.replace(topicsRegex, "");
  }

  return html;
}

// Generate image using markupgo API
async function generateOgImage(html) {
  console.log("Generating OG image using markupgo API...");

  try {
    const response = await fetch("https://api.markupgo.com/api/v1/image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": MARKUPGO_API_KEY,
      },
      body: JSON.stringify({
        source: {
          type: "html",
          data: html,
        },
        options: {
          properties: {
            format: "png",
            quality: 90,
            width: 1200,
            height: 630,
            omitBackground: false,
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Markupgo API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log("Markupgo response:", result);

    // The API returns a task with a URL to the generated image
    if (result.url) {
      console.log("Generated image URL:", result.url);
      return result.url;
    } else if (result.id) {
      // Poll for the result if it's async
      console.log("Image generation started, ID:", result.id);
      return await pollForImageResult(result.id);
    } else {
      throw new Error("No image URL in response");
    }
  } catch (error) {
    console.error("Error generating OG image:", error.message);
    return null;
  }
}

// Poll for image result (if the API is async)
async function pollForImageResult(taskId) {
  const maxAttempts = 20;
  const pollInterval = 2000; // 2 seconds

  for (let i = 0; i < maxAttempts; i++) {
    try {
      console.log(`Polling for result... (attempt ${i + 1}/${maxAttempts})`);

      const response = await fetch(
        `https://api.markupgo.com/api/v1/image/${taskId}`,
        {
          headers: {
            "x-api-key": MARKUPGO_API_KEY,
          },
        },
      );

      if (!response.ok) {
        console.log(`Poll response not OK: ${response.status}`);
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        continue;
      }

      const result = await response.json();
      console.log("Poll result:", result);

      // Check if the image is ready
      if (result.url) {
        return result.url;
      }

      // Check status
      if (result.status === "failed") {
        throw new Error("Image generation failed");
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    } catch (error) {
      console.error("Error polling:", error.message);
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }

  throw new Error("Timeout waiting for image generation");
}

// Download image and return as buffer
async function downloadImage(imageUrl) {
  if (!imageUrl) return null;

  try {
    console.log(`Downloading image: ${imageUrl}`);
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status}`);
    }
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
        "Content-Type": "image/png",
      },
    });
    console.log("Blob uploaded successfully");
    return result.data.blob;
  } catch (error) {
    console.error("Error uploading blob:", error.message);
    return null;
  }
}

// Post to Bluesky with external embed
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

    const repoName = repo.name || "Unknown Repo";
    const description = repo.description || "Trending on te9.dev";
    const stars = formatNumber(repo.stargazers_count || 0);
    const forks = formatNumber(repo.forks_count || 0);
    const pageUrl = `${BASE_URL}/${repoName}.html`;

    // Build the external embed
    const external = {
      $type: "app.bsky.embed.external#external",
      uri: pageUrl,
      title: `${repoName} - Trending on te9.dev`,
      description: description,
    };

    // Add thumb if we have an image blob
    if (imageBlob) {
      external.thumb = imageBlob;
    }

    const embed = {
      $type: "app.bsky.embed.external",
      external: external,
    };

    // Create the post
    const post = {
      $type: "app.bsky.feed.post",
      text: `${repoName} | ${stars} stars | ${forks} forks\n\n${description}`,
      createdAt: new Date().toISOString(),
      embed: embed,
    };

    console.log("Creating post with external embed...");
    console.log(`  URL: ${pageUrl}`);
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

  if (!MARKUPGO_API_KEY) {
    console.error("Error: MARKUPGO_API_KEY environment variable must be set.");
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

  // Generate HTML card for OG image
  console.log("Generating HTML card...");
  const cardHtml = generateCardHtml(repo);
  if (!cardHtml) {
    console.error("Failed to generate HTML card");
    process.exit(1);
  }

  // Save HTML for debugging
  const debugHtmlFile = path.join(BSKY_DIR, "debug-card.html");
  fs.writeFileSync(debugHtmlFile, cardHtml);
  console.log(`Debug HTML saved to ${debugHtmlFile}`);

  // Generate image using markupgo
  console.log("Generating OG image...");
  const imageUrl = await generateOgImage(cardHtml);

  let imageBlob = null;
  if (imageUrl) {
    // Download the generated image
    const imageBuffer = await downloadImage(imageUrl);
    if (imageBuffer) {
      // Login and upload blob
      console.log("Uploading thumbnail to Bluesky...");
      const agent = new BskyAgent({ service: "https://bsky.social" });
      await agent.login({
        identifier: BSKY_HANDLE,
        password: BSKY_APP_PASSWORD,
      });
      imageBlob = await uploadBlob(agent, imageBuffer);
    }
  }

  // Post to Bluesky with external embed
  console.log("Posting to Bluesky with external embed...");
  try {
    await postToBluesky(repo, imageBlob);
  } catch (error) {
    console.error("\n=== Failed to post ===");
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

import fs from "fs";
import path from "path";
import { BskyAgent } from "@atproto/api";

// File paths
const REPOS_FILE = path.join(process.cwd(), "site", "repos.json");
const POSTED_FILE = path.join(process.cwd(), "bsky", "posted-repos.json");
const BSKY_DIR = path.join(process.cwd(), "bsky");
const OG_IMAGES_DIR = path.join(process.cwd(), "site", "og-images");

// Bluesky credentials from environment
const BSKY_HANDLE = process.env.BSKY_HANDLE;
const BSKY_APP_PASSWORD = process.env.BSKY_APP_PASSWORD;

// Base URL for the deployed repo pages
const BASE_URL = "https://te9.dev/repotrend";
const REPO_PAGES_URL = `${BASE_URL}/repo`;
const OG_IMAGES_URL = `${BASE_URL}/og-images`;

// Directory where repo HTML pages are stored
const REPO_DIR = path.join(process.cwd(), "site", "repo");

// Check if repo has a corresponding HTML page
function repoPageExists(repo) {
  const pagePath = path.join(REPO_DIR, `${repo.name}.html`);
  return fs.existsSync(pagePath);
}

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

// Pick a random repo that hasn't been posted yet AND has an HTML page
function pickUnpostedRepo(repos, postedRepos) {
  const postedIds = new Set(postedRepos.map((r) => r.id));

  // Filter for repos that:
  // 1. Haven't been posted yet
  // 2. Have an HTML page in site/repo/
  const unpostedRepos = repos.filter(
    (repo) => !postedIds.has(repo.id) && repoPageExists(repo),
  );

  if (unpostedRepos.length === 0) {
    // Check why we have no repos to post
    const reposWithoutPages = repos.filter(
      (repo) => !postedIds.has(repo.id) && !repoPageExists(repo),
    );
    if (reposWithoutPages.length > 0) {
      console.log(
        `Note: ${reposWithoutPages.length} unposted repos are missing HTML pages.`,
      );
    }
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

// Truncate text to a maximum number of graphemes (characters)
function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
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

// Get local OG image path for a repo
function getLocalOgImagePath(repoName) {
  const imagePath = path.join(OG_IMAGES_DIR, `${repoName}.png`);
  return fs.existsSync(imagePath) ? imagePath : null;
}

// Get OG image URL for a repo
function getOgImageUrl(repoName) {
  return `${OG_IMAGES_URL}/${repoName}.png`;
}

// Read local image file and return as buffer
function readLocalImage(imagePath) {
  if (!imagePath) return null;

  try {
    console.log(`Reading local image: ${imagePath}`);
    const buffer = fs.readFileSync(imagePath);

    // Check size (limit to 1MB)
    if (buffer.byteLength > 1000000) {
      console.warn("Image too large, skipping thumbnail");
      return null;
    }

    return buffer;
  } catch (error) {
    console.error("Error reading local image:", error.message);
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

    const repoName = truncateText(repo.name || "Unknown Repo", 40);
    const description = truncateText(
      repo.description || "Trending on te9.dev",
      220,
    );
    const stars = formatNumber(repo.stargazers_count || 0);
    const forks = formatNumber(repo.forks_count || 0);
    const pageUrl = `${REPO_PAGES_URL}/${repoName}.html`;

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

  // Get local OG image
  console.log("Getting OG image...");
  const localImagePath = getLocalOgImagePath(repo.name);

  let imageBlob = null;
  if (localImagePath) {
    console.log(`Found local image: ${localImagePath}`);
    const imageBuffer = readLocalImage(localImagePath);
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
  } else {
    console.log(
      `No local image found for ${repo.name}, posting without thumbnail`,
    );
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

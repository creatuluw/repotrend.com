import fs from "fs";
import path from "path";

const REPOS_FILE = path.join(process.cwd(), "site", "repos.json");
const POSTED_FILE = path.join(process.cwd(), "bsky", "posted-repos.json");
const BSKY_DIR = path.join(process.cwd(), "bsky");
const OG_IMAGES_DIR = path.join(process.cwd(), "site", "og-images");

const BSKY_HANDLE = process.env.BSKY_HANDLE;
const BSKY_APP_PASSWORD = process.env.BSKY_APP_PASSWORD;

const DRY_RUN = process.argv.includes("--dry-run");

function readRepos() {
  try {
    const data = fs.readFileSync(REPOS_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading repos file:", error.message);
    return [];
  }
}

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

function pickUnpostedRepo(repos, postedRepos) {
  const postedIds = new Set(postedRepos.map((r) => r.id));
  const unpostedRepos = repos.filter((repo) => !postedIds.has(repo.id));

  if (unpostedRepos.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * unpostedRepos.length);
  return unpostedRepos[randomIndex];
}

function loadCardTemplate() {
  try {
    return fs.readFileSync(CARD_TEMPLATE_FILE, "utf8");
  } catch (error) {
    console.error("Error reading card template:", error.message);
    return null;
  }
}

function generateCardHtml(repo) {
  let html = loadCardTemplate();
  if (!html) return null;

  let description = repo.description || "No description";
  if (description.length > 150) {
    description = description.substring(0, 147) + "...";
  }

  let repoName = repo.name || "Unknown Repo";
  if (repoName.length > 50) {
    repoName = repoName.substring(0, 47) + "...";
  }

  const ownerName = repo.owner?.login || "unknown";
  const topics = (repo.topics || []).slice(0, 4);

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
  const languageCss = langMap[repo.language] || "default";

  html = html.replace(/\{\{REPO_NAME\}\}/g, repoName);
  html = html.replace(/\{\{OWNER_NAME\}\}/g, ownerName);
  html = html.replace(/\{\{DESCRIPTION\}\}/g, description);
  html = html.replace(
    /\{\{STARS\}\}/g,
    (repo.stargazers_count || 0).toString(),
  );
  html = html.replace(/\{\{FORKS\}\}/g, (repo.forks_count || 0).toString());
  html = html.replace(/\{\{LANGUAGE\}\}/g, repo.language || "Code");
  html = html.replace(/\{\{LANGUAGE_CSS\}\}/g, languageCss);

  const topicsHtml = topics
    .map((t) => `<span class="topic">${t}</span>`)
    .join("");
  html = html.replace(
    /\{\{#each TOPICS\}\}[\s\S]*?\{\{\/each\}\}/,
    topicsHtml || "",
  );

  return html;
}

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "k";
  return num.toString();
}

async function simulateWorkflow(repo) {
  console.log("\n=== DRY RUN: Bluesky Post Simulation ===\n");

  console.log("Step 1: Selected Repository");
  console.log("  Name:", repo.name);
  console.log("  Owner:", repo.owner?.login);
  console.log("  URL:", repo.html_url);
  console.log("  Description:", repo.description?.substring(0, 100) + "...");
  console.log("  Stars:", formatNumber(repo.stargazers_count));
  console.log("  Forks:", formatNumber(repo.forks_count));
  console.log("  Language:", repo.language);

  if (repo.topics?.length > 0) {
    console.log("  Topics:", repo.topics.slice(0, 4).join(", "));
  }

  console.log("\nStep 2: Generated HTML Card");
  const cardHtml = generateCardHtml(repo);
  if (cardHtml) {
    const debugFile = path.join(BSKY_DIR, "test-debug-card.html");
    fs.writeFileSync(debugFile, cardHtml);
    console.log("  Saved to:", debugFile);
  }

  console.log("\nStep 3: Would Get OG Image");
  const localImagePath = path.join(OG_IMAGES_DIR, `${repo.name}.png`);
  if (fs.existsSync(localImagePath)) {
    console.log("  Local Image: Found at", localImagePath);
    console.log("  Image Size: 1200x630");
  } else {
    console.log("  Local Image: Not found (would post without thumbnail)");
  }

  console.log("\nStep 4: Post Content");
  const postText = `${repo.name} - Trending on te9.dev\n\n${repo.html_url}`;
  console.log("  Text:", postText);
  console.log("  Embed: External card with image (if generated)");

  console.log("\nStep 5: Bluesky Credentials");
  if (BSKY_HANDLE && BSKY_APP_PASSWORD) {
    console.log("  Handle:", BSKY_HANDLE);
    console.log("  Password: Set");
  } else {
    console.log("  Handle: Not set");
    console.log("  Password: Not set");
  }

  if (!DRY_RUN) {
    console.log("\nStep 6: Would Update posted-repos.json");
    console.log("  Would add:", {
      id: repo.id,
      name: repo.name,
      html_url: repo.html_url,
    });
  }

  console.log("\n=== Simulation Complete ===\n");
  console.log("This was a DRY RUN. No actual post was made to Bluesky.");
  console.log("To actually post, set BSKY_HANDLE and BSKY_APP_PASSWORD.");
  console.log("Make sure site/og-images/ contains the PNG images.");
  console.log(
    "Or remove --dry-run flag (not recommended without real credentials).\n",
  );
}

async function main() {
  console.log("=== RepoTrend Bluesky Poster - Test Mode ===\n");

  const repos = readRepos();
  if (repos.length === 0) {
    console.error("No repos found in site/repos.json");
    process.exit(1);
  }
  console.log(`Loaded ${repos.length} repos from site/repos.json`);

  const postedRepos = readPostedRepos();
  console.log(`Found ${postedRepos.length} already posted repos\n`);

  const repo = pickUnpostedRepo(repos, postedRepos);
  if (!repo) {
    console.log("All repos have been posted already!");
    process.exit(0);
  }

  await simulateWorkflow(repo);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

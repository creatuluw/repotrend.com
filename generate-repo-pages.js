import fs from "fs";
import path from "path";

const SITE_DIR = path.join(process.cwd(), "site");
const REPOS_FILE = path.join(SITE_DIR, "repos.json");
const TEMPLATE_FILE = path.join(SITE_DIR, "repo", "repo.html");
const OUTPUT_DIR = path.join(SITE_DIR, "repo");

const MARKUPGO_API_KEY = process.env.MARKUPGO_API_KEY;

// Base URL for the deployed pages
const BASE_URL = "https://te9.dev/repotrend/repo";

function readRepos() {
  try {
    const data = fs.readFileSync(REPOS_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading repos file:", error.message);
    return [];
  }
}

function readTemplate() {
  try {
    return fs.readFileSync(TEMPLATE_FILE, "utf8");
  } catch (error) {
    console.error("Error reading template:", error.message);
    return null;
  }
}

function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "k";
  }
  return num.toString();
}

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

function getOwnerName(repo) {
  // Try owner.login first, then extract from html_url
  if (repo.owner?.login) {
    return repo.owner.login;
  }
  if (repo.owner?.html_url) {
    // Extract owner name from URL like "https://github.com/username"
    const match = repo.owner.html_url.match(/github\.com\/(.+)/);
    if (match && match[1]) {
      return match[1].split("/").pop() || "unknown";
    }
  }
  return "unknown";
}

async function generateOgImage(repo) {
  if (!MARKUPGO_API_KEY) {
    console.warn("MARKUPGO_API_KEY not set, using placeholder image");
    return "https://te9.dev/repotrend/og-placeholder.png";
  }

  const cardHtml = generateOgCardHtml(repo);

  try {
    console.log(`Generating OG image for ${repo.name}...`);
    const response = await fetch("https://api.markupgo.com/api/v1/image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": MARKUPGO_API_KEY,
      },
      body: JSON.stringify({
        source: {
          type: "html",
          data: cardHtml,
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

    if (result.url) {
      return result.url;
    } else if (result.id) {
      return await pollForImageResult(result.id);
    }

    throw new Error("No image URL in response");
  } catch (error) {
    console.error(`Error generating OG image for ${repo.name}:`, error.message);
    return "https://te9.dev/repotrend/og-placeholder.png";
  }
}

async function pollForImageResult(taskId) {
  const maxAttempts = 20;
  const pollInterval = 2000;

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
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        continue;
      }

      const result = await response.json();
      if (result.url) {
        return result.url;
      }

      if (result.status === "failed") {
        throw new Error("Image generation failed");
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    } catch (error) {
      console.error("Error polling:", error.message);
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }

  throw new Error("Timeout waiting for image generation");
}

function generateOgCardHtml(repo) {
  let description = repo.description || "No description";
  if (description.length > 150) {
    description = description.substring(0, 147) + "...";
  }

  const repoName = repo.name || "Unknown Repo";
  const ownerName = getOwnerName(repo);
  const stars = formatNumber(repo.stargazers_count || 0);
  const forks = formatNumber(repo.forks_count || 0);
  const language = repo.language || "Code";
  const languageCss = getLanguageCss(language);
  const topics = (repo.topics || []).slice(0, 4);

  const topicsHtml = topics
    .map((topic) => `<span class="topic">${topic}</span>`)
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>OG Card</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Lekton:wght@400;700&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: "Lekton", sans-serif; background-color: #0a0a0a; color: #e8e8e8; width: 1200px; height: 630px; display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative; }
    body::before { content: ""; position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0.03; pointer-events: none; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E"); }
    .deco-rings { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 800px; height: 800px; pointer-events: none; z-index: 1; }
    .deco-ring { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); border-radius: 50%; border: 1px solid #2a2a2a; }
    .deco-ring-1 { width: 400px; height: 400px; opacity: 0.4; }
    .deco-ring-2 { width: 550px; height: 550px; opacity: 0.3; }
    .deco-ring-3 { width: 700px; height: 700px; opacity: 0.2; }
    .card { position: relative; z-index: 10; width: 1100px; height: 530px; background: #141414; border: 1px solid #2a2a2a; border-radius: 8px; overflow: hidden; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5); }
    .card::before { content: ""; position: absolute; top: 0; left: 0; width: 100%; height: 3px; background: linear-gradient(90deg, #00ff88, #ff9500); }
    .card-content { display: flex; flex-direction: column; height: 100%; padding: 40px 48px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
    .brand { font-family: "JetBrains Mono", monospace; font-size: 18px; color: #888888; display: flex; align-items: center; gap: 8px; }
    .brand-symbol { color: #00ff88; }
    .brand-cursor { color: #00ff88; animation: blink 1s step-end infinite; }
    @keyframes blink { 50% { opacity: 0; } }
    .trending-badge { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 4px; padding: 6px 14px; font-family: "JetBrains Mono", monospace; font-size: 11px; font-weight: 600; color: #ff9500; text-transform: uppercase; letter-spacing: 1.5px; }
    .main { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 20px; }
    .repo-name { font-family: "Bricolage Grotesque", sans-serif; font-size: 48px; font-weight: 700; color: #ff9500; line-height: 1.1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .owner { font-family: "JetBrains Mono", monospace; font-size: 20px; color: #888888; display: flex; align-items: center; gap: 8px; }
    .owner-label { color: #555555; }
    .owner-name { color: #00ff88; }
    .description { font-size: 22px; line-height: 1.5; color: #e8e8e8; max-height: 70px; overflow: hidden; }
    .topics { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px; }
    .topic { background: rgba(0, 255, 136, 0.1); border: 1px solid rgba(0, 255, 136, 0.3); border-radius: 3px; padding: 4px 12px; font-family: "JetBrains Mono", monospace; font-size: 13px; font-weight: 500; color: #00ff88; }
    .footer { display: flex; align-items: center; gap: 32px; padding-top: 24px; border-top: 1px solid #2a2a2a; }
    .stat { display: flex; align-items: center; gap: 8px; font-family: "JetBrains Mono", monospace; font-size: 18px; font-weight: 600; }
    .stat-stars { color: #ffb347; }
    .stat-forks { color: #888888; }
    .language { display: flex; align-items: center; gap: 8px; font-family: "JetBrains Mono", monospace; font-size: 18px; font-weight: 500; color: #e8e8e8; }
    .lang-dot { width: 12px; height: 12px; border-radius: 50%; background-color: #00ff88; }
    .lang-dot.lang-python { background-color: #3572a5; }
    .lang-dot.lang-javascript { background-color: #f1e05a; }
    .lang-dot.lang-typescript { background-color: #3178c6; }
    .lang-dot.lang-rust { background-color: #dea584; }
    .lang-dot.lang-go { background-color: #00add8; }
    .lang-dot.lang-cpp { background-color: #f34b7d; }
    .lang-dot.lang-java { background-color: #b07219; }
    .lang-dot.lang-ruby { background-color: #701516; }
    .lang-dot.lang-php { background-color: #4f5d95; }
    .lang-dot.lang-swift { background-color: #ff9500; }
    .lang-dot.lang-kotlin { background-color: #a97bff; }
    .lang-dot.lang-default { background-color: #888888; }
    .footer-right { margin-left: auto; display: flex; align-items: center; gap: 24px; }
    .github-link { display: flex; align-items: center; gap: 8px; font-family: "JetBrains Mono", monospace; font-size: 16px; color: #888888; }
    .github-icon { width: 20px; height: 20px; fill: #e8e8e8; }
    .te9-link { font-family: "JetBrains Mono", monospace; font-size: 14px; color: #555555; }
    .te9-link span { color: #00ff88; }
    .emoji { font-size: 16px; }
  </style>
</head>
<body>
  <div class="deco-rings">
    <div class="deco-ring deco-ring-1"></div>
    <div class="deco-ring deco-ring-2"></div>
    <div class="deco-ring deco-ring-3"></div>
  </div>
  <div class="card">
    <div class="card-content">
      <header class="header">
        <div class="brand">
          <span class="brand-symbol">›</span>
          <span>te9.dev</span>
          <span class="brand-cursor">_</span>
        </div>
        <span class="trending-badge">Trending</span>
      </header>
      <div class="main">
        <h1 class="repo-name">${escapeHtml(repoName)}</h1>
        <div class="owner">
          <span class="owner-label">by</span>
          <span class="owner-name">${escapeHtml(ownerName)}</span>
        </div>
        <p class="description">${escapeHtml(description)}</p>
        ${topics.length > 0 ? `<div class="topics">${topicsHtml}</div>` : ""}
      </div>
      <footer class="footer">
             <div class="stat stat-stars">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffb347" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <span>${stars}</span>
        </div>
        <div class="stat stat-forks">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#888888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9v2c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V9"/><path d="M12 12v3"/></svg>
          <span>${forks}</span>
        </div>
        <div class="language">
          <div class="lang-dot lang-${languageCss}"></div>
          <span>${escapeHtml(language)}</span>
        </div>
        <div class="footer-right">
          <div class="github-link">
            <svg class="github-icon" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            <span>${escapeHtml(ownerName)}</span>
          </div>
          <div class="te9-link"><span>te9.dev</span></div>
        </div>
      </footer>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(text) {
  const div = { innerHTML: "" };
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function generateRepoPage(template, repo, ogImageUrl) {
  let description = repo.description || "No description";
  if (description.length > 200) {
    description = description.substring(0, 197) + "...";
  }

  const repoName = repo.name || "Unknown Repo";
  const ownerName = getOwnerName(repo);
  const avatarUrl = repo.owner?.avatar_url || "";
  const stars = formatNumber(repo.stargazers_count || 0);
  const forks = formatNumber(repo.forks_count || 0);
  const language = repo.language || "Code";
  const languageCss = getLanguageCss(language);
  const topics = (repo.topics || []).slice(0, 4);

  const pageUrl = `${BASE_URL}/${repoName}.html`;
  const githubUrl = repo.html_url || repo.homepage || "#";

  let html = template;

  // Replace simple placeholders
  html = html.replace(/\{\{REPO_NAME\}\}/g, repoName);
  html = html.replace(/\{\{OWNER_NAME\}\}/g, ownerName);
  html = html.replace(/\{\{OWNER_URL\}\}/g, repo.owner?.html_url || "#");
  html = html.replace(/\{\{GITHUB_AVATAR_URL\}\}/g, avatarUrl);
  html = html.replace(/\{\{DESCRIPTION\}\}/g, description);
  html = html.replace(/\{\{STARS\}\}/g, stars);
  html = html.replace(/\{\{FORKS\}\}/g, forks);
  html = html.replace(/\{\{LANGUAGE\}\}/g, language);
  html = html.replace(/\{\{LANGUAGE_CSS\}\}/g, languageCss);
  html = html.replace(/\{\{GITHUB_URL\}\}/g, githubUrl);
  html = html.replace(/\{\{PAGE_URL\}\}/g, pageUrl);
  html = html.replace(/\{\{OG_IMAGE_URL\}\}/g, ogImageUrl);

  // Handle topics section - replace entire {{#if TOPICS}}...{{/if}} block
  const topicsBlockRegex = /\{\{#if TOPICS\}\}[\s\S]*?\{\{\/if\}\}/;
  if (topics.length > 0) {
    const topicsHtml = topics
      .map((topic) => `<span class="topic">${escapeHtml(topic)}</span>`)
      .join("");
    const topicsSection = `<div class="topics">${topicsHtml}</div>`;
    html = html.replace(topicsBlockRegex, topicsSection);
  } else {
    html = html.replace(topicsBlockRegex, "");
  }

  return html;
}

// Export functions and constants for use by other modules
export {
  SITE_DIR,
  REPOS_FILE,
  TEMPLATE_FILE,
  OUTPUT_DIR,
  BASE_URL,
  readTemplate,
  formatNumber,
  getLanguageCss,
  getOwnerName,
  generateOgImage,
  generateRepoPage,
  escapeHtml,
};

async function main() {
  console.log("=== RepoTrend HTML Page Generator ===\n");

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Read repos
  console.log("Reading repos from site/repos.json...");
  const repos = readRepos();

  if (repos.length === 0) {
    console.error("Error: No repos found");
    process.exit(1);
  }
  console.log(`Found ${repos.length} repos.\n`);

  // Read template
  console.log("Reading HTML template...");
  const template = readTemplate();

  if (!template) {
    console.error("Error: Could not read template");
    process.exit(1);
  }
  console.log("Template loaded.\n");

  // Process each repo
  for (const repo of repos) {
    const repoName = repo.name;
    const outputFile = path.join(OUTPUT_DIR, `${repoName}.html`);

    console.log(`Processing ${repoName}...`);

    // Generate OG image
    const ogImageUrl = await generateOgImage(repo);
    console.log(`  OG Image: ${ogImageUrl}`);

    // Generate HTML page
    const pageHtml = generateRepoPage(template, repo, ogImageUrl);

    // Save HTML page
    fs.writeFileSync(outputFile, pageHtml);
    console.log(`  Saved: ${outputFile}\n`);
  }

  console.log(`=== Generated ${repos.length} HTML pages ===`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

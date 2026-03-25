import fs from "fs";
import path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";
import {
  readTemplate,
  generateOgImage,
  generateRepoPage,
  OUTPUT_DIR,
} from "./generate-repo-pages.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REPO_DIR = path.join(__dirname, "site", "repo");

// Get the most recent file in a directory matching a pattern
function getMostRecentFile(dir, prefix) {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".json"))
    .map((f) => ({
      name: f,
      time: fs.statSync(path.join(dir, f)).mtime.getTime(),
    }))
    .sort((a, b) => b.time - a.time);

  if (files.length === 0) return null;
  return path.join(dir, files[0].name);
}

// Pick a random repo from a file
function pickRandomRepo(filepath) {
  const data = JSON.parse(fs.readFileSync(filepath, "utf8"));
  const randomIndex = Math.floor(Math.random() * data.length);
  return data[randomIndex];
}

// Check if repo already exists in repos.json
function repoExistsInList(repo, reposList) {
  return reposList.some((r) => r.id === repo.id);
}

// Check if repo has a corresponding HTML page
function repoPageExists(repo) {
  const pagePath = path.join(REPO_DIR, `${repo.name}.html`);
  return fs.existsSync(pagePath);
}

// Main function
async function main() {
  const baseDir = path.join(__dirname);

  // Paths to data directories
  const dataDirs = [
    {
      dir: path.join(baseDir, "data", "90days-1000stars"),
      prefix: "repos-last90days-1000stars",
    },
    {
      dir: path.join(baseDir, "data", "30days-100-999stars"),
      prefix: "repos-last30days-100-999stars",
    },
    {
      dir: path.join(baseDir, "data", "3days-50-99stars"),
      prefix: "repos-3days-50-99stars",
    },
  ];

  // Load existing repos.json if it exists
  const reposFilePath = path.join(baseDir, "site", "repos.json");
  let existingRepos = [];

  if (fs.existsSync(reposFilePath)) {
    existingRepos = JSON.parse(fs.readFileSync(reposFilePath, "utf8"));
    console.log(
      `Loaded ${existingRepos.length} existing repos from repos.json`,
    );

    // Check for existing repos that don't have pages
    const existingWithoutPages = existingRepos.filter(
      (repo) => !repoPageExists(repo),
    );
    if (existingWithoutPages.length > 0) {
      console.log(
        `\nWARNING: ${existingWithoutPages.length} existing repos are missing HTML pages:`,
      );
      for (const repo of existingWithoutPages) {
        console.log(`  - ${repo.name}`);
      }
    }
  }

  const newRepos = [];
  const skippedRepos = [];

  // Pick a random repo from each data source
  for (const { dir, prefix } of dataDirs) {
    const filePath = getMostRecentFile(dir, prefix);
    if (!filePath) {
      console.log(`No file found in ${dir} with prefix ${prefix}`);
      continue;
    }

    console.log(`Reading from: ${filePath}`);

    // Keep trying until we find a repo not in the list
    let attempts = 0;
    let found = false;

    while (attempts < 100 && !found) {
      const randomRepo = pickRandomRepo(filePath);

      // Check if repo is already in our lists (existing or newly picked)
      if (
        !repoExistsInList(randomRepo, existingRepos) &&
        !repoExistsInList(randomRepo, newRepos)
      ) {
        newRepos.push(randomRepo);
        console.log(
          `  + Picked repo: ${randomRepo.name} (${randomRepo.stargazers_count} stars)`,
        );
        found = true;
      } else {
        attempts++;
      }
    }

    if (!found) {
      console.log(
        `  - Could not find a new repo for ${prefix} (all 100 were already in repos.json)`,
      );
      skippedRepos.push(prefix);
    }
  }

  // Append new repos to repos.json and generate HTML pages
  if (newRepos.length > 0) {
    const updatedRepos = [...existingRepos, ...newRepos];
    fs.writeFileSync(reposFilePath, JSON.stringify(updatedRepos, null, 2));
    console.log(`\nAdded ${newRepos.length} new repos to site/repos.json`);
    console.log(`Total repos now: ${updatedRepos.length}`);

    // Generate HTML pages for new repos
    console.log("\n=== Generating HTML pages for new repos ===");

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Read the HTML template
    const template = readTemplate();
    if (!template) {
      console.error("Error: Could not read HTML template");
    } else {
      for (const repo of newRepos) {
        const repoName = repo.name;
        const outputFile = path.join(OUTPUT_DIR, `${repoName}.html`);

        console.log(`Generating page for ${repoName}...`);

        // Generate OG image
        const ogImageUrl = await generateOgImage(repo);
        console.log(`  OG Image: ${ogImageUrl}`);

        // Generate HTML page
        const pageHtml = generateRepoPage(template, repo, ogImageUrl);

        // Save HTML page
        fs.writeFileSync(outputFile, pageHtml);
        console.log(`  Saved: ${outputFile}`);
      }
      console.log(`\n=== Generated ${newRepos.length} HTML pages ===`);
    }
  } else {
    console.log("\nNo new repos to add");
  }

  if (skippedRepos.length > 0) {
    console.log(
      `Skipped sources (all repos already existed): ${skippedRepos.join(", ")}`,
    );
  }
}

main().catch(console.error);

import https from "https";
import fs from "fs";
import path from "path";

// Format date as YYYYMMDD
function getDateString() {
  const now = new Date();
  return now.toISOString().split("T")[0].replace(/-/g, "");
}

// Extract only the required fields from a repository
function extractFields(repo) {
  return {
    id: repo.id,
    name: repo.name,
    owner: {
      id: repo.owner.id,
      url: repo.owner.url,
      html_url: repo.owner.html_url,
      avatar_url: repo.owner.avatar_url,
    },
    html_url: repo.html_url,
    description: repo.description,
    created_at: repo.created_at,
    updated_at: repo.updated_at,
    pushed_at: repo.pushed_at,
    git_url: repo.git_url,
    homepage: repo.homepage,
    size: repo.size,
    stargazers_count: repo.stargazers_count,
    watchers_count: repo.watchers_count,
    language: repo.language,
    forks_count: repo.forks_count,
    open_issues_count: repo.open_issues_count,
  };
}

// Make HTTP GET request
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      { headers: { "User-Agent": "repotrend-fetcher" } },
      (response) => {
        let data = "";
        response.on("data", (chunk) => (data += chunk));
        response.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    request.on("error", reject);
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error("Request timeout"));
    });
  });
}

// Main function
async function main() {
  const dateString = getDateString();

  // Ensure data subdirectory exists
  const dataDir = path.join(__dirname, "data", "alltime-50000stars");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const filename = `repos-alltime-50000stars-${dateString}.json`;
  const filepath = path.join(dataDir, filename);

  // Build API URL: all time repos with >= 50000 stars
  const query = encodeURIComponent("stars:>=50000");
  const apiUrl = `https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=100`;

  console.log(`Fetching all time repos with >= 50000 stars...`);
  console.log(`API URL: ${apiUrl}`);

  try {
    const data = await httpGet(apiUrl);

    if (data.items) {
      const extracted = data.items.map(extractFields);

      fs.writeFileSync(filepath, JSON.stringify(extracted, null, 2));
      console.log(`Saved ${extracted.length} repositories to ${filepath}`);
    } else if (data.message) {
      console.error(`GitHub API error: ${data.message}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error fetching data: ${error.message}`);
    process.exit(1);
  }
}

main();

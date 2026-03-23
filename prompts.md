every day i want to store a snapshot of https://api.github.com/search/repositories?q=created:%3E=2026-01-19+stars:%3E1000&sort=stars&order=desc&per_page=100 only store the top 100. For the data i only want the following fields in the data:

- id
- name
- owner.id
- owner.url
- owner.html_url
- owner.avatar_url
- html_url
- description
- created_at
- updated_at
- pushed_at
- git_url
- homepage
- size
- stargazers_count
- watchers_count
- language
- forks_count
- open_issues_count

i want this to run on github actions where4 times a day the same data is fetched and overwritten for that day, store it in a folder .\data with repos-last90days-1000stars-20260323.json. we always only want the top 100 for the repos created in the last 90 days, check the api url above to know what params to use


###########################

so just to be clear, each repo in [@repos.json](file:///E:/te9.dev/repotrend/site/repos.json) will have its own html page in [@repo](file:///E:/te9.dev/repotrend/site/repo) which will be used to add a post to bsky and when visiting that page, at the bottom of the card will be a message redirecting in 5 seconds and counting down... then it will be redirected to the github repo

Yes, I understand now. The workflow is:

1. **Each repo gets its own HTML page** at `site/repo/{repo-name}.html`
2. **This HTML page is used for Bluesky posting** via `app.bsky.embed.external` - the URL will be something like `te9.dev/repotrend/repo/{repo-name}.html`
3. **The HTML page has OG meta tags** pointing to our custom OG image
4. **When users visit the page**, they see the repo card and a countdown (5 seconds) at the bottom that redirects to the GitHub repo

This way:
- The Bluesky embed shows a clickable link to our HTML page
- The HTML page has our custom OG image (fetched by Bluesky)
- Visitors to the HTML page are redirected to the actual GitHub repo after 5 seconds

So I need to:
1. Create a script to generate HTML pages for each repo from the template
2. The HTML page will have a countdown redirect to the GitHub repo
3. Update the post-to-bsky script to use `app.bsky.embed.external` with the HTML page URL

Let me create the script to generate the HTML pages and update the workflow. First, let me look at the repo.html template I created earlier and see if it needs a countdown redirect added.

Actually, looking at the template I created at `site/repo/repo.html`, it already has the card design but doesn't have the countdown redirect. I need to add that.

Let me update the template to include:
1. A countdown timer at the bottom
2. A redirect to the GitHub repo after 5 seconds

Let me update the site/repo/repo.html template to include the countdown redirect.

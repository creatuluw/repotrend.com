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

# Change Log

## 2.0.0 - 2026-08-29

- Replaced the description-only issue panel with a comprehensive, responsive issue details view.
- Added issue metadata, custom fields, tags, votes, attachments, linked issues, comments, change history and VCS
  commits.
- Added time tracking details with total logged duration and individual work items.
- Expanded linked commits with hashes, file counts, authors, dates and pull request labels.
- YouTrack-rendered descriptions and comments now retain rich formatting while unsafe HTML and links are removed.
- Links in descriptions and comments are clickable, with relative links resolved against the YouTrack server.
- Comments are rendered as Markdown with safe HTML and links.
- Fixed issue history omitting state transitions by requesting the required YouTrack activity categories and supporting
  single-value changes.
- Fixed long issue histories being truncated by YouTrack collection limits.
- Grouped Issues and state pickers now use every state in the project bundle instead of only the agile board columns.
- Issue details remain available when activity history or VCS data cannot be accessed because of server support or
  permissions.
- Added direct VSIX packaging and marketplace publishing scripts with locally pinned `vsce` and `ovsx` tooling.
- Standardized build and test script names and updated CI and release workflows to use them.

## 1.7.0 - 2026-08-27

- Fixed grouped issues showing every project issue in every group on boards without sprints (#10).
- Fixed the certificate validation setting being ignored when editing a server.
- Fixed the API token being wiped when editing a server without retyping it.
- Failed requests now report the YouTrack error instead of being logged to the console and ignored.
- Issue lists are paginated (`youtrack.pageSize`) and no longer fetch rendered descriptions for every issue.
- Issue descriptions load on demand in a single reused panel with a restrictive content security policy.
- Restructured the source into `api`, `domain`, `views` and `config` layers with unit tests for the pure logic.
- Replaced ESLint and Prettier with oxlint and oxfmt; replaced webpack with esbuild.
- Added a CI workflow, and the release workflow now verifies the build before publishing.

## 1.6.1 - 2025-03-25

- Fixed error in certificate verification logic.

## 1.6.0 - 2024-10-09

- Implemented a configuration option for disabling certificate validation.

## 1.5.4 - 2024-01-27

- Improved error handling for agile and issue views.

## 1.5.3 - 2023-11-10

- Improved server operations (views are correctly reset on any change now).

## 1.5.2 - 2023-10-27

- Removed unnecessary commands from palette.
- Specified a lower timeout for API requests (5 sec).

## 1.5.1 - 2023-09-09

- Implemented autorefresh of agiles/projects after server editing (if an edited server was selected).

## 1.5.0 (2023-08-24)

- Implemented autoselection of the first agile (on choosing a server).

## 1.4.0 (2023-05-27)

- Added support for kanban boards to a tree with grouped issues.
- Fixed an error in refreshing issues trees on selecting a project.

## 1.3.0 (2023-04-15)

- Added new context menu option to update issue assignee.
- Context menu option to edit issue summary was moved to "Update" group.

## 1.2.0 (2023-04-02)

- Extension bundler changed to `webpack`.
- Extension can now be used in a web environment ([VS Code for Web](https://vscode.dev)). Be sure to
  [set CORS settings](README.md#web-extension) for your YouTrack server.

## 1.1.2 (2023-03-25)

- Added new context menu option to edit issue summary.

## 1.1.1 (2023-03-20)

- Optimized issue creation routine.

## 1.1.0 (2023-03-17)

- Added context menus to issue items.
- New command: add an issue.
- Fixed issue deleting.
- Other minor changes and fixes.

## 1.0.1 (2023-03-15)

- Fixed an error in issue URL.
- Issue items of Sprints and Recent views are now completely identical.

## 1.0.0 (2023-03-15)

- Initial release.

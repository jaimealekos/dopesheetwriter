# Contributing

Thanks for helping.

## Issues

- Search first; it may already be reported.
- Bugs: steps, expected vs. actual, OS, app version. Attach the XML if you can (no video needed).
- Ideas: describe the problem before the solution.

## Pull requests

1. Fork and branch from `main`.
2. `npm install`, then `npm test` must pass.
3. Add tests for new behaviour. No network in tests.
4. Keep the style: plain ES modules, small functions, no new dependencies without a reason.
5. One topic per PR, clear title, link the issue.

The renderer never uses Node or the network: everything goes through `window.dsw` (`main/preload.cjs`). No inline styles or scripts (CSP).

By contributing you agree your work is released under the [MIT License](LICENSE).

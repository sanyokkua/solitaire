# Release procedure

A release is a version of `package.json`, an entry in [`CHANGELOG.md`](../../CHANGELOG.md), a merge to `master` (which
deploys to GitHub Pages) and a tag. The version follows [semantic versioning](https://semver.org/); the first release is
1.0.0.

**Every push, every pull request and every tag happens only when the author asks for it.** Preparing a release
(the version, the changelog, the checks) does not include any of them.

## Steps

1. **Validate.** On the change's branch, run the full gate and the browser suite, and fix everything they report:

    ```sh
    rtk npm run validate
    rtk npm run e2e
    ```

    `validate` includes the formatter, linter, type check, unit and component tests with coverage, the build and the
    artifact check. Run `rtk npm run trace` too, and commit the traceability matrix if it changed. If the look changed,
    regenerate the reference screenshots with `rtk npm run screenshots` and review them by eye.

2. **Prepare the release.** Set the new version in `package.json` and in the root entry of `package-lock.json` (both the
   same, valid semver), and add the entry to the top of `CHANGELOG.md` with the version, the date and the highlights.
   `tests/unit/repo/configContract.test.ts` checks the version.

3. **Merge into the integration branch.** Archive the OpenSpec change (`/opsx:archive`), which squash-merges the change's
   branch, `feature/<change-name>`, into the integration branch named in its proposal (`feature/app-v1-release` for
   `finalize-v1-release`).

4. **Merge into `master`.** Open a pull request from the integration branch to `master`, wait for the CI checks, and merge
   it. The merge deploys to GitHub Pages through `pages.yml` (see [CI and deployment](ci-and-deployment.md)).

5. **Tag.** On `master`, on the commit the merged pull request produced, create the tag `v` followed by the package version
   (for example `v1.0.0`) and push it. A release tag is never created on a feature or integration branch.

Stale remote branches from finished work are removed after the release, also only on request.

# Release procedure

A release is a version of `package.json`, an entry in [`CHANGELOG.md`](../../CHANGELOG.md), a merge to `master` (which
deploys to GitHub Pages) and a tag. The version follows [semantic versioning](https://semver.org/). The first release is
1.0.0, which is on `master`; its `v1.0.0` tag has not been created yet (step 5).

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

3. **Archive the change.** Archive the OpenSpec change (`/opsx:archive`) on its branch, `feature/<change-name>`, so the
   change and the main specs are in the pull request.

4. **Merge into `master`.** Open a pull request from `feature/<change-name>` to `master`; `ci.yml` builds it (the
   `validate` job and a Chromium, Firefox and WebKit job each). Merge it when the checks are green. The merge deploys to
   GitHub Pages through `pages.yml`, which validates again and publishes (see [CI and deployment](ci-and-deployment.md)).

5. **Tag.** On `master`, on the merge commit, create the tag `v` followed by the package version (for example `v1.0.0`)
   and push it. A release tag is never created on a feature branch.

Finished feature branches are deleted after the merge, also only on request.

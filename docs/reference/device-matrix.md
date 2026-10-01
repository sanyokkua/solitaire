# Device matrix

The screens the table layout must fit, and how the fit is checked: automatically on every configuration, and by hand on
the devices the author owns.

## The 13 screens

Sizes are CSS pixels (`innerWidth`×`innerHeight`). A viewport in the **browser** is shorter than the screen because of the
browser's own bars: about 188 px (iOS Safari, portrait), 52 px (iOS, landscape), 130 px (Android Chrome, portrait) and
80 px (Android, landscape). These are approximations for testing. An **installed** app has the full screen height and
still respects the safe areas (the notch and the home indicator). Screens marked _estimated_ assume a device pixel ratio
of 3; check them on a real device and correct the table. The source of the pixel figures is the pack's device table,
`d72187f:docs/spec/research.md`.

| Device                                | Platform | Screen px              | Portrait, installed | Portrait, in the browser | Landscape, installed | Landscape, in the browser | Status                                                             |
| ------------------------------------- | -------- | ---------------------- | ------------------- | ------------------------ | -------------------- | ------------------------- | ------------------------------------------------------------------ |
| iPhone 14 Pro                         | iOS      | 1179×2556              | 393×852             | 393×664                  | 852×393              | 852×341                   | Published tables                                                   |
| iPhone 14 Pro Max                     | iOS      | 1290×2796              | 430×932             | 430×744                  | 932×430              | 932×378                   | Published tables                                                   |
| iPhone 17 Pro                         | iOS      | 1206×2622              | 402×874             | 402×686                  | 874×402              | 874×350                   | Published tables                                                   |
| iPhone 17 Pro Max                     | iOS      | 1320×2868              | 440×956             | 440×768                  | 956×440              | 956×388                   | Published tables                                                   |
| Galaxy S25                            | Android  | 1080×2340              | 360×780             | 360×650                  | 780×360              | 780×280                   | Published tables                                                   |
| Galaxy S25+ / S25 Ultra, FHD+ setting | Android  | 1440×3120 (QHD+ panel) | 384×832             | 384×702                  | 832×384              | 832×304                   | Default setting; the viewport follows Samsung's resolution setting |
| Galaxy S25+ / S25 Ultra, QHD+ setting | Android  | 1440×3120 (QHD+ panel) | 412×891             | 412×761                  | 891×412              | 891×332                   | Same panel at its native resolution                                |
| iPhone Duo, outer                     | iOS      | 1398×2034              | 466×678             | 466×490                  | 678×466              | 678×414                   | Estimated (DPR 3)                                                  |
| iPhone Duo, inner                     | iOS      | 2670×1878              | 626×890             | 626×702                  | 890×626              | 890×574                   | Estimated; opens in landscape                                      |
| Galaxy Z Fold 8, cover                | Android  | 1248×1972              | 416×657             | 416×527                  | 657×416              | 657×336                   | Estimated (DPR 3)                                                  |
| Galaxy Z Fold 8, main                 | Android  | 2448×1848              | 616×816             | 616×686                  | 816×616              | 816×536                   | Estimated; opens in landscape                                      |
| Galaxy Z Fold 8 Ultra, cover          | Android  | 1080×2520              | 360×840             | 360×710                  | 840×360              | 840×280                   | Estimated                                                          |
| Galaxy Z Fold 8 Ultra, main           | Android  | 2504×2256              | 752×835             | 752×705                  | 835×752              | 835×672                   | Estimated                                                          |

The 13 screens in the two orientations and the two modes give 52 configurations. All are touch screens with a coarse
pointer. The same list, with the browser-bar heights, is `tests/fixtures/viewports.ts`.

## Automated check

`tests/e2e/deviceFit.spec.ts` (the `device-fit` Playwright project, against the production build) loads Home and then a
Game with a worst-case column, a face-down stack under a 13-card king-to-ace run, on every configuration and on three
baselines: 320×480 with a coarse pointer, and 1280×720 and 2560×1440 with a fine one. It runs in English and in Ukrainian. In every
case:

- the page never scrolls;
- every card lies inside the table panel and every control lies inside the viewport;
- the panel is at least the size the layout fixture (`boardSizeFor`) allows;
- in an installed configuration, the face-up strip of the worst-case column is at least 14 px.

Run it with `rtk npx playwright test --project=device-fit`.

## Checked on the real device

An emulated viewport cannot show a real notch, home indicator, browser bar or foldable hinge. On each real device the
author owns, record the checks below in [manual checks](manual-checks.md) (the "Real-device fit" row): the sizes the page
really reports, in portrait and landscape, in the browser and installed, run as `[innerWidth, innerHeight]` in a remote
inspector; whether every control and card clears the safe areas; and whether the sizes match the table above. A device
the author does not have is waived, with the date and the reason. Version 1.0.0 shipped with every row below still
pending: the layout is proven in emulation only (the `device-fit` suite), not on hardware.

| Device                                | Sizes match the table | Controls and cards clear the safe areas | Date, browser | Result or waiver |
| ------------------------------------- | --------------------- | --------------------------------------- | ------------- | ---------------- |
| iPhone 14 Pro                         | Pending               | Pending                                 | Pending       | Pending          |
| iPhone 14 Pro Max                     | Pending               | Pending                                 | Pending       | Pending          |
| iPhone 17 Pro                         | Pending               | Pending                                 | Pending       | Pending          |
| iPhone 17 Pro Max                     | Pending               | Pending                                 | Pending       | Pending          |
| Galaxy S25                            | Pending               | Pending                                 | Pending       | Pending          |
| Galaxy S25+ / S25 Ultra, FHD+ setting | Pending               | Pending                                 | Pending       | Pending          |
| Galaxy S25+ / S25 Ultra, QHD+ setting | Pending               | Pending                                 | Pending       | Pending          |
| iPhone Duo, outer                     | Pending               | Pending                                 | Pending       | Pending          |
| iPhone Duo, inner                     | Pending               | Pending                                 | Pending       | Pending          |
| Galaxy Z Fold 8, cover                | Pending               | Pending                                 | Pending       | Pending          |
| Galaxy Z Fold 8, main                 | Pending               | Pending                                 | Pending       | Pending          |
| Galaxy Z Fold 8 Ultra, cover          | Pending               | Pending                                 | Pending       | Pending          |
| Galaxy Z Fold 8 Ultra, main           | Pending               | Pending                                 | Pending       | Pending          |

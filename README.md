Tampermonkey userscript for Microsoft Edge on Android and `m.youtube.com`.

Seeks to the last two seconds and lets the video finish naturally. After you share its link, opens YouTube Home so YouTube sends its final playback report. Live videos and Shorts are skipped.

## Installation

1. Enable Tampermonkey in Edge.
2. [Install the userscript](https://raw.githubusercontent.com/sashokey/player-force-watched/master/player-force-watched.user.js).
3. Sign in to YouTube and enable watch history.

Tampermonkey uses this repository for updates when automatic script updates are enabled. To update an earlier copy installed manually, install the linked version once.

## Usage

1. Open a video on `m.youtube.com`. If autoplay is blocked, tap Play.
2. Keep the page visible until the video ends and YouTube shows its replay button.
3. Use YouTube's **Share** button on that video page and choose **Termux**.

Your click on YouTube's Share button opens the system share dialog with the video's link. The transition to YouTube Home happens once, after the browser reports successful sharing. Cancelling the dialog leaves the video page in place. When you return to Edge, YouTube Home is open.

The script adds no messages to the page. It waits for YouTube autoplay or your press of Play, then makes one seek. The final playback report is sent when it leaves the video page after sharing. The history progress bar may take a few seconds to update.

Playback may be audible. Seeking does not count the skipped portion as actual watch time or guarantee changes to recommendations. Player control remains automated and can be distinguishable from manual seeking.

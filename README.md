Tampermonkey userscript for Microsoft Edge on Android and `m.youtube.com`.

Seeks to the last two seconds and lets the video finish naturally. After you share its link, reopens the same video near its end so YouTube sends its final playback report. Live videos and Shorts are skipped.

## Installation

1. Enable Tampermonkey in Edge.
2. [Install the userscript](https://raw.githubusercontent.com/sashokey/player-force-watched/master/player-force-watched.user.js).
3. Sign in to YouTube and enable watch history.

Tampermonkey uses this repository for updates when automatic script updates are enabled. To update an earlier copy installed manually, install the linked version once.

## Usage

1. Open a video on `m.youtube.com`. If autoplay is blocked, tap Play.
2. Keep the page visible until `YT95: Ready` appears.
3. Use YouTube's **Share** button on that video page and choose **Termux**.

The page reload happens once, after the browser reports successful sharing. Cancelling the share dialog leaves the page in place. The video remains near its end when you return to Edge.

`Ready` means the video has ended and can be shared. The final playback report is sent when the page reloads after sharing. The history progress bar may take a few seconds to update.

The script does not pause playback, open history, or send tracking requests itself. Playback may be audible. Seeking does not count the skipped portion as actual watch time or guarantee changes to recommendations.

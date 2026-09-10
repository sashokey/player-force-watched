Tampermonkey userscript for Microsoft Edge on Android and `m.youtube.com`.

Automatically seeks each opened video to 95%, plays briefly, then pauses. Observes the player's own watchtime request without sending tracking requests itself. Live videos and Shorts are skipped.

## Installation

1. Enable Tampermonkey in Edge.
2. [Install the userscript](https://raw.githubusercontent.com/sashokey/player-force-watched/master/player-force-watched.user.js).
3. Sign in to YouTube and enable watch history.

Tampermonkey uses this repository for updates when automatic script updates are enabled. To update an earlier copy installed manually, install the linked version once.

## Usage

Open a video on `m.youtube.com`. If autoplay is blocked, tap YouTube's Play button. Keep the tab visible and wait for the `YT95` result before sharing to Termux.

- **HTTP 2xx:** a watchtime request reporting a position of at least 95% received a successful HTTP response. Check YouTube history for the saved progress.
- **Delivery unconfirmed:** the request was observed, but successful delivery could not be verified.
- **Failed / no confirmed report:** the request failed or no report was confirmed before the timeout. Reload to retry.

Switching away from the tab stops the script. Playback may be audible briefly.

Seeking to 95% does not count the skipped portion as actual watch time. A successful HTTP response does not guarantee a fully watched mark or a change in recommendations. Automated player control is not guaranteed to be indistinguishable from manual actions.

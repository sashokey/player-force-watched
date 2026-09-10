// ==UserScript==
// @name         YouTube 95%
// @namespace    local.youtube95
// @version      1.0.2
// @description  Seek once with the native player and observe its watchtime report.
// @homepageURL  https://github.com/sashokey/player-force-watched
// @updateURL    https://raw.githubusercontent.com/sashokey/player-force-watched/master/player-force-watched.user.js
// @downloadURL  https://raw.githubusercontent.com/sashokey/player-force-watched/master/player-force-watched.user.js
// @match        https://m.youtube.com/*
// @run-at       document-idle
// @sandbox      raw
// @grant        none
// @noframes
// ==/UserScript==

(() => {
    'use strict';

    const marker = 'data-youtube95';
    if (document.documentElement.hasAttribute(marker)) return;
    document.documentElement.setAttribute(marker, '');

    const label = document.createElement('div');
    label.setAttribute('role', 'status');
    label.style.cssText = 'position:fixed;right:8px;bottom:72px;z-index:2147483647;max-width:85vw;padding:6px 9px;border-radius:6px;background:#202020;color:#ffd180;font:12px/1.4 sans-serif;pointer-events:none';

    let id, player, timer, observer, deadline, target, duration, cpn, started;
    let sought = false, paused = false, played = 0, previous = null, seen = false, http = 0;

    const videoId = () => location.pathname === '/watch' ? new URL(location.href).searchParams.get('v') : null;

    function show(message, confirmed = false) {
        label.textContent = 'YT95: ' + message;
        label.style.color = confirmed ? '#a5d6a7' : '#ffd180';
        if (!label.isConnected) document.body.append(label);
    }

    function ownsPlayer() {
        try {
            const data = player?.getVideoData?.();
            return player?.isConnected && videoId() === id && data?.video_id === id && data.cpn === cpn;
        } catch {
            return false;
        }
    }

    function pause() {
        try {
            if (!sought || paused || !ownsPlayer() || player.getAdState() !== -1) return;
            paused = true;
            player.pauseVideo();
        } catch {}
    }

    function stop() {
        clearTimeout(timer);
        timer = null;
        observer?.disconnect();
        observer = null;
        player = null;
    }

    function finish(message, confirmed = false) {
        pause();
        stop();
        show(message, confirmed);
    }

    function report() {
        if (!paused || !seen) return false;
        if (http >= 200 && http < 300) finish('95%+ report: HTTP ' + http + '. Check history.', true);
        else if (http) finish('95%+ report failed: HTTP ' + http);
        else finish('95%+ request seen; delivery unconfirmed. Check history.');
        return true;
    }

    function observe(list) {
        if (!ownsPlayer()) return;
        for (const entry of list.getEntries()) {
            if (entry.startTime < started || !entry.name.includes('/api/stats/watchtime?')) continue;
            const url = new URL(entry.name);
            if (!['m.youtube.com', 'www.youtube.com', 's.youtube.com'].includes(url.hostname) || url.pathname !== '/api/stats/watchtime') continue;
            const params = url.searchParams;
            if (params.get('docid') !== id || params.get('cpn') !== cpn || params.has('adformat')) continue;
            if (!params.get('st') || !params.get('et')) continue;
            const starts = (params.get('st') || '').split(',').map(Number);
            const ends = (params.get('et') || '').split(',').map(Number);
            if (starts.length !== ends.length || !ends.some((end, i) => Number.isFinite(end) && end >= target && end <= duration + 1 && Number.isFinite(starts[i]) && starts[i] >= 0 && starts[i] < end)) continue;
            seen = true;
            if (!(http >= 200 && http < 300)) http = entry.responseStatus || 0;
            if (report()) return;
        }
    }

    function tick() {
        timer = null;
        if (videoId() !== id) return begin();
        if (document.hidden) {
            pause();
            return finish('Tab hidden; check history or reload to retry.');
        }
        if (performance.now() >= deadline) return finish(sought ? 'No confirmed 95%+ report. Check history or reload.' : 'Player not ready. Reload to retry.');

        try {
            if (!sought) {
                player = document.getElementById('movie_player');
                const data = player?.getVideoData?.();
                if (data?.video_id === id && data.cpn && ['getDuration', 'getCurrentTime', 'getPlayerState', 'getAdState', 'seekTo', 'playVideo', 'pauseVideo'].every(name => typeof player[name] === 'function')) {
                    if (data.isLive) return finish('Live video skipped.');
                    duration = player.getDuration();
                    if (Number.isFinite(duration) && duration > 0 && player.getAdState() === -1) {
                        cpn = data.cpn;
                        target = duration * 0.95;
                        started = performance.now();
                        observer = new PerformanceObserver(observe);
                        observer.observe({ type: 'resource' });
                        sought = true;
                        player.seekTo(target, true);
                        player.playVideo();
                        show('Seeking to 95%. Tap Play if playback is blocked.');
                    }
                }
            } else {
                if (!ownsPlayer()) return finish('Player changed; reload to retry.');
                if (player.getAdState() !== -1) {
                    previous = null;
                } else if (!paused) {
                    const position = player.getCurrentTime();
                    const state = player.getPlayerState();
                    if (state === 1 && position >= target) {
                        if (previous !== null) played += Math.max(0, Math.min(position - previous, 0.5));
                        previous = position;
                        if (played >= Math.min(3, duration * 0.02) || position >= duration - 0.1) {
                            pause();
                            show('Paused after 95%. Waiting for the native report.');
                        }
                    } else {
                        previous = null;
                        if (position >= target && (state === 0 || state === 2 && played > 0)) pause();
                    }
                }
                if (report()) return;
            }
            timer = setTimeout(tick, sought && !paused ? 250 : 500);
        } catch {
            finish('Player API unavailable. Reload to retry.');
        }
    }

    function begin() {
        const next = videoId();
        if (next === id) return;
        stop();
        label.remove();
        id = next;
        sought = paused = seen = false;
        played = http = 0;
        previous = null;
        if (!id || document.hidden) return;
        if (!window.navigation || !window.PerformanceObserver) return show('Required browser APIs unavailable.');
        deadline = performance.now() + 60000;
        show('Waiting for the player.');
        tick();
    }

    window.navigation?.addEventListener('navigatesuccess', begin);
    window.addEventListener('pagehide', stop);
    window.addEventListener('pageshow', event => {
        if (event.persisted) {
            id = undefined;
            begin();
        }
    });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && player) finish('Tab hidden; check history or reload to retry.');
        else if (!document.hidden && !sought && !timer) {
            id = undefined;
            begin();
        }
    });
    begin();
})();

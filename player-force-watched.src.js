// ==UserScript==
// @name         YouTube 95%
// @namespace    local.youtube95
// @version      1.3.2
// @description  Finish the video naturally and open YouTube Home after sharing its link.
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
    const sharedKey = 'player-force-watched:shared';
    if (document.documentElement.hasAttribute(marker)) return;
    document.documentElement.setAttribute(marker, '');

    const label = document.createElement('div');
    label.setAttribute('role', 'status');
    label.style.cssText = 'position:fixed;right:8px;bottom:72px;z-index:2147483647;max-width:85vw;padding:6px 9px;border-radius:6px;background:#202020;color:#ffd180;font:12px/1.4 sans-serif;pointer-events:none';

    let id, player, timer, observer, deadline, duration, cpn, seekAt, endedAt, report;
    let playRequested = false, ready = false, shared = false, finalized = false, generation = 0;

    const videoId = () => location.pathname === '/watch' ? new URL(location.href).searchParams.get('v') : null;

    let notificationTimer;

    function show(message) {
        clearTimeout(notificationTimer);
        label.textContent = message;
        if (!label.isConnected) document.body.append(label);
        notificationTimer = setTimeout(() => label.remove(), 4000);
    }

    function ownsPlayer() {
        try {
            const data = player?.getVideoData?.();
            return player?.isConnected && videoId() === id && data?.video_id === id && data.cpn === cpn;
        } catch {
            return false;
        }
    }

    function stop() {
        clearTimeout(timer);
        timer = null;
        observer?.disconnect();
        observer = null;
        player = null;
    }

    function finish(message) {
        stop();
        show(message);
    }

    function finalize() {
        if (!ready || !shared || finalized || videoId() !== id) return;
        finalized = true;
        try { sessionStorage.setItem(sharedKey, id); } catch {}
        label.remove();
        location.replace('https://m.youtube.com/');
    }

    function onEnded() {
        ready = true;
        finish(shared ? 'Shared. Finishing playback.' : 'Ready. Share to Termux from this video page.');
        finalize();
    }

    const nativeShare = navigator.share;
    if (typeof nativeShare === 'function') navigator.share = function (data) {
        const result = Reflect.apply(nativeShare, this, arguments);
        const current = generation;
        let target;
        try {
            const url = new URL(data.url);
            if (url.hostname === 'youtu.be') target = url.pathname.slice(1);
            else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname) && url.pathname === '/watch') target = url.searchParams.get('v');
        } catch {}
        if (target && target === id) result.then(() => {
            if (current === generation && videoId() === target) {
                shared = true;
                label.remove();
                finalize();
            }
        }, () => {});
        return result;
    };

    function observe(list) {
        if (!ownsPlayer()) return;
        for (const entry of list.getEntries()) {
            if (!entry.name.includes('/api/stats/watchtime?')) continue;
            const url = new URL(entry.name);
            if (!['m.youtube.com', 'www.youtube.com', 's.youtube.com'].includes(url.hostname) || url.pathname !== '/api/stats/watchtime') continue;
            const params = url.searchParams;
            if (params.get('docid') !== id || params.get('cpn') !== cpn || params.get('adformat')) continue;
            if (!params.get('cmt')) continue;
            const position = Number(params.get('cmt'));
            if (Number.isFinite(position) && position >= duration - 0.5 && position <= duration + 0.5 && seekAt && entry.startTime >= seekAt && params.get('state') === 'paused') report = true;
        }
    }

    function tick() {
        timer = null;
        if (videoId() !== id) return begin();
        if (performance.now() >= deadline) {
            if (endedAt) return onEnded();
            return finish(seekAt ? 'Video did not finish. Reload to retry.' : 'Playback did not start. Tap Play and reload.');
        }

        try {
            if (!observer) {
                player = document.getElementById('movie_player');
                const data = player?.getVideoData?.();
                if (data?.video_id === id && data.cpn && ['getDuration', 'getCurrentTime', 'getPlayerState', 'getAdState', 'seekTo', 'playVideo'].every(name => typeof player[name] === 'function')) {
                    if (data.isLive) return finish('Live video skipped.');
                    duration = player.getDuration();
                    if (Number.isFinite(duration) && duration > 0 && player.getAdState() === -1) {
                        cpn = data.cpn;
                        observer = new PerformanceObserver(observe);
                        observer.observe({ type: 'resource', buffered: true });
                    }
                }
            }
            if (observer) {
                if (!ownsPlayer()) return finish('Player changed; reload to retry.');
                if (player.getAdState() === -1) {
                    const state = player.getPlayerState();
                    if (!seekAt) {
                        if (state === 0 && player.getCurrentTime() >= duration - 0.5) return onEnded();
                        if (state === 1) {
                            duration = player.getDuration();
                            if (!Number.isFinite(duration) || duration <= 0) return finish('Video duration unavailable.');
                            seekAt = performance.now();
                            deadline = seekAt + 30000;
                            const target = Math.max(0, duration - 2);
                            if (player.getCurrentTime() < target) player.seekTo(target, true);
                            show('Playing the final two seconds.');
                        } else if (!playRequested && state !== 1 && state !== 3) {
                            playRequested = true;
                            player.playVideo();
                            show('Starting playback. Tap Play if blocked.');
                        }
                    } else if (state === 0 && !endedAt) {
                        endedAt = performance.now();
                        duration = player.getDuration();
                        deadline = endedAt + 3000;
                        show('Video ended. Checking its playback report.');
                    }
                }
                if (endedAt && report) return onEnded();
            }
            timer = setTimeout(tick, seekAt && !endedAt ? 250 : 500);
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
        generation++;
        playRequested = ready = shared = finalized = report = false;
        seekAt = endedAt = 0;
        if (!id) return;
        try {
            const previous = sessionStorage.getItem(sharedKey);
            if (previous === id) return;
            if (previous) sessionStorage.removeItem(sharedKey);
        } catch {}
        if (!window.navigation || !window.PerformanceObserver) return show('Required browser APIs unavailable.');
        if (typeof nativeShare !== 'function') return show('Native sharing unavailable.');
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
    begin();
})();

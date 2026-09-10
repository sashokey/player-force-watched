// ==UserScript==
// @name         YouTube 95%
// @namespace    local.youtube95
// @version      1.3.0
// @description  Finish the video naturally and open YouTube Home after sharing its link.
// @homepageURL  https://github.com/sashokey/player-force-watched
// @updateURL    https://raw.githubusercontent.com/sashokey/player-force-watched/master/player-force-watched.user.js
// @downloadURL  https://raw.githubusercontent.com/sashokey/player-force-watched/master/player-force-watched.user.js
// @match        https://m.youtube.com/*
// @run-at       document-idle
// @sandbox      raw
// @grant        unsafeWindow
// @grant        GM_getTab
// @grant        GM_saveTab
// @noframes
// ==/UserScript==

GM_getTab(tab => {
    'use strict';

    const page = unsafeWindow;
    const state = tab.playerForceWatched ||= {};
    if (state.document === page.performance.timeOrigin) return;
    state.document = page.performance.timeOrigin;
    GM_saveTab(tab);

    let id, player, timer, observer, deadline, duration, cpn, seekAt, endedAt;
    let ready = false, shared = false, pending = false, finalized = false, report = false, generation = 0;

    const videoId = () => page.location.pathname === '/watch' ? new URL(page.location.href).searchParams.get('v') : null;

    function stop() {
        clearTimeout(timer);
        timer = null;
        observer?.disconnect();
        observer = null;
        player = null;
    }

    function ownsPlayer() {
        try {
            const data = player?.getVideoData?.();
            return player?.isConnected && videoId() === id && data?.video_id === id && data.cpn === cpn;
        } catch {
            return false;
        }
    }

    function finalize() {
        if (!ready || !shared || finalized || videoId() !== id) return;
        finalized = true;
        state.shared = id;
        const current = generation;
        GM_saveTab(tab, () => {
            if (current === generation && videoId() === id) page.location.assign('https://m.youtube.com/');
        });
    }

    function onEnded() {
        ready = true;
        stop();
        finalize();
    }

    function onShare(event) {
        if (!event.isTrusted || event.button !== 0 || !id || finalized || !ready && !observer) return;
        const button = event.target?.closest?.('button');
        const model = button?.closest('button-view-model');
        if (!model?.closest('ytm-slim-video-action-bar-renderer') || model.data?.accessibilityId !== 'id.video.share.button' || button.disabled || button.getAttribute('aria-disabled') === 'true') return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (pending) return;
        pending = true;
        const current = generation;
        const target = id;
        try {
            page.navigator.share({ url: 'https://youtu.be/' + target }).then(() => {
                if (current !== generation || videoId() !== target) return;
                pending = false;
                shared = true;
                finalize();
            }, () => {
                if (current === generation) pending = false;
            });
        } catch {
            pending = false;
        }
    }

    function observe(list) {
        if (!ownsPlayer()) return;
        for (const entry of list.getEntries()) {
            if (!entry.name.includes('/api/stats/watchtime?')) continue;
            const url = new URL(entry.name);
            if (!['m.youtube.com', 'www.youtube.com', 's.youtube.com'].includes(url.hostname) || url.pathname !== '/api/stats/watchtime') continue;
            const params = url.searchParams;
            if (params.get('docid') !== id || params.get('cpn') !== cpn || params.get('adformat') || !params.get('cmt')) continue;
            const position = Number(params.get('cmt'));
            if (Number.isFinite(position) && position >= duration - 0.5 && position <= duration + 0.5 && seekAt && entry.startTime >= seekAt && params.get('state') === 'paused') report = true;
        }
    }

    function tick() {
        timer = null;
        if (videoId() !== id) return begin();
        if (page.performance.now() >= deadline) return endedAt ? onEnded() : stop();
        try {
            if (!observer) {
                player = page.document.getElementById('movie_player');
                const data = player?.getVideoData?.();
                if (data?.video_id === id && data.cpn && ['getDuration', 'getCurrentTime', 'getPlayerState', 'getAdState', 'seekTo'].every(name => typeof player[name] === 'function')) {
                    if (data.isLive) return stop();
                    duration = player.getDuration();
                    if (Number.isFinite(duration) && duration > 0 && player.getAdState() === -1) {
                        cpn = data.cpn;
                        observer = new page.PerformanceObserver(observe);
                        observer.observe({ type: 'resource', buffered: true });
                    }
                }
            }
            if (observer) {
                if (!ownsPlayer()) return stop();
                if (player.getAdState() === -1) {
                    const status = player.getPlayerState();
                    if (!seekAt) {
                        if (status === 0 && player.getCurrentTime() >= duration - 0.5) return onEnded();
                        if (status === 1) {
                            duration = player.getDuration();
                            if (!Number.isFinite(duration) || duration <= 0) return stop();
                            seekAt = page.performance.now();
                            deadline = seekAt + 30000;
                            const target = Math.max(0, duration - 2);
                            if (player.getCurrentTime() < target) player.seekTo(target, true);
                        }
                    } else if (status === 0 && !endedAt) {
                        endedAt = page.performance.now();
                        duration = player.getDuration();
                        deadline = endedAt + 3000;
                    }
                }
                if (endedAt && report) return onEnded();
            }
            timer = setTimeout(tick, seekAt && !endedAt ? 250 : 500);
        } catch {
            stop();
        }
    }

    function begin() {
        const next = videoId();
        if (next === id) return;
        stop();
        id = next;
        generation++;
        ready = shared = pending = finalized = report = false;
        seekAt = endedAt = 0;
        if (!id || state.shared === id) return;
        if (state.shared) {
            delete state.shared;
            GM_saveTab(tab);
        }
        if (!page.navigation || !page.PerformanceObserver || typeof page.navigator.share !== 'function') return;
        deadline = page.performance.now() + 60000;
        tick();
    }

    page.document.addEventListener('click', onShare, true);
    page.navigation?.addEventListener('navigatesuccess', begin);
    page.addEventListener('pagehide', () => {
        generation++;
        stop();
    });
    page.addEventListener('pageshow', event => {
        if (event.persisted) {
            id = undefined;
            begin();
        }
    });
    begin();
});

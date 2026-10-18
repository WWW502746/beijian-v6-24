(() => {
  const required = matchMedia('(min-width:801px) and (pointer:fine)').matches;
  let resolveReady;
  const ready = new Promise(resolve => { resolveReady = resolve; });
  const api = window.sitePreload = {required, state: required ? 'loading' : 'disabled', ready, start};
  if (!required) { resolveReady(); return; }
  document.documentElement.classList.add('is-preparing');
  document.body.classList.add('has-full-preload');
  const boot = document.querySelector('.boot');
  boot.removeAttribute('aria-hidden');
  boot.setAttribute('aria-label', '展览加载进度');
  boot.innerHTML = '<div class="preparation"><img class="preparation__mark" src="assets/landing-v5/beijian-original.svg" alt="碑间" width="197" height="110"><p class="preparation__eyebrow">STONE / PAPER / SPACE</p><h1>让石与纸，先抵达。</h1><p class="preparation__status" role="status" aria-live="polite">正在整理展览内容</p><div class="preparation__progress" role="progressbar" aria-label="加载进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div><div class="preparation__numbers"><strong>0<span>%</span></strong><small>准备中</small></div><p class="preparation__note">影片、作品与字形准备完成后，开启体验。<br>首次载入可能需要一些时间。</p><button class="preparation__enter" type="button" hidden>进入碑间 <span aria-hidden="true">↗</span></button><button class="preparation__retry" type="button" hidden>重试加载</button></div><p class="preparation__footer">BEIJIAN · A DIGITAL EXHIBITION</p>';
  const bar = boot.querySelector('[role="progressbar"]'), fill = bar.querySelector('i');
  const number = boot.querySelector('.preparation__numbers strong'), detail = boot.querySelector('.preparation__numbers small');
  const status = boot.querySelector('.preparation__status'), enter = boot.querySelector('.preparation__enter'), retry = boot.querySelector('.preparation__retry');
  const gameFrame = document.createElement('iframe');
  gameFrame.className = 'loading-game-frame';
  gameFrame.title = '等待之间，叠石成拓';
  const gameURL = new URL('assets/loading-game/index.html?v=stackreadable20261019', location.href);
  gameFrame.setAttribute('allow', 'autoplay');
  let gameWindow, gameEntered = false;
  function syncGame() {
    if (!gameWindow || gameEntered) return;
    const game = gameWindow.beijianStack;
    game.setProgress(Number(bar.getAttribute('aria-valuenow')) / 100, api.state === 'ready' ? '展览准备完成' : status.textContent);
    const document = gameWindow.document;
    document.querySelector('#load-detail').textContent = detail.textContent;
    document.querySelector('#load-note').textContent = api.state === 'error' ? '已完成的内容会保留，请继续加载。' : '';
    const resume = document.querySelector('#load-retry');
    resume.hidden = retry.hidden; resume.textContent = retry.textContent;
    if (api.state === 'ready' && document.querySelector('#enter').hidden) game.setReady(() => enter.click());
  }
  gameFrame.addEventListener('load', () => {
    const content = gameFrame.contentWindow;
    if (!content?.beijianStack) return;
    gameWindow = content;
    content.document.querySelector('#load-retry').onclick = () => retry.click();
    syncGame(); boot.classList.add('has-loading-game');
  });
  const gameSync = new MutationObserver(syncGame);
  gameSync.observe(boot.querySelector('.preparation'), {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'aria-valuenow']});
  window.addEventListener('site:entered', () => {
    gameEntered = true; gameSync.disconnect(); gameFrame.remove(); gameWindow = null;
  }, {once: true});
  boot.append(gameFrame);
  // Read the current interface even when a previous exhibition cache is active.
  fetch(gameURL, {cache: 'no-store', headers: {'X-Beijian-Preload': '1'}}).then(response => {
    if (!response.ok) throw new Error('等待小游戏暂不可用');
    return response.text();
  }).then(html => {
    if (!gameEntered) gameFrame.srcdoc = html.replace('<head>', `<head><base href="${new URL('./', gameURL).href}">`);
  }).catch(() => gameFrame.remove());
  const main = document.querySelector('main'), header = document.querySelector('.site-header');
  main.inert = header.inert = true;
  let running = false, manifest, cache, previousCaches = [], downloadFailure, completed = 0, doneFiles = 0, lastPercent = 0, lastDetail = '';
  const inflight = new Map();
  const transfers = new Set();
  const megabytes = value => (value / 1000000).toFixed(1);
  function paint(final = false) {
    const total = manifest?.desktop.bytes || 1;
    const received = completed + [...inflight.values()].reduce((sum, bytes) => sum + bytes, 0);
    const percent = final ? 100 : Math.max(lastPercent, Math.min(97, Math.floor(received / total * 97)));
    if (percent !== lastPercent || final) {
      lastPercent = percent; bar.setAttribute('aria-valuenow', String(percent));
      fill.style.transform = `scaleX(${percent / 100})`; number.innerHTML = `${percent}<span>%</span>`;
    }
    const label = manifest ? `${megabytes(Math.min(received, total))} / ${megabytes(total)} MB` : '准备中';
    if (label !== lastDetail) { lastDetail = label; detail.textContent = label; }
  }
  async function controlWorker() {
    if (location.protocol === 'file:') throw new Error('请从本地预览入口打开体验。');
    if (!('serviceWorker' in navigator) || !('caches' in window)) throw new Error('当前浏览器无法完整保存展览内容，请使用新版浏览器。');
    await navigator.serviceWorker.register('preload-worker.js', {scope: './', updateViaCache: 'none'});
    const expected = new URL('preload-worker.js', location.href).href;
    if (navigator.serviceWorker.controller?.scriptURL !== expected) await new Promise((resolve, reject) => {
      const check = () => {
        if (navigator.serviceWorker.controller?.scriptURL !== expected) return;
        clearTimeout(timer); navigator.serviceWorker.removeEventListener('controllerchange', check); resolve();
      };
      const timer = setTimeout(() => {
        navigator.serviceWorker.removeEventListener('controllerchange', check);
        reject(new Error('展览加载服务尚未就绪，请重试。'));
      }, 15000);
      navigator.serviceWorker.addEventListener('controllerchange', check); check();
    });
  }
  function deadline(task, milliseconds, message, abort) {
    let timer;
    return Promise.race([task, new Promise((_, reject) => {
      timer = setTimeout(() => { abort?.(); reject(new Error(message)); }, milliseconds);
    })]).finally(() => clearTimeout(timer));
  }
  function checkResponse(response) {
    if (response.status === 200 && response.body) return;
    const error = new Error('有部分内容暂不可用，请稍后继续加载。');
    error.network = [408, 425, 429].includes(response.status) || response.status >= 500;
    throw error;
  }
  async function reconnect(operation) {
    let attempt = 0;
    while (true) {
      if (downloadFailure) throw downloadFailure;
      try { return await operation(); }
      catch (error) {
        if (downloadFailure) throw downloadFailure;
        if (error.name === 'NetworkError' && !error.network) { error.network = true; error.limit = 2; }
        if (!error.network || (error.limit !== undefined && attempt >= error.limit)) throw error;
        api.state = 'reconnecting'; api.retries = (api.retries || 0) + 1;
        status.textContent = '连接有些慢，正在自动继续加载';
        boot.querySelector('.preparation__note').textContent = '已完成的内容会保留，无需刷新页面。';
        const delay = Math.min(1000 * 2 ** Math.min(attempt++, 4), 15000);
        await new Promise(resolve => {
          const online = () => { clearTimeout(timer); window.removeEventListener('online', online); resolve(); };
          const timer = setTimeout(online, navigator.onLine === false ? 15000 : delay);
          window.addEventListener('online', online, {once: true});
        });
        api.state = 'loading'; status.textContent = '正在载入影片、作品与字形';
      }
    }
  }
  async function readManifest() {
    return reconnect(async () => {
      const controller = new AbortController();
      try {
        return await deadline((async () => {
          const response = await fetch('preload-manifest.json', {cache: 'no-store', headers: {'X-Beijian-Preload': '1'}, signal: controller.signal});
          checkResponse(response); return await response.json();
        })(), 45000, '展览清单读取较慢，正在重新连接。', () => controller.abort());
      } catch (error) {
        if (controller.signal.aborted || ['TypeError', 'AbortError', 'NetworkError'].includes(error.name)) error.network = true;
        throw error;
      }
    });
  }
  function assetResponse(body, file, originalHeaders) {
    const headers = new Headers(originalHeaders);
    headers.delete('Content-Encoding'); headers.delete('Transfer-Encoding');
    headers.set('Content-Length', String(file.bytes));
    headers.set('X-Beijian-SHA256', file.sha256); headers.set('X-Beijian-Bytes', String(file.bytes));
    return new Response(body, {status: 200, headers});
  }
  async function matchesAsset(response, file) {
    if (response.headers.get('X-Beijian-SHA256') === file.sha256 && response.headers.get('X-Beijian-Bytes') === String(file.bytes)) return true;
    // Older prepared versions have no fingerprints; verify their bytes before reuse.
    const blob = await response.blob();
    if (blob.size !== file.bytes) return false;
    const data = await blob.arrayBuffer();
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(value => value.toString(16).padStart(2, '0')).join('');
    return hash === file.sha256 ? blob : false;
  }
  async function downloadAsset(file, url) {
    const controller = new AbortController();
    transfers.add(controller);
    let received = 0, timer, saving = false;
    let rejectStalled;
    const stalled = new Promise((_, reject) => { rejectStalled = reject; });
    const watch = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const error = new Error(saving ? '浏览器保存内容较慢，请稍后继续。' : '连接有些慢，正在自动继续加载');
        error.network = true; if (saving) error.limit = 2;
        rejectStalled(error); controller.abort();
      }, saving ? 60000 : 45000);
    };
    inflight.set(url, 0); api.currentFile = file.url; watch();
    try {
      const response = await Promise.race([fetch(url, {cache: 'reload', headers: {'X-Beijian-Preload': '1'}, signal: controller.signal}), stalled]);
      checkResponse(response);
      const measured = response.body.pipeThrough(new TransformStream({
        transform(chunk, output) {
          received += chunk.byteLength;
          if (received > file.bytes) throw new Error('内容校验未通过，请稍后继续。');
          inflight.set(url, received); paint(); watch(); output.enqueue(chunk);
        },
        flush() {
          if (received !== file.bytes) throw new Error('内容校验未通过，请稍后继续。');
          saving = true; watch();
        }
      }), {signal: controller.signal});
      // One stream goes straight into storage; do not clone the entire HD response.
      await Promise.race([cache.put(url, assetResponse(measured, file, response.headers)), stalled]);
    } catch (error) {
      if (['TypeError', 'AbortError', 'NetworkError'].includes(error.name)) error.network = true;
      controller.abort(); throw error;
    } finally { clearTimeout(timer); transfers.delete(controller); inflight.delete(url); paint(); }
  }
  async function storeAsset(file) {
    api.currentFile = file.url;
    const url = new URL(file.url, location.href).href;
    if (new URL(url).origin !== location.origin || !Number.isSafeInteger(file.bytes) || file.bytes <= 0 || !/^[a-f\d]{64}$/.test(file.sha256)) throw new Error('展览资源清单异常，请稍后继续。');
    await reconnect(async () => {
      let found = false;
      for (const source of [cache, ...previousCaches]) {
        const existing = await source.match(url);
        if (!existing) continue;
        let matches = false;
        try { matches = await deadline(matchesAsset(existing, file), 60000, '正在核对已保存的内容。'); } catch {}
        if (!matches) { if (source === cache) await cache.delete(url); continue; }
        if (source !== cache || !existing.headers.has('X-Beijian-SHA256')) {
          // Rewrapping a large cached response stream fails in some Chromium builds.
          const body = matches === true ? await deadline(existing.blob(), 60000, '正在核对已保存的内容。') : matches;
          if (body.size !== file.bytes) throw new Error('已保存内容校验未通过，请继续加载。');
          await deadline(cache.put(url, assetResponse(body, file, existing.headers)), 60000, '浏览器保存内容较慢，请稍后继续。');
        }
        found = true; break;
      }
      if (!found) await downloadAsset(file, url);
    });
    for (const alias of file.aliases || []) {
      if (new URL(alias, location.href).origin !== location.origin) throw new Error('展览资源地址异常。');
      await reconnect(async () => deadline(cache.put(new URL(alias, location.href).href, await cache.match(url)), 60000, '浏览器保存内容较慢，请稍后继续。'));
    }
    completed += file.bytes; doneFiles++; paint();
  }
  async function useCache(name) {
    const channel = new MessageChannel();
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('内容已下载，正在连接播放服务，请重试。')), 15000);
      channel.port1.onmessage = event => { if (event.data?.ready) { clearTimeout(timer); channel.port1.close(); resolve(); } };
      navigator.serviceWorker.controller.postMessage({type: 'beijian-use-cache', name}, [channel.port2]);
    });
  }
  async function start() {
    if (running || api.state === 'ready' || api.state === 'entered') return;
    running = true; api.state = 'loading'; api.error = null; retry.hidden = enter.hidden = true;
    completed = 0; doneFiles = 0; downloadFailure = null; inflight.clear(); status.textContent = '正在载入影片、作品与字形';
    try {
      await controlWorker();
      manifest = await readManifest();
      if (!/^[a-f\d]{64}$/.test(manifest.cacheVersion) || !manifest.desktop?.files?.length) throw new Error('展览清单暂不可用，请重试。');
      const name = 'beijian-v6-24-ready-' + manifest.cacheVersion;
      const older = (await caches.keys()).filter(key => key.startsWith('beijian-v6-24-ready-') && key !== name);
      previousCaches = await Promise.all([...older].reverse().map(key => caches.open(key)));
      cache = await caches.open(name);
      const queue = [...manifest.desktop.files];
      let downloadError;
      async function consume() {
        while (queue.length && !downloadError) {
          const file = queue.shift();
          try { await storeAsset(file); } catch (error) {
            downloadError = downloadFailure = error;
            for (const transfer of transfers) transfer.abort();
            throw error;
          }
        }
      }
      const results = await Promise.allSettled([consume(), consume()]);
      const failure = results.find(result => result.status === 'rejected');
      if (failure) throw failure.reason;
      if (doneFiles !== manifest.desktop.files.length) throw new Error('还有内容未准备完成，请重试。');
      await useCache(name);
      api.state = 'warming'; status.textContent = '下载完成，正在准备字形';
      await deadline(document.fonts.ready, 60000, '字形准备较慢，已保留下载进度，请继续加载。');
      status.textContent = '下载完成，正在准备影片';
      await deadline(window.homeFilm?.prepare?.(), 60000, '影片准备较慢，已保留下载进度，请继续加载。');
      status.textContent = '下载完成，正在准备展品';
      await deadline(window.prepareExhibition?.(), 60000, '展品准备较慢，已保留下载进度，请继续加载。');
      api.state = 'ready'; status.textContent = '已准备就绪'; paint(true); enter.hidden = false;
      boot.querySelector('.preparation__note').textContent = '所有内容已准备好，开启这次观看。';
      resolveReady(); window.dispatchEvent(new CustomEvent('site:ready'));
      Promise.allSettled(older.map(key => caches.delete(key)));
    } catch (error) {
      api.state = 'error';
      api.error = {name: error.name, message: error.message, file: api.currentFile};
      console.error('展览准备未完成：', error);
      status.textContent = error.name === 'QuotaExceededError' ? '设备可用空间不足，请释放空间后重试。' : error.name === 'AbortError' ? '内容读取等待较长，请重试加载。' : error.name === 'TypeError' ? '浏览器未能完成内容准备，请继续加载。' : error.message || '有部分内容暂未载入，请重试。';
      if (location.protocol === 'file:') {
        boot.querySelector('.preparation__note').textContent = '先运行同文件夹中的“启动碑林本地预览”，再点击下方按钮。';
        retry.textContent = '打开本地体验';
      }
      retry.hidden = false;
      if (location.protocol !== 'file:') retry.textContent = '继续加载';
    } finally { running = false; }
  }
  retry.onclick = () => {
    if (location.protocol === 'file:') location.href = 'http://127.0.0.1:4173/?v=local24fps20261017' + location.hash;
    else start();
  };
  enter.onclick = () => {
    if (api.state !== 'ready') return;
    api.state = 'entered'; main.inert = header.inert = false;
    document.documentElement.classList.remove('is-preparing'); boot.classList.add('is-gone');
    window.dispatchEvent(new CustomEvent('site:entered'));
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true}); else start();
})();

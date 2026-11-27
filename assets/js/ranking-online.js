'use strict';

const rankingOnline = (() => {
  const { url, publishableKey } = rankingConfig;
  const endpoint = url.replace(/\/$/, '') + '/functions/v1/tiresias-jogo';
  const available = /^https:\/\/[^/]+$/.test(url.replace(/\/$/, '')) &&
    publishableKey.startsWith('sb_publishable_') && location.protocol !== 'file:';
  let token;
  let clockOffset = 0;
  let startsAt = 0;

  async function request(op, payload = {}) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: publishableKey },
      body: JSON.stringify({ op, ...payload }),
      signal: AbortSignal.timeout(4500)
    });
    const data = await response.json();
    if (!response.ok) {
      throw Object.assign(new Error(data.erro ?? 'servico'), { data, status: response.status });
    }
    return data;
  }

  async function start() {
    const sent = performance.now();
    const data = await request('iniciar');
    clockOffset = data.agora - (sent + performance.now()) / 2;
    startsAt = data.inicio;
    token = data.token;
  }

  async function decide(numero, aprovar) {
    try {
      return await request('decidir', { token, numero, aprovar });
    } catch (error) {
      if (error.status && error.status < 500) throw error;
      return request('decidir', { token, numero, aprovar });
    }
  }

  return {
    available,
    start,
    now: () => performance.now() + clockOffset,
    firstOpening: () => startsAt + Math.floor(342 * 2000 / 356),
    reveal: numero => request('revelar', { token, numero }),
    decide,
    publish: apelido => request('publicar', { token, apelido }),
    load: () => request('consultar')
  };
})();

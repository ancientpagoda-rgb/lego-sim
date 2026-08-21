const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

function encodeSignal(description) {
  const bytes = new TextEncoder().encode(JSON.stringify(description));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeSignal(code) {
  const clean = String(code || '').trim();
  if (!clean) throw new Error('Missing pairing code');
  const binary = atob(clean);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function waitForIce(connection, timeoutMs = 4500) {
  if (connection.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise(resolve => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      connection.removeEventListener('icegatheringstatechange', onChange);
      clearTimeout(timer);
      resolve();
    };
    const onChange = () => {
      if (connection.iceGatheringState === 'complete') done();
    };
    const timer = setTimeout(done, timeoutMs);
    connection.addEventListener('icegatheringstatechange', onChange);
  });
}

function randomId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID().slice(0, 8);
  return Math.random().toString(36).slice(2, 10);
}

export class PeerSync {
  constructor(room = '5986') {
    this.room = room;
    this.peerId = randomId();
    this.onpacket = null;
    this.onstatus = null;
    this.connection = null;
    this.channel = null;
    this.broadcastChannel = typeof BroadcastChannel === 'function'
      ? new BroadcastChannel(`lego-sim:${room}`)
      : null;
    if (this.broadcastChannel) {
      this.broadcastChannel.onmessage = event => this.#receive(event.data, 'local');
    }
  }

  #emitStatus(label) {
    this.onstatus?.(label);
  }

  #receive(packet, transport) {
    if (!packet || packet.room !== this.room || packet.sender === this.peerId) return;
    this.onpacket?.({ ...packet, transport });
  }

  send(type, payload) {
    const packet = {
      v: 1,
      room: this.room,
      sender: this.peerId,
      sentAt: Date.now(),
      type,
      payload,
    };
    this.broadcastChannel?.postMessage(packet);
    if (this.channel?.readyState === 'open') {
      this.channel.send(JSON.stringify(packet));
    }
  }

  #prepareConnection() {
    this.connection?.close();
    this.connection = new RTCPeerConnection(RTC_CONFIG);
    this.connection.onconnectionstatechange = () => {
      const state = this.connection?.connectionState || 'closed';
      this.#emitStatus(`p2p:${state}`);
    };
    this.connection.ondatachannel = event => this.#attachChannel(event.channel);
    return this.connection;
  }

  #attachChannel(channel) {
    this.channel = channel;
    channel.onopen = () => {
      this.#emitStatus('p2p:connected');
      this.send('hello', { peerId: this.peerId });
    };
    channel.onclose = () => this.#emitStatus('p2p:closed');
    channel.onerror = () => this.#emitStatus('p2p:error');
    channel.onmessage = event => {
      try {
        this.#receive(JSON.parse(event.data), 'p2p');
      } catch (error) {
        console.warn('LEGO Sim multiplayer packet rejected', error);
      }
    };
  }

  async createOffer() {
    const connection = this.#prepareConnection();
    this.#attachChannel(connection.createDataChannel('lego-sim-world', { ordered: false, maxRetransmits: 1 }));
    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);
    await waitForIce(connection);
    this.#emitStatus('p2p:offer-ready');
    return encodeSignal(connection.localDescription);
  }

  async createAnswer(offerCode) {
    const connection = this.#prepareConnection();
    await connection.setRemoteDescription(decodeSignal(offerCode));
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);
    await waitForIce(connection);
    this.#emitStatus('p2p:answer-ready');
    return encodeSignal(connection.localDescription);
  }

  async acceptAnswer(answerCode) {
    if (!this.connection) throw new Error('Create a host offer first');
    await this.connection.setRemoteDescription(decodeSignal(answerCode));
    this.#emitStatus('p2p:connecting');
  }

  dispose() {
    this.broadcastChannel?.close();
    this.channel?.close();
    this.connection?.close();
  }
}

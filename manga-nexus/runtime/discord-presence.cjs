const DISCORD_APPLICATION_ID = '1543672597890338918';
const RECONNECT_DELAY_MS = 30_000;

function normalizePresenceMode(value) {
  return value === 'reading' ? 'reading' : 'browsing';
}

class DiscordPresenceController {
  constructor({ RPC, clientId = DISCORD_APPLICATION_ID, onStatus = () => {}, now = () => Date.now(), reconnectDelayMs = RECONNECT_DELAY_MS } = {}) {
    this.RPC = RPC;
    this.clientId = clientId;
    this.onStatus = onStatus;
    this.now = now;
    this.reconnectDelayMs = reconnectDelayMs;
    this.enabled = false;
    this.mode = 'browsing';
    this.status = 'disabled';
    this.client = null;
    this.connectionPromise = null;
    this.reconnectTimer = null;
    this.lastAttemptAt = 0;
    this.startedAt = this.now();
  }

  snapshot() {
    return { enabled: this.enabled, mode: this.mode, status: this.status };
  }

  setEnabled(enabled, { retry = false } = {}) {
    this.enabled = Boolean(enabled);
    if (!this.enabled) {
      this._clearReconnectTimer();
      this._setStatus('disabled');
      void this._disconnect();
      return this.snapshot();
    }

    void this._connect({ force: retry });
    return this.snapshot();
  }

  setMode(mode) {
    const nextMode = normalizePresenceMode(mode);
    if (nextMode !== this.mode) {
      this.mode = nextMode;
      this.startedAt = this.now();
    }
    if (this.enabled) {
      if (this.client?.isConnected) void this._publish(this.client);
      else void this._connect();
    }
    return this.snapshot();
  }

  async dispose() {
    this.enabled = false;
    this._clearReconnectTimer();
    this._setStatus('disabled');
    await this._disconnect();
  }

  async _connect({ force = false } = {}) {
    if (!this.enabled) return;
    if (!this.RPC?.Client) {
      this._setStatus('unavailable');
      return;
    }
    if (this.client?.isConnected) {
      await this._publish(this.client);
      return;
    }
    if (this.connectionPromise) return this.connectionPromise;

    const now = this.now();
    if (!force && this.lastAttemptAt && now - this.lastAttemptAt < this.reconnectDelayMs) {
      this._scheduleReconnect();
      return;
    }

    this._clearReconnectTimer();
    this.lastAttemptAt = now;
    this._setStatus('connecting');
    this.connectionPromise = (async () => {
      const client = new this.RPC.Client({ clientId: this.clientId });
      this.client = client;
      client.on?.('disconnected', () => {
        if (this.client !== client) return;
        this.client = null;
        if (!this.enabled) return;
        this._setStatus('unavailable');
        this._scheduleReconnect();
      });
      await client.login();
      if (!this.enabled || this.client !== client) {
        await this._destroyClient(client);
        return;
      }
      this._setStatus('connected');
      await this._publish(client);
    })().catch(async () => {
      if (this.client) {
        const failedClient = this.client;
        this.client = null;
        await this._destroyClient(failedClient);
      }
      if (!this.enabled) return;
      this._setStatus('unavailable');
      this._scheduleReconnect();
    }).finally(() => {
      this.connectionPromise = null;
    });
    return this.connectionPromise;
  }

  async _publish(client) {
    if (!this.enabled || !client?.user?.setActivity) return;
    try {
      await client.user.setActivity({
        details: this.mode === 'reading' ? 'Reading manga' : 'Browsing manga',
        state: 'akaReader',
        startTimestamp: new Date(this.startedAt),
      });
    } catch {
      if (this.client !== client) return;
      this.client = null;
      await this._destroyClient(client);
      if (!this.enabled) return;
      this._setStatus('unavailable');
      this._scheduleReconnect();
    }
  }

  async _disconnect() {
    const client = this.client;
    this.client = null;
    if (!client) return;
    try { await client.user?.clearActivity?.(); } catch {}
    await this._destroyClient(client);
  }

  async _destroyClient(client) {
    try { await client?.destroy?.(); } catch {}
  }

  _scheduleReconnect() {
    if (!this.enabled || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this._connect({ force: true });
    }, this.reconnectDelayMs);
    this.reconnectTimer.unref?.();
  }

  _clearReconnectTimer() {
    if (!this.reconnectTimer) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  _setStatus(status) {
    if (this.status === status) return;
    this.status = status;
    this.onStatus(this.snapshot());
  }
}

module.exports = {
  DISCORD_APPLICATION_ID,
  DiscordPresenceController,
  normalizePresenceMode,
};

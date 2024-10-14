class InMemoryCache {
  constructor() {
    this.guilds = new Map();
    this.channels = new Map();
    this.members = new Map();
    this.presences = new Map();
    this.emojis = new Map();
    this.roles = new Map();
    this.unavailableGuilds = new Set();
  }

  // Guild methods
  getGuild(guildId) {
    return this.guilds.get(guildId);
  }

  addGuild(guild) {
    this.guilds.set(guild.id, guild);
  }

  updateGuild(guild) {
    this.guilds.set(guild.id, guild);
  }

  iterGuilds() {
    return this.guilds.values();
  }

  iterUnavailableGuilds() {
    return [...this.unavailableGuilds];
  }

  removeGuild(guildId) {
    this.guilds.delete(guildId);
  }

  guildChannels(guildId) {
    return this.channels.get(guildId) || [];
  }

  guildPresences(guildId) {
    return this.presences.get(guildId) || [];
  }

  guildEmojis(guildId) {
    return this.emojis.get(guildId) || [];
  }

  guildMembers(guildId) {
    return this.members.get(guildId) || [];
  }

  guildRoles(guildId) {
    return this.roles.get(guildId) || [];
  }

  addUnavailableGuild(guildId) {
    this.unavailableGuilds.add(guildId);
  }

  // Channel methods
  channel(channelId) {
    return this.channels.get(channelId);
  }

  addChannel(channel) {
    this.channels.set(channel.id, channel);
  }

  // Presence methods
  presence(guildId, userId) {
    return this.presences.get(`${guildId}-${userId}`);
  }

  addPresence(guildId, userId, presence) {
    this.presences.set(`${guildId}-${userId}`, presence);
  }

  // Emoji methods
  emoji(emojiId) {
    return this.emojis.get(emojiId);
  }

  addEmoji(emoji) {
    this.emojis.set(emoji.id, emoji);
  }

  // Member methods
  member(guildId, userId) {
    return this.members.get(`${guildId}-${userId}`);
  }

  addMember(guildId, userId, member) {
    this.members.set(`${guildId}-${userId}`, member);
  }

  // Role methods
  role(roleId) {
    return this.roles.get(roleId);
  }

  addRole(role) {
    this.roles.set(role.id, role);
  }

  // Update method
  update(value) {
    if (value.guild) this.updateGuild(value.guild);
    if (value.channel) this.addChannel(value.channel);
    if (value.presence)
      this.addPresence(value.guildId, value.userId, value.presence);
    if (value.emoji) this.addEmoji(value.emoji);
    if (value.member) this.addMember(value.guildId, value.userId, value.member);
    if (value.role) this.addRole(value.role);
  }

  // Cache stats
  stats() {
    return {
      guilds: this.guilds.size,
      channels: this.channels.size,
      presences: this.presences.size,
      members: this.members.size,
      emojis: this.emojis.size,
      roles: this.roles.size,
    };
  }
}

module.exports = { InMemoryCache };

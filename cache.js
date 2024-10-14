class Payload {
	constructor(d, op, t, s) {
		this.d = d;
		this.op = op;
		this.t = t;
		this.s = s;
	}
}

class Guilds {
	constructor(cache) {
		this.cache = cache;
	}

	update(value) {
		this.cache.update(value);
	}

	stats() {
		return this.cache.stats();
	}

	getReadyPayload(ready, sequence) {
		sequence++;

		const guildIdToJson = (guildId) => {
			return {
				id: guildId.toString(),
				unavailable: true,
			};
		};

		const guilds = [...this.cache.iterGuilds()]
			.filter((guild) => !guild.unavailable())
			.map((guild) => guildIdToJson(guild.id))
			.concat(this.cache.iterUnavailableGuilds().map(guildIdToJson));

		ready.guilds = guilds;

		return new Payload(ready, "DISPATCH", "READY", sequence);
	}

	channelsInGuild(guildId) {
		const guildChannels = this.cache.guildChannels(guildId);
		if (!guildChannels) return [];

		return guildChannels.filter((channel) => !channel.kind.isThread()).map((channelId) => this.cache.channel(channelId));
	}

	presencesInGuild(guildId) {
		const presences = this.cache.guildPresences(guildId);
		if (!presences) return [];

		return presences
			.map((userId) => {
				const presence = this.cache.presence(guildId, userId);
				if (!presence) return null;

				return {
					activities: presence.activities,
					client_status: presence.client_status,
					guild_id: presence.guild_id,
					status: presence.status,
					user: { id: presence.user_id },
				};
			})
			.filter(Boolean);
	}

	emojisInGuild(guildId) {
		const emojis = this.cache.guildEmojis(guildId);
		if (!emojis) return [];

		return emojis.map((emojiId) => {
			const emoji = this.cache.emoji(emojiId);
			return {
				animated: emoji.animated,
				available: emoji.available,
				id: emoji.id,
				managed: emoji.managed,
				name: emoji.name,
				require_colons: emoji.require_colons,
				roles: emoji.roles,
				user: emoji.user_id ? this.cache.user(emoji.user_id) : null,
			};
		});
	}

	membersInGuild(guildId) {
		const members = this.cache.guildMembers(guildId);
		if (!members) return [];

		return members.map((userId) => this.member(guildId, userId));
	}

	member(guildId, userId) {
		const member = this.cache.member(guildId, userId);
		if (!member) return null;

		return {
			avatar: member.avatar,
			communication_disabled_until: member.communication_disabled_until,
			deaf: member.deaf,
			flags: member.flags,
			joined_at: member.joined_at,
			mute: member.mute,
			nick: member.nick,
			pending: member.pending,
			premium_since: member.premium_since,
			roles: member.roles,
			user: this.cache.user(member.user_id),
		};
	}

	rolesInGuild(guildId) {
		const roles = this.cache.guildRoles(guildId);
		if (!roles) return [];

		return roles.map((roleId) => this.cache.role(roleId));
	}

	getGuildPayloads(sequence) {
		return [...this.cache.iterGuilds()].map((guild) => {
			sequence++;

			if (guild.unavailable) {
				return JSON.stringify(
					new Payload(
						{
							id: guild.id,
							unavailable: true,
						},
						"DISPATCH",
						"GUILD_DELETE",
						sequence
					)
				);
			} else {
				const guildChannels = this.channelsInGuild(guild.id);
				const presences = this.presencesInGuild(guild.id);
				const emojis = this.emojisInGuild(guild.id);
				const members = this.membersInGuild(guild.id);
				const roles = this.rolesInGuild(guild.id);

				const newGuild = {
					id: guild.id,
					name: guild.name,
					channels: guildChannels,
					presences,
					emojis,
					members,
					roles,
					// Other fields can be added here as needed
				};

				return JSON.stringify(new Payload(newGuild, "DISPATCH", "GUILD_CREATE", sequence));
			}
		});
	}
}

module.exports = { Guilds };

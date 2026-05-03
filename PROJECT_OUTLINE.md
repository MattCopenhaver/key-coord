In this project, I'd like to build a series of applications, primarily aimed at learning and exploring AI coding via Claude Code, using Github Actions for CI/CD, Discord bots/apps, and maybe a new language.

The applications will work together to collect, present, and notify guildmates in World of Warcraft about Mythic Dungeon keys.  For context, mythic dungeons require an item that each character can only have one of at a time, to give access to a specific dungeon at a certain level.  Characters may want to target specific dungeons or levels and may want to coordinate to form 5 man groups.

The application itself will consist of:
- A backend set of CRUD APIs to store data about which characters have which keys
    - This will likely require some sort of authentication based on the WoW APIs, but I don't know for sure how that will be done yet.
- An in-game WoW addon that finds the current key a player has and sends that information to the backend.
- A website that, upon authenticating as a WoW character, will allow you to see your guild's keys.
- A discord bot that will report all changes in keys to a channel, and respond when asked who has a certain type of key.

I'd like to use AWS pay-per-use services for this app, since it will likely be very low traffic.  My initial thoughts
- DynamoDB for storage
- Lambda + API Gateway for apis
- DynamoDB Streams + Lambda for pushing events to discord
- For website hosting, I'm not sure of the current best way to do that in AWS.  Research required,

Languages will by Javascript for most things, and I think WoW addons need to be Lua.


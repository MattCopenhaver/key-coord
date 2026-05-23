import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, DeleteCommand, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import { type APIGatewayProxyEventV2, type APIGatewayProxyResultV2 } from 'aws-lambda'

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))
const secretsClient = new SecretsManagerClient({})

const DISCORD_CONFIG_TABLE_NAME = process.env.DISCORD_CONFIG_TABLE_NAME
if (DISCORD_CONFIG_TABLE_NAME === undefined) throw new Error('DISCORD_CONFIG_TABLE_NAME env var is required')

const DISCORD_PENDING_TABLE_NAME = process.env.DISCORD_PENDING_TABLE_NAME
if (DISCORD_PENDING_TABLE_NAME === undefined) throw new Error('DISCORD_PENDING_TABLE_NAME env var is required')

const DISCORD_SECRET_NAME = process.env.DISCORD_SECRET_NAME
if (DISCORD_SECRET_NAME === undefined) throw new Error('DISCORD_SECRET_NAME env var is required')

interface BlizzardProfile {
  wow_accounts: Array<{ characters: Array<{ name: string, realm: { slug: string } }> }>
}

interface BlizzardGuildRoster {
  members: Array<{ character: { name: string }, rank: number }>
}

interface DiscordSecret {
  botToken: string
}

let cachedBotToken: string | null = null

async function getBotToken (): Promise<string> {
  if (cachedBotToken !== null) return cachedBotToken
  const result = await secretsClient.send(new GetSecretValueCommand({ SecretId: DISCORD_SECRET_NAME }))
  const secret = JSON.parse(result.SecretString ?? '{}') as DiscordSecret
  cachedBotToken = secret.botToken
  return cachedBotToken
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  console.log('discordSetup invoked')

  const authHeader = event.headers.authorization
  if (authHeader === undefined || !authHeader.startsWith('Bearer ')) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Missing or invalid Authorization header' }) }
  }
  const accessToken = authHeader.slice(7)

  let body: Record<string, unknown>
  try {
    body = JSON.parse(event.body ?? '{}') as Record<string, unknown>
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) }
  }

  const { token, wowGuildId, region, realmSlug } = body

  if (typeof token !== 'string' || typeof wowGuildId !== 'string' ||
      typeof region !== 'string' || typeof realmSlug !== 'string') {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields: token, wowGuildId, region, realmSlug' }) }
  }

  const pendingResult = await docClient.send(new GetCommand({
    TableName: DISCORD_PENDING_TABLE_NAME,
    Key: { token },
  }))

  if (pendingResult.Item === undefined) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Setup link not found or already used.' }) }
  }

  const now = Math.floor(Date.now() / 1000)
  if ((pendingResult.Item.ttl as number) < now) {
    return { statusCode: 410, body: JSON.stringify({ error: 'Setup link has expired.' }) }
  }

  const { discordGuildId, channelId } = pendingResult.Item as { discordGuildId: string, channelId: string }

  const regionLower = region.toLowerCase()

  let profile: BlizzardProfile
  try {
    const profileRes = await fetch(
      `https://${regionLower}.api.blizzard.com/profile/user/wow?namespace=profile-${regionLower}&locale=en_US`,
      { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10000) },
    )
    if (!profileRes.ok) {
      console.log('discordSetup: Blizzard profile fetch failed', { status: profileRes.status })
      return { statusCode: 502, body: JSON.stringify({ error: 'Could not verify guild membership — Blizzard API is unavailable.' }) }
    }
    profile = await profileRes.json() as BlizzardProfile
  } catch (err) {
    console.error('discordSetup: Blizzard profile fetch threw', err)
    return { statusCode: 502, body: JSON.stringify({ error: 'Could not verify guild membership — Blizzard API is unavailable.' }) }
  }

  // Derive the guild slug from the wowGuildId and realmSlug.
  // wowGuildId format: "{region}-{realmSlug}-{guild name}"
  const prefix = `${regionLower}-${realmSlug.toLowerCase()}-`
  const guildNameRaw = wowGuildId.toLowerCase().startsWith(prefix)
    ? wowGuildId.toLowerCase().slice(prefix.length)
    : wowGuildId.toLowerCase().split('-').slice(2).join('-')
  const guildSlug = guildNameRaw.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  let roster: BlizzardGuildRoster
  try {
    const rosterRes = await fetch(
      `https://${regionLower}.api.blizzard.com/data/wow/guild/${realmSlug.toLowerCase()}/${guildSlug}/roster?namespace=profile-${regionLower}&locale=en_US`,
      { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10000) },
    )
    if (!rosterRes.ok) {
      console.log('discordSetup: Blizzard roster fetch failed', { status: rosterRes.status })
      return { statusCode: 502, body: JSON.stringify({ error: 'Could not verify guild membership — Blizzard API is unavailable.' }) }
    }
    roster = await rosterRes.json() as BlizzardGuildRoster
  } catch (err) {
    console.error('discordSetup: Blizzard roster fetch threw', err)
    return { statusCode: 502, body: JSON.stringify({ error: 'Could not verify guild membership — Blizzard API is unavailable.' }) }
  }

  const userCharNames = new Set(
    profile.wow_accounts.flatMap(a => a.characters).map(c => c.name.toLowerCase()),
  )
  const isInGuild = roster.members.some(m => userCharNames.has(m.character.name.toLowerCase()))

  if (!isInGuild) {
    console.log('discordSetup 403: user not in guild', { wowGuildId })
    return { statusCode: 403, body: JSON.stringify({ error: 'You are not a member of this guild.' }) }
  }

  await docClient.send(new PutCommand({
    TableName: DISCORD_CONFIG_TABLE_NAME,
    Item: {
      discordGuildId,
      sk: 'CONFIG',
      wowGuildId: wowGuildId.toLowerCase(),
      channelId,
      configuredAt: new Date().toISOString(),
      notificationsEnabled: true,
    },
  }))

  await docClient.send(new DeleteCommand({
    TableName: DISCORD_PENDING_TABLE_NAME,
    Key: { token },
  }))

  // Post confirmation to the Discord channel
  try {
    const guildDisplayName = guildNameRaw.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    const botToken = await getBotToken()
    const discordRes = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bot ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: `✅ Setup complete! This server will now receive key update notifications for **${guildDisplayName}**.`,
        }),
      },
    )
    if (!discordRes.ok) {
      console.error('discordSetup: failed to post confirmation', { status: discordRes.status })
    }
  } catch (err) {
    console.error('discordSetup: exception posting confirmation', err)
    // Config is already saved — don't fail the request
  }

  console.log('discordSetup 200: success', { discordGuildId, wowGuildId })
  return { statusCode: 200, body: JSON.stringify({ success: true, wowGuildId: wowGuildId.toLowerCase() }) }
}

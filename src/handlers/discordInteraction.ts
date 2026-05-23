import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { type APIGatewayProxyEventV2, type APIGatewayProxyResultV2 } from 'aws-lambda'
import { randomUUID } from 'crypto'
import { dungeonNames, getDungeonName } from '../../shared/dungeons'

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))

const DISCORD_CONFIG_TABLE_NAME = process.env.DISCORD_CONFIG_TABLE_NAME
if (DISCORD_CONFIG_TABLE_NAME === undefined) throw new Error('DISCORD_CONFIG_TABLE_NAME env var is required')

const DISCORD_PENDING_TABLE_NAME = process.env.DISCORD_PENDING_TABLE_NAME
if (DISCORD_PENDING_TABLE_NAME === undefined) throw new Error('DISCORD_PENDING_TABLE_NAME env var is required')

const TABLE_NAME = process.env.TABLE_NAME
if (TABLE_NAME === undefined) throw new Error('TABLE_NAME env var is required')

const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY
if (DISCORD_PUBLIC_KEY === undefined) throw new Error('DISCORD_PUBLIC_KEY env var is required')

const SITE_URL = process.env.SITE_URL
if (SITE_URL === undefined) throw new Error('SITE_URL env var is required')

async function verifyDiscordSignature (
  publicKey: string,
  signature: string,
  timestamp: string,
  rawBody: string,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    Buffer.from(publicKey, 'hex'),
    { name: 'Ed25519' },
    false,
    ['verify'],
  )
  return crypto.subtle.verify(
    'Ed25519',
    key,
    Buffer.from(signature, 'hex'),
    new TextEncoder().encode(timestamp + rawBody),
  )
}

function keyEmoji (level: number): string {
  if (level >= 15) return '🟠'
  if (level >= 13) return '🟣'
  if (level >= 10) return '🔵'
  if (level >= 6) return '🟢'
  return '⚪'
}

function ephemeral (content: string): object {
  return { type: 4, data: { content, flags: 64 } }
}

interface DiscordInteractionOption {
  name: string
  value: string | number
}

interface DiscordInteraction {
  type: number
  guild_id?: string
  channel_id?: string
  data?: {
    name: string
    options?: DiscordInteractionOption[]
  }
}

async function handleSetup (discordGuildId: string, channelId: string): Promise<object> {
  const token = randomUUID()
  const ttl = Math.floor(Date.now() / 1000) + 600

  await docClient.send(new PutCommand({
    TableName: DISCORD_PENDING_TABLE_NAME,
    Item: { token, discordGuildId, channelId, ttl },
  }))

  return ephemeral(
    `Click here to verify your WoW guild membership (link expires in 10 minutes):\n${SITE_URL}/discord-auth?token=${token}`,
  )
}

async function handleKeys (discordGuildId: string, options: DiscordInteractionOption[]): Promise<object> {
  const configResult = await docClient.send(new GetCommand({
    TableName: DISCORD_CONFIG_TABLE_NAME,
    Key: { discordGuildId, sk: 'CONFIG' },
  }))

  if (configResult.Item === undefined) {
    return ephemeral("This server hasn't been set up yet. Run `/setup` to get started.")
  }

  const wowGuildId = configResult.Item.wowGuildId as string

  const minLevel = options.find(o => o.name === 'min-level')?.value as number | undefined
  const maxLevel = options.find(o => o.name === 'max-level')?.value as number | undefined
  const dungeonName = options.find(o => o.name === 'dungeon')?.value as string | undefined

  let dungeonId: number | undefined
  if (dungeonName !== undefined) {
    const normalized = dungeonName.toLowerCase().replace(/[^a-z0-9]/g, '')
    const entry = Object.entries(dungeonNames).find(([, name]) =>
      name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(normalized),
    )
    if (entry === undefined) {
      const validNames = Object.values(dungeonNames).join(', ')
      return ephemeral(`Unknown dungeon "${dungeonName}". Valid dungeons: ${validNames}`)
    }
    dungeonId = Number(entry[0])
  }

  const filterParts: string[] = []
  const expressionValues: Record<string, number | string> = { ':guildId': wowGuildId }

  if (minLevel !== undefined) {
    filterParts.push('keyLevel >= :minLevel')
    expressionValues[':minLevel'] = minLevel
  }
  if (maxLevel !== undefined) {
    filterParts.push('keyLevel <= :maxLevel')
    expressionValues[':maxLevel'] = maxLevel
  }
  if (dungeonId !== undefined) {
    filterParts.push('dungeonId = :dungeonId')
    expressionValues[':dungeonId'] = dungeonId
  }

  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'guildId = :guildId',
    FilterExpression: filterParts.length > 0 ? filterParts.join(' AND ') : undefined,
    ExpressionAttributeValues: expressionValues,
  }))

  const allItems = result.Items ?? []
  const sorted = [...allItems].sort((a, b) => (b.keyLevel as number) - (a.keyLevel as number))
  const keys = sorted.slice(0, 25)

  // Extract readable guild name from the last segment(s) of the wowGuildId
  const guildDisplayName = wowGuildId.split('-').slice(2).join(' ')

  if (keys.length === 0) {
    return {
      type: 4,
      data: {
        embeds: [{
          title: `Mythic+ Keys — ${guildDisplayName}`,
          description: 'No keys found for this guild.',
          color: 16750848,
          footer: { text: 'via Key Coord' },
          timestamp: new Date().toISOString(),
        }],
        flags: 64,
      },
    }
  }

  const fields = keys.map(k => ({
    name: k.characterName as string,
    value: `${keyEmoji(k.keyLevel as number)} +${k.keyLevel} ${getDungeonName(k.dungeonId as number)}`,
    inline: true,
  }))

  const footerText = allItems.length > 25
    ? `Showing top 25 of ${allItems.length} keys · via Key Coord`
    : 'via Key Coord'

  return {
    type: 4,
    data: {
      embeds: [{
        title: `Mythic+ Keys — ${guildDisplayName}`,
        color: 16750848,
        fields,
        footer: { text: footerText },
        timestamp: new Date().toISOString(),
      }],
      flags: 64,
    },
  }
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const signature = event.headers['x-signature-ed25519'] ?? ''
  const timestamp = event.headers['x-signature-timestamp'] ?? ''
  const rawBody = event.isBase64Encoded === true
    ? Buffer.from(event.body ?? '', 'base64').toString('utf-8')
    : (event.body ?? '')

  const valid = await verifyDiscordSignature(DISCORD_PUBLIC_KEY, signature, timestamp, rawBody)
  if (!valid) {
    return { statusCode: 401, body: 'Invalid request signature' }
  }

  const payload = JSON.parse(rawBody) as DiscordInteraction

  if (payload.type === 1) {
    return { statusCode: 200, body: JSON.stringify({ type: 1 }) }
  }

  if (payload.type === 2) {
    const commandName = payload.data?.name
    const guildId = payload.guild_id
    const channelId = payload.channel_id
    const options = payload.data?.options ?? []

    if (guildId === undefined) {
      return { statusCode: 200, body: JSON.stringify(ephemeral('This command must be used in a Discord server.')) }
    }

    try {
      let response: object
      if (commandName === 'setup') {
        if (channelId === undefined) {
          return { statusCode: 200, body: JSON.stringify(ephemeral('Could not determine channel ID.')) }
        }
        response = await handleSetup(guildId, channelId)
      } else if (commandName === 'keys') {
        response = await handleKeys(guildId, options)
      } else {
        return { statusCode: 200, body: JSON.stringify(ephemeral('Unknown command.')) }
      }
      return { statusCode: 200, body: JSON.stringify(response) }
    } catch (err) {
      console.error('discordInteraction error', err)
      return { statusCode: 200, body: JSON.stringify(ephemeral('Something went wrong. Please try again.')) }
    }
  }

  return { statusCode: 200, body: JSON.stringify({ type: 1 }) }
}

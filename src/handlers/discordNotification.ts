import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb'
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'
import { type DynamoDBStreamEvent } from 'aws-lambda'
import { getDungeonName } from '../../shared/dungeons'

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))
const secretsClient = new SecretsManagerClient({})

const DISCORD_CONFIG_TABLE_NAME = process.env.DISCORD_CONFIG_TABLE_NAME
if (DISCORD_CONFIG_TABLE_NAME === undefined) throw new Error('DISCORD_CONFIG_TABLE_NAME env var is required')

const DISCORD_SECRET_NAME = process.env.DISCORD_SECRET_NAME
if (DISCORD_SECRET_NAME === undefined) throw new Error('DISCORD_SECRET_NAME env var is required')

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

function keyEmoji (level: number): string {
  if (level >= 15) return '🟠'
  if (level >= 13) return '🟣'
  if (level >= 10) return '🔵'
  if (level >= 6) return '🟢'
  return '⚪'
}

export const handler = async (event: DynamoDBStreamEvent): Promise<void> => {
  for (const record of event.Records) {
    if (record.eventName === 'REMOVE') continue

    const image = record.dynamodb?.NewImage
    if (image === undefined) continue

    const guildId = image.guildId?.S
    const characterName = image.characterName?.S
    const dungeonId = Number(image.dungeonId?.N)
    const keyLevel = Number(image.keyLevel?.N)
    const updatedAt = image.updatedAt?.S ?? new Date().toISOString()

    if (guildId === undefined || characterName === undefined || isNaN(dungeonId) || isNaN(keyLevel)) {
      console.log('discordNotification: skipping record with missing fields')
      continue
    }

    let channelId: string | undefined
    try {
      const configResult = await docClient.send(new QueryCommand({
        TableName: DISCORD_CONFIG_TABLE_NAME,
        IndexName: 'wowGuildId-index',
        KeyConditionExpression: 'wowGuildId = :guildId',
        ExpressionAttributeValues: { ':guildId': guildId },
      }))

      const config = configResult.Items?.[0]
      if (config === undefined || config.notificationsEnabled === false) {
        console.log('discordNotification: no config or notifications disabled', { guildId })
        continue
      }
      channelId = config.channelId as string
    } catch (err) {
      console.error('discordNotification: failed to query config table', err)
      continue
    }

    try {
      const botToken = await getBotToken()
      const dungeonName = getDungeonName(dungeonId)

      const res = await fetch(
        `https://discord.com/api/v10/channels/${channelId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bot ${botToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            embeds: [{
              description: `**${characterName}** now holds a **${keyEmoji(keyLevel)} +${keyLevel} ${dungeonName}**`,
              color: 16750848,
              fields: [
                { name: 'Character', value: characterName, inline: true },
                { name: 'Dungeon', value: dungeonName, inline: true },
                { name: 'Level', value: `+${keyLevel}`, inline: true },
              ],
              timestamp: updatedAt,
              footer: { text: 'via Key Coord' },
            }],
          }),
        },
      )

      if (res.status === 429) {
        const rateLimitData = await res.json() as { retry_after?: number }
        console.warn('discordNotification: rate limited', { retryAfter: rateLimitData.retry_after, guildId })
      } else if (!res.ok) {
        const body = await res.text()
        console.error('discordNotification: Discord API error', { status: res.status, body, guildId })
      } else {
        console.log('discordNotification: sent', { guildId, characterName, keyLevel, dungeonName })
      }
    } catch (err) {
      console.error('discordNotification: failed to post to Discord', err)
    }
  }
}

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'
import { type APIGatewayProxyEventV2, type APIGatewayProxyResultV2 } from 'aws-lambda'

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))

const ONE_WEEK_SECONDS = 7 * 24 * 60 * 60

const TABLE_NAME = process.env.TABLE_NAME
if (TABLE_NAME === undefined) throw new Error('TABLE_NAME env var is required')

interface BlizzardProfile {
  wow_accounts: Array<{ characters: Array<{ name: string, realm: { slug: string } }> }>
}

async function verifyCharacterOwnership (
  accessToken: string,
  region: string,
  characterName: string,
  realmSlug: string,
): Promise<boolean> {
  const res = await fetch(
    `https://${region}.api.blizzard.com/profile/user/wow?namespace=profile-${region}&locale=en_US`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!res.ok) return false
  const profile = await res.json() as BlizzardProfile
  const chars = profile.wow_accounts.flatMap(a => a.characters)
  return chars.some(
    c => c.name.toLowerCase() === characterName.toLowerCase() &&
         c.realm.slug === realmSlug,
  )
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const { guildId, characterName } = event.pathParameters ?? {}

  if (guildId === undefined || characterName === undefined) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing guildId or characterName' }) }
  }

  const normalizedGuildId = guildId.toLowerCase()

  const authHeader = event.headers.authorization
  if (authHeader === undefined || !authHeader.startsWith('Bearer ')) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Missing or invalid Authorization header' }) }
  }
  const accessToken = authHeader.slice(7)

  const body = JSON.parse(event.body ?? '{}')
  const { dungeonId, keyLevel, region, realmSlug } = body

  if (dungeonId === undefined || keyLevel === undefined) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing dungeonId or keyLevel' }) }
  }

  if (typeof keyLevel !== 'number' || typeof dungeonId !== 'number') {
    return { statusCode: 400, body: JSON.stringify({ error: 'dungeonId and keyLevel must be numbers' }) }
  }

  if (typeof region !== 'string' || typeof realmSlug !== 'string') {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing region or realmSlug' }) }
  }

  let owned: boolean
  try {
    owned = await verifyCharacterOwnership(accessToken, region.toLowerCase(), characterName, realmSlug)
  } catch {
    return { statusCode: 502, body: JSON.stringify({ error: 'Failed to verify character ownership' }) }
  }

  if (!owned) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Character does not belong to the authenticated user' }) }
  }

  const now = Math.floor(Date.now() / 1000)

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      guildId: normalizedGuildId,
      characterName,
      dungeonId,
      keyLevel,
      updatedAt: new Date(now * 1000).toISOString(),
      ttl: now + ONE_WEEK_SECONDS,
    },
  }))

  return { statusCode: 200, body: JSON.stringify({ success: true }) }
}

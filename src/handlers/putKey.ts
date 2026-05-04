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
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10000),
    },
  )
  console.log('blizzard profile response', { status: res.status, ok: res.ok })
  if (!res.ok) return false
  const profile = await res.json() as BlizzardProfile
  const chars = profile.wow_accounts.flatMap(a => a.characters)
  return chars.some(
    c => c.name.toLowerCase() === characterName.toLowerCase() &&
         c.realm.slug === realmSlug,
  )
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  console.log('putKey invoked', { path: event.rawPath, method: event.requestContext.http.method })

  const { guildId, characterName } = event.pathParameters ?? {}

  if (guildId === undefined || characterName === undefined) {
    console.log('putKey 400: missing path params', { guildId, characterName })
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing guildId or characterName' }) }
  }

  const normalizedGuildId = guildId.toLowerCase()

  const authHeader = event.headers.authorization
  if (authHeader === undefined || !authHeader.startsWith('Bearer ')) {
    console.log('putKey 401: missing or invalid auth header')
    return { statusCode: 401, body: JSON.stringify({ error: 'Missing or invalid Authorization header' }) }
  }
  const accessToken = authHeader.slice(7)

  let body: Record<string, unknown>
  try {
    body = JSON.parse(event.body ?? '{}') as Record<string, unknown>
  } catch (err) {
    console.error('putKey 400: failed to parse body', err)
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) }
  }
  const { dungeonId, keyLevel, region, realmSlug } = body

  if (dungeonId === undefined || keyLevel === undefined) {
    console.log('putKey 400: missing dungeonId or keyLevel')
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing dungeonId or keyLevel' }) }
  }

  if (typeof keyLevel !== 'number' || typeof dungeonId !== 'number') {
    console.log('putKey 400: dungeonId or keyLevel not numbers', { dungeonId, keyLevel })
    return { statusCode: 400, body: JSON.stringify({ error: 'dungeonId and keyLevel must be numbers' }) }
  }

  if (typeof region !== 'string' || typeof realmSlug !== 'string') {
    console.log('putKey 400: missing region or realmSlug', { region, realmSlug })
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing region or realmSlug' }) }
  }

  console.log('putKey verifying ownership', { normalizedGuildId, characterName, region, realmSlug })

  let owned: boolean
  try {
    owned = await verifyCharacterOwnership(accessToken, region.toLowerCase(), characterName, realmSlug)
  } catch (err) {
    console.error('putKey 502: ownership verification threw', err)
    return { statusCode: 502, body: JSON.stringify({ error: 'Failed to verify character ownership' }) }
  }

  if (!owned) {
    console.log('putKey 403: character not owned', { characterName, realmSlug })
    return { statusCode: 403, body: JSON.stringify({ error: 'Character does not belong to the authenticated user' }) }
  }

  console.log('putKey ownership verified, writing to DynamoDB', { normalizedGuildId, characterName })

  const now = Math.floor(Date.now() / 1000)

  try {
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
  } catch (err) {
    console.error('putKey 500: DynamoDB write failed', err)
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to save key' }) }
  }

  console.log('putKey 200: success', { normalizedGuildId, characterName })
  return { statusCode: 200, body: JSON.stringify({ success: true }) }
}

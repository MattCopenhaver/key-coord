local WEBSITE_URL = "https://d2z773buu8dmrt.cloudfront.net"

local popup

local function EnsurePopup()
  if popup then return end

  popup = CreateFrame("Frame", "KeyCoordFrame", UIParent, "BasicFrameTemplateWithInset")
  popup:SetSize(540, 120)
  popup:SetPoint("CENTER")
  popup:SetMovable(true)
  popup:EnableMouse(true)
  popup:RegisterForDrag("LeftButton")
  popup:SetScript("OnDragStart", popup.StartMoving)
  popup:SetScript("OnDragStop", popup.StopMovingOrSizing)
  popup:Hide()

  popup.TitleText:SetText("KeyCoord - Submit Your Key")

  local label = popup:CreateFontString(nil, "OVERLAY", "GameFontNormal")
  label:SetPoint("TOPLEFT", popup.Inset, "TOPLEFT", 8, -10)
  label:SetText("Copy this link and open it in your browser:")

  local editBox = CreateFrame("EditBox", nil, popup, "InputBoxTemplate")
  editBox:SetSize(508, 24)
  editBox:SetPoint("TOPLEFT", label, "BOTTOMLEFT", 0, -8)
  editBox:SetAutoFocus(false)
  editBox:SetScript("OnEscapePressed", function() popup:Hide() end)
  popup.editBox = editBox
end

local function toSlug(name)
  return name:lower():gsub("[%s']+", "-")
end

local function urlEncode(s)
  return s:gsub("([^%w%-_%.~])", function(c)
    return string.format("%%%02X", string.byte(c))
  end)
end

local function ShowKeystonePopup()
  local level = C_MythicPlus.GetOwnedKeystoneLevel()
  local mapID = C_MythicPlus.GetOwnedKeystoneChallengeMapID()

  if not level or not mapID then
    print("|cffff9900KeyCoord:|r No keystone found. Make sure you have a Mythic+ key in your bags.")
    return
  end

  local characterName = UnitName("player")
  local region = GetCurrentRegionName():lower()
  local realmSlug = toSlug(GetNormalizedRealmName())

  local guildName, _, _, guildRealm = GetGuildInfo("player")
  if not guildName then
    print("|cffff9900KeyCoord:|r You must be in a guild to use KeyCoord.")
    return
  end
  local guildRealmSlug = toSlug(guildRealm ~= "" and guildRealm or GetNormalizedRealmName())

  local params = table.concat({
    "characterName=" .. urlEncode(characterName),
    "region=" .. region,
    "realm=" .. realmSlug,
    "guildRealm=" .. guildRealmSlug,
    "guild=" .. urlEncode(guildName),
    "dungeonId=" .. mapID,
    "keyLevel=" .. level,
  }, "&")

  local url = WEBSITE_URL .. "/?" .. params

  EnsurePopup()
  popup.editBox:SetText(url)
  popup.editBox:HighlightText()
  popup:Show()
  popup.editBox:SetFocus()
end

local frame = CreateFrame("Frame")
frame:RegisterEvent("PLAYER_LOGIN")
frame:SetScript("OnEvent", function(self, event)
  if event == "PLAYER_LOGIN" then
    C_MythicPlus.RequestOwnedKeystoneInfo()
    print("|cffff9900KeyCoord:|r Type /keycoord or /kc to submit your Mythic+ key.")
  end
end)

SLASH_KEYCOORD1 = "/keycoord"
SLASH_KEYCOORD2 = "/kc"
SlashCmdList["KEYCOORD"] = ShowKeystonePopup

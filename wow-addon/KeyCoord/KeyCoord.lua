local WEBSITE_URL = "https://d2z773buu8dmrt.cloudfront.net"

-- Website color palette
local C = {
  slate950 = { 0.008, 0.024, 0.090 },
  slate900 = { 0.059, 0.090, 0.165 },
  slate800 = { 0.118, 0.161, 0.231 },
  slate700 = { 0.200, 0.255, 0.333 },
  slate400 = { 0.580, 0.639, 0.722 },
  amber400 = { 0.984, 0.749, 0.141 },
  amber500 = { 0.961, 0.620, 0.043 },
  amber600 = { 0.851, 0.467, 0.024 },
  white    = { 1.000, 1.000, 1.000 },
}

local popup
local cachedLevel = nil
local cachedMapID = nil
local loginTime = 0
local LOGIN_SETTLE = 5
local frame = CreateFrame("Frame")

local function solidTex(parent, r, g, b, a, sublevel)
  local t = parent:CreateTexture(nil, "BACKGROUND", nil, sublevel or 0)
  t:SetColorTexture(r, g, b, a or 1)
  return t
end

local function EnsurePopup()
  if popup then return end

  popup = CreateFrame("Frame", "KeyCoordFrame", UIParent)
  popup:SetSize(540, 148)
  popup:SetPoint("CENTER")
  popup:SetMovable(true)
  popup:EnableMouse(true)
  popup:RegisterForDrag("LeftButton")
  popup:SetScript("OnDragStart", popup.StartMoving)
  popup:SetScript("OnDragStop", popup.StopMovingOrSizing)
  popup:SetFrameStrata("DIALOG")
  popup:Hide()

  -- Outer border (slate-800)
  local border = solidTex(popup, C.slate800[1], C.slate800[2], C.slate800[3], 1, -1)
  border:SetAllPoints()

  -- Main background (slate-950), inset 1px to show border
  local bg = solidTex(popup, C.slate950[1], C.slate950[2], C.slate950[3], 0.97, 0)
  bg:SetPoint("TOPLEFT", popup, "TOPLEFT", 1, -1)
  bg:SetPoint("BOTTOMRIGHT", popup, "BOTTOMRIGHT", -1, 1)

  -- Title "Key Coord" (amber-400)
  local title = popup:CreateFontString(nil, "OVERLAY", "GameFontNormalLarge")
  title:SetPoint("TOPLEFT", popup, "TOPLEFT", 14, -12)
  title:SetText("Key Coord")
  title:SetTextColor(C.amber400[1], C.amber400[2], C.amber400[3])

  -- Close button (×)
  local closeBtn = CreateFrame("Button", nil, popup)
  closeBtn:SetSize(22, 22)
  closeBtn:SetPoint("TOPRIGHT", popup, "TOPRIGHT", -10, -9)
  local closeTxt = closeBtn:CreateFontString(nil, "OVERLAY", "GameFontNormalLarge")
  closeTxt:SetAllPoints()
  closeTxt:SetText("×")
  closeTxt:SetTextColor(C.slate400[1], C.slate400[2], C.slate400[3])
  closeBtn:SetScript("OnEnter", function() closeTxt:SetTextColor(C.white[1], C.white[2], C.white[3]) end)
  closeBtn:SetScript("OnLeave", function() closeTxt:SetTextColor(C.slate400[1], C.slate400[2], C.slate400[3]) end)
  closeBtn:SetScript("OnClick", function() popup:Hide() end)

  -- Separator line (slate-800)
  local sep = solidTex(popup, C.slate800[1], C.slate800[2], C.slate800[3], 1, 1)
  sep:SetPoint("TOPLEFT",  popup, "TOPLEFT",  1, -34)
  sep:SetPoint("TOPRIGHT", popup, "TOPRIGHT", -1, -34)
  sep:SetHeight(1)

  -- Label (slate-400)
  local label = popup:CreateFontString(nil, "OVERLAY", "GameFontNormal")
  label:SetPoint("TOPLEFT", popup, "TOPLEFT", 14, -46)
  label:SetText("Open in your browser to submit your key:")
  label:SetTextColor(C.slate400[1], C.slate400[2], C.slate400[3])

  -- Edit box container — border (slate-700) + background (slate-900)
  local editWrap = CreateFrame("Frame", nil, popup)
  editWrap:SetHeight(30)
  editWrap:SetPoint("TOPLEFT",  label, "BOTTOMLEFT",  0,   -7)
  editWrap:SetPoint("TOPRIGHT", popup, "TOPRIGHT",   -14,   0)

  local editBorder = solidTex(editWrap, C.slate700[1], C.slate700[2], C.slate700[3], 1, -1)
  editBorder:SetAllPoints()

  local editBg = solidTex(editWrap, C.slate900[1], C.slate900[2], C.slate900[3], 1, 0)
  editBg:SetPoint("TOPLEFT",     editWrap, "TOPLEFT",     1, -1)
  editBg:SetPoint("BOTTOMRIGHT", editWrap, "BOTTOMRIGHT", -1,  1)

  local editBox = CreateFrame("EditBox", nil, editWrap)
  editBox:SetPoint("TOPLEFT",     editWrap, "TOPLEFT",      8, -3)
  editBox:SetPoint("BOTTOMRIGHT", editWrap, "BOTTOMRIGHT", -8,  3)
  editBox:SetAutoFocus(false)
  editBox:SetFontObject("GameFontNormal")
  editBox:SetTextColor(C.white[1], C.white[2], C.white[3])
  editBox:SetScript("OnEscapePressed", function() popup:Hide() end)
  popup.editBox = editBox

  -- Copy button
  local copyBtn = CreateFrame("Button", nil, popup)
  copyBtn:SetSize(110, 28)
  copyBtn:SetPoint("TOPRIGHT", editWrap, "BOTTOMRIGHT", 0, -10)

  -- Border (slate-700)
  local copyBtnBorder = solidTex(copyBtn, C.slate700[1], C.slate700[2], C.slate700[3], 1, -1)
  copyBtnBorder:SetAllPoints()
  -- Background (slate-900), inset 1px to show border
  local copyBtnBg = solidTex(copyBtn, C.slate900[1], C.slate900[2], C.slate900[3], 1, 0)
  copyBtnBg:SetPoint("TOPLEFT",     copyBtn, "TOPLEFT",      1, -1)
  copyBtnBg:SetPoint("BOTTOMRIGHT", copyBtn, "BOTTOMRIGHT", -1,  1)

  local copyHint = IsMacClient() and "Press Cmd+C" or "Press Ctrl+C"

  local copyBtnTxt = copyBtn:CreateFontString(nil, "OVERLAY", "GameFontNormal")
  copyBtnTxt:SetAllPoints()
  copyBtnTxt:SetText("Select Link")
  copyBtnTxt:SetTextColor(C.slate400[1], C.slate400[2], C.slate400[3])

  copyBtn:SetScript("OnEnter", function()
    copyBtnBorder:SetColorTexture(C.slate400[1], C.slate400[2], C.slate400[3], 1)
    copyBtnTxt:SetTextColor(C.white[1], C.white[2], C.white[3])
  end)
  copyBtn:SetScript("OnLeave", function()
    copyBtnBorder:SetColorTexture(C.slate700[1], C.slate700[2], C.slate700[3], 1)
    copyBtnTxt:SetTextColor(C.slate400[1], C.slate400[2], C.slate400[3])
  end)
  copyBtn:SetScript("OnClick", function()
    popup.editBox:SetFocus()
    popup.editBox:HighlightText()
    copyBtnTxt:SetText(copyHint)
    C_Timer.After(3, function() copyBtnTxt:SetText("Select Link") end)
  end)

  editBox:SetScript("OnCursorChanged", function(self)
    if self:HasFocus() then
      self:HighlightText()
    end
  end)

  editBox:SetScript("OnKeyDown", function(self, key)
    if key == "C" and (IsMetaKeyDown() or IsControlKeyDown()) then
      copyBtnTxt:SetText("Copied!")
      UIFrameFadeOut(popup, 0.5, 1, 0)
      C_Timer.After(0.5, function()
        popup:Hide()
        popup:SetAlpha(1)
      end)
    end
  end)
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
  popup:Show()
end

local function CheckAndUpdateKeystone()
  local newLevel = C_MythicPlus.GetOwnedKeystoneLevel()
  local newMapID = C_MythicPlus.GetOwnedKeystoneChallengeMapID()
  if newLevel == nil then return end
  local changed = newLevel ~= cachedLevel or newMapID ~= cachedMapID
  cachedLevel = newLevel
  cachedMapID = newMapID
  if changed and GetTime() - loginTime > LOGIN_SETTLE then
    ShowKeystonePopup()
  end
end

frame:RegisterEvent("PLAYER_LOGIN")
frame:RegisterEvent("CHALLENGE_MODE_COMPLETED")
frame:RegisterEvent("MYTHIC_PLUS_CURRENT_AFFIX_UPDATE")
frame:RegisterEvent("BAG_UPDATE_DELAYED")

frame:SetScript("OnEvent", function(self, event)
  if event == "PLAYER_LOGIN" then
    loginTime = GetTime()
    if C_MythicPlus.RequestOwnedKeystoneInfo then C_MythicPlus.RequestOwnedKeystoneInfo() end
    C_Timer.After(1, function()
      CheckAndUpdateKeystone()  -- settle period blocks any popup
      print("|cffff9900KeyCoord:|r Type /keycoord or /kc to submit your Mythic+ key.")
    end)

  elseif event == "CHALLENGE_MODE_COMPLETED" then
    if C_MythicPlus.RequestOwnedKeystoneInfo then C_MythicPlus.RequestOwnedKeystoneInfo() end
    C_Timer.After(1, function()
      CheckAndUpdateKeystone()
    end)

  elseif event == "MYTHIC_PLUS_CURRENT_AFFIX_UPDATE" then
    C_Timer.After(1, function()
      CheckAndUpdateKeystone()
    end)

  elseif event == "BAG_UPDATE_DELAYED" then
    if C_MythicPlus.RequestOwnedKeystoneInfo then C_MythicPlus.RequestOwnedKeystoneInfo() end
    C_Timer.After(1, function()
      CheckAndUpdateKeystone()
    end)
  end
end)

SLASH_KEYCOORD1 = "/keycoord"
SLASH_KEYCOORD2 = "/kc"
SlashCmdList["KEYCOORD"] = ShowKeystonePopup

SLASH_KCTEST1 = "/kctest"
SlashCmdList["KCTEST"] = function()
  cachedLevel = nil
  cachedMapID = nil
  print("|cffff9900KeyCoord:|r Cache cleared — next bag update will trigger popup if a key is found.")
end

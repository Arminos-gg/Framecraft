-- Built with Framecraft (prototype)
-- Paste this into Roblox Studio's command bar and press Enter.
-- It creates the UI in StarterGui, where you can keep editing it.
local StarterGui = game:GetService("StarterGui")

-- MainMenu (ScreenGui)
local mainMenu = Instance.new("ScreenGui")
mainMenu.Name = "MainMenu"
mainMenu.IgnoreGuiInset = true
mainMenu.ResetOnSpawn = false
mainMenu.ZIndexBehavior = Enum.ZIndexBehavior.Sibling

-- Coins (Frame)
local coins = Instance.new("Frame")
coins.Name = "Coins"
coins.AnchorPoint = Vector2.new(1, 0)
coins.Position = UDim2.new(1, -20, 0, 20)
coins.Size = UDim2.fromOffset(176, 52)
coins.BackgroundColor3 = Color3.fromRGB(22, 24, 38)
coins.BackgroundTransparency = 0.12
coins.BorderSizePixel = 0
local coinsCorner = Instance.new("UICorner")
coinsCorner.CornerRadius = UDim.new(0.5, 0)
coinsCorner.Parent = coins
local coinsStroke = Instance.new("UIStroke")
coinsStroke.Color = Color3.fromRGB(255, 204, 77)
coinsStroke.Thickness = 2
coinsStroke.Transparency = 0.25
coinsStroke.Parent = coins

-- CoinIcon (Frame)
local coinIcon = Instance.new("Frame")
coinIcon.Name = "CoinIcon"
coinIcon.AnchorPoint = Vector2.new(0, 0.5)
coinIcon.Position = UDim2.new(0, 10, 0.5, 0)
coinIcon.Size = UDim2.fromOffset(34, 34)
coinIcon.BackgroundColor3 = Color3.fromRGB(255, 201, 60)
coinIcon.BorderSizePixel = 0
local coinIconCorner = Instance.new("UICorner")
coinIconCorner.CornerRadius = UDim.new(0.5, 0)
coinIconCorner.Parent = coinIcon
local coinIconGradient = Instance.new("UIGradient")
coinIconGradient.Color = ColorSequence.new(Color3.fromRGB(255, 255, 255), Color3.fromRGB(222, 158, 30))
coinIconGradient.Rotation = 90
coinIconGradient.Parent = coinIcon
local coinIconStroke = Instance.new("UIStroke")
coinIconStroke.Color = Color3.fromRGB(168, 104, 8)
coinIconStroke.Thickness = 2
coinIconStroke.Parent = coinIcon
coinIcon.Parent = coins

-- Amount (TextLabel)
local amount = Instance.new("TextLabel")
amount.Name = "Amount"
amount.Position = UDim2.fromOffset(54, 0)
amount.Size = UDim2.new(1, -68, 1, 0)
amount.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
amount.BackgroundTransparency = 1
amount.BorderSizePixel = 0
amount.Font = Enum.Font.GothamBold
amount.Text = "12,450"
amount.TextColor3 = Color3.fromRGB(255, 255, 255)
amount.TextSize = 24
amount.TextXAlignment = Enum.TextXAlignment.Left
amount.Parent = coins
coins.Parent = mainMenu

-- Panel (Frame)
local panel = Instance.new("Frame")
panel.Name = "Panel"
panel.AnchorPoint = Vector2.new(0.5, 0.5)
panel.Position = UDim2.fromScale(0.5, 0.5)
panel.Size = UDim2.fromScale(0.34, 0.72)
panel.BackgroundColor3 = Color3.fromRGB(19, 21, 33)
panel.BackgroundTransparency = 0.06
panel.BorderSizePixel = 0
local panelCorner = Instance.new("UICorner")
panelCorner.CornerRadius = UDim.new(0, 18)
panelCorner.Parent = panel
local panelStroke = Instance.new("UIStroke")
panelStroke.Color = Color3.fromRGB(255, 255, 255)
panelStroke.Thickness = 1.5
panelStroke.Transparency = 0.84
panelStroke.Parent = panel
local panelPadding = Instance.new("UIPadding")
panelPadding.PaddingTop = UDim.new(0, 24)
panelPadding.PaddingBottom = UDim.new(0, 24)
panelPadding.PaddingLeft = UDim.new(0, 24)
panelPadding.PaddingRight = UDim.new(0, 24)
panelPadding.Parent = panel

-- Title (TextLabel)
local title = Instance.new("TextLabel")
title.Name = "Title"
title.Size = UDim2.fromScale(1, 0.2)
title.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
title.BackgroundTransparency = 1
title.BorderSizePixel = 0
title.Font = Enum.Font.LuckiestGuy
title.Text = "SKY RAIDERS"
title.TextColor3 = Color3.fromRGB(255, 214, 92)
title.TextSize = 14
title.TextScaled = true
local titleStroke = Instance.new("UIStroke")
titleStroke.Color = Color3.fromRGB(92, 44, 0)
titleStroke.Thickness = 3
titleStroke.Parent = title
title.Parent = panel

-- Subtitle (TextLabel)
local subtitle = Instance.new("TextLabel")
subtitle.Name = "Subtitle"
subtitle.Position = UDim2.new(0, 0, 0.2, 6)
subtitle.Size = UDim2.fromScale(1, 0.05)
subtitle.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
subtitle.BackgroundTransparency = 1
subtitle.BorderSizePixel = 0
subtitle.Font = Enum.Font.GothamMedium
subtitle.Text = "Season 3 · Storm Front"
subtitle.TextColor3 = Color3.fromRGB(168, 176, 204)
subtitle.TextSize = 14
subtitle.TextScaled = true
subtitle.Parent = panel

-- Buttons (Frame)
local buttons = Instance.new("Frame")
buttons.Name = "Buttons"
buttons.AnchorPoint = Vector2.new(0, 1)
buttons.Position = UDim2.fromScale(0, 1)
buttons.Size = UDim2.fromScale(1, 0.62)
buttons.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
buttons.BackgroundTransparency = 1
buttons.BorderSizePixel = 0
local buttonsList = Instance.new("UIListLayout")
buttonsList.FillDirection = Enum.FillDirection.Vertical
buttonsList.HorizontalAlignment = Enum.HorizontalAlignment.Center
buttonsList.VerticalAlignment = Enum.VerticalAlignment.Bottom
buttonsList.Padding = UDim.new(0.05, 0)
buttonsList.SortOrder = Enum.SortOrder.LayoutOrder
buttonsList.Parent = buttons

-- PlayButton (TextButton)
local playButton = Instance.new("TextButton")
playButton.Name = "PlayButton"
playButton.Size = UDim2.fromScale(1, 0.28)
playButton.BackgroundColor3 = Color3.fromRGB(72, 199, 102)
playButton.BorderSizePixel = 0
playButton.LayoutOrder = 1
playButton.Font = Enum.Font.GothamBlack
playButton.Text = "PLAY"
playButton.TextColor3 = Color3.fromRGB(255, 255, 255)
playButton.TextSize = 14
playButton.TextScaled = true
local playButtonCorner = Instance.new("UICorner")
playButtonCorner.CornerRadius = UDim.new(0, 12)
playButtonCorner.Parent = playButton
local playButtonPadding = Instance.new("UIPadding")
playButtonPadding.PaddingTop = UDim.new(0.26, 0)
playButtonPadding.PaddingBottom = UDim.new(0.26, 0)
playButtonPadding.Parent = playButton
local playButtonGradient = Instance.new("UIGradient")
playButtonGradient.Color = ColorSequence.new(Color3.fromRGB(255, 255, 255), Color3.fromRGB(206, 212, 226))
playButtonGradient.Rotation = 90
playButtonGradient.Parent = playButton
playButton.Parent = buttons

-- ShopButton (TextButton)
local shopButton = Instance.new("TextButton")
shopButton.Name = "ShopButton"
shopButton.Size = UDim2.fromScale(1, 0.28)
shopButton.BackgroundColor3 = Color3.fromRGB(64, 132, 245)
shopButton.BorderSizePixel = 0
shopButton.LayoutOrder = 2
shopButton.Font = Enum.Font.GothamBlack
shopButton.Text = "SHOP"
shopButton.TextColor3 = Color3.fromRGB(255, 255, 255)
shopButton.TextSize = 14
shopButton.TextScaled = true
local shopButtonCorner = Instance.new("UICorner")
shopButtonCorner.CornerRadius = UDim.new(0, 12)
shopButtonCorner.Parent = shopButton
local shopButtonPadding = Instance.new("UIPadding")
shopButtonPadding.PaddingTop = UDim.new(0.26, 0)
shopButtonPadding.PaddingBottom = UDim.new(0.26, 0)
shopButtonPadding.Parent = shopButton
local shopButtonGradient = Instance.new("UIGradient")
shopButtonGradient.Color = ColorSequence.new(Color3.fromRGB(255, 255, 255), Color3.fromRGB(206, 212, 226))
shopButtonGradient.Rotation = 90
shopButtonGradient.Parent = shopButton
shopButton.Parent = buttons

-- SettingsButton (TextButton)
local settingsButton = Instance.new("TextButton")
settingsButton.Name = "SettingsButton"
settingsButton.Size = UDim2.fromScale(1, 0.28)
settingsButton.BackgroundColor3 = Color3.fromRGB(58, 63, 86)
settingsButton.BorderSizePixel = 0
settingsButton.LayoutOrder = 3
settingsButton.Font = Enum.Font.GothamBlack
settingsButton.Text = "SETTINGS"
settingsButton.TextColor3 = Color3.fromRGB(226, 230, 244)
settingsButton.TextSize = 14
settingsButton.TextScaled = true
local settingsButtonCorner = Instance.new("UICorner")
settingsButtonCorner.CornerRadius = UDim.new(0, 12)
settingsButtonCorner.Parent = settingsButton
local settingsButtonPadding = Instance.new("UIPadding")
settingsButtonPadding.PaddingTop = UDim.new(0.26, 0)
settingsButtonPadding.PaddingBottom = UDim.new(0.26, 0)
settingsButtonPadding.Parent = settingsButton
local settingsButtonGradient = Instance.new("UIGradient")
settingsButtonGradient.Color = ColorSequence.new(Color3.fromRGB(255, 255, 255), Color3.fromRGB(206, 212, 226))
settingsButtonGradient.Rotation = 90
settingsButtonGradient.Parent = settingsButton
settingsButton.Parent = buttons
buttons.Parent = panel
panel.Parent = mainMenu

-- Version (TextLabel)
local version = Instance.new("TextLabel")
version.Name = "Version"
version.AnchorPoint = Vector2.new(0, 1)
version.Position = UDim2.new(0, 18, 1, -14)
version.Size = UDim2.fromOffset(260, 20)
version.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
version.BackgroundTransparency = 1
version.BorderSizePixel = 0
version.Font = Enum.Font.SourceSans
version.Text = "v0.1 · made with Framecraft"
version.TextColor3 = Color3.fromRGB(255, 255, 255)
version.TextSize = 16
version.TextXAlignment = Enum.TextXAlignment.Left
version.TextTransparency = 0.3
version.Parent = mainMenu
mainMenu.Parent = StarterGui

-- Select the new UI so it shows up in the Explorer
game:GetService("Selection"):Set({ mainMenu })

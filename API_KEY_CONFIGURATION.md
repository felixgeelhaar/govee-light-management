# How to Configure Your Govee API Key

The API key is now stored securely in Stream Deck's global settings following Elgato's best practices. You configure it through the Toggle action's property inspector, and it's automatically shared with all other Govee actions.

## Configuration Steps

### Step 1: Add a Toggle Action
1. Open the **Stream Deck** application
2. Drag the **"Toggle On/Off"** action from the Govee Light Management category to any button
3. Click on the button to open its property inspector

### Step 2: Enter Your API Key
1. In the property inspector, you'll see an **"API Configuration"** section at the top
2. Enter your Govee API key in the password field
3. Click the eye icon (👁️) if you want to see the key while typing
4. The key is automatically saved after you stop typing (1 second delay)
5. You'll see the status indicator change from "Not Connected" to "Connected"

### Step 3: Verify Configuration
1. The API key is now stored securely and available to ALL Govee actions
2. Click the **"Discover Lights"** button to load your devices
3. Select a light from the dropdown
4. Click **"Test Light"** to verify the connection works

## Getting Your Govee API Key

If you don't have an API key yet:
1. Open the **Govee Home** app on your phone
2. Go to **Settings** → **About Us** → **Apply for API Key**
3. Follow the instructions to get your key
4. Copy the key and paste it in the global settings

## Security Features

✅ **Secure Storage**: API key is stored securely using Stream Deck's global settings
✅ **Single Configuration**: Set once in Toggle action, used by all Govee actions
✅ **Password Field**: Hidden by default with option to reveal
✅ **Auto-save**: Changes are saved automatically as you type

## How It Works

- The API key is configured in the **Toggle action's property inspector**
- It's stored in Stream Deck's global settings (shared across all actions)
- Other actions (Brightness, Color, Temperature) automatically use this global API key
- You only need to configure it once, in any Toggle action

## Using Other Actions

Once you've configured the API key in a Toggle action:
1. Add any other Govee action (Brightness, Color, Temperature)
2. They will automatically use the global API key
3. No need to re-enter the API key for each action

## Troubleshooting

If the API key isn't working:
1. Make sure you entered it correctly (use the eye icon to reveal it)
2. Verify you have internet connectivity
3. Click **"Test Light"** to verify the connection
4. Check that your Govee devices are online in the Govee Home app

## Need to Change Your API Key?

1. Open any Toggle action's property inspector
2. Replace the old API key with the new one
3. The change is automatically saved after 1 second
4. All actions will immediately use the new key
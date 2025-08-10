#!/bin/bash

# Function to update an action view file
update_view() {
  local file="$1"
  local basename=$(basename "$file" .vue)
  echo "Updating $basename..."
  
  # Create a temporary backup
  cp "$file" "$file.bak"
  
  # Read the file content
  content=$(cat "$file")
  
  # Add useFeedback import if not present
  if ! grep -q "useFeedback" "$file"; then
    content=$(echo "$content" | sed '/import { useApiConnection/a\
import { useFeedback } from "../composables/useFeedback";')
  fi
  
  # Add feedback composable if not present
  if ! grep -q "const feedback = useFeedback()" "$file"; then
    content=$(echo "$content" | sed '/const lightDiscovery = useLightDiscovery()/a\
const feedback = useFeedback();')
  fi
  
  # Remove status-related variables and computed properties
  content=$(echo "$content" | sed '/const statusMessage = ref/d')
  content=$(echo "$content" | sed '/const statusType = ref/d')
  content=$(echo "$content" | sed '/const statusIcon = computed/,/^});$/d')
  
  # Remove showStatus function
  content=$(echo "$content" | sed '/const showStatus = (/,/^};$/d')
  
  # Replace showStatus calls with feedback methods
  content=$(echo "$content" | sed 's/showStatus("Refreshing lights\.\.\.", "info")/feedback.showInfo("Refreshing lights...")/g')
  content=$(echo "$content" | sed 's/showStatus("Invalid light selection", "error")/feedback.showError("Invalid light selection")/g')
  content=$(echo "$content" | sed 's/showStatus("Testing light\.\.\.", "info", 0)/feedback.showInfo("Testing light...", "Sending command to light")/g')
  content=$(echo "$content" | sed 's/showStatus("Test timeout[^"]*", "warning")/feedback.showWarning("Test timeout", "Light may have still blinked")/g')
  content=$(echo "$content" | sed 's/showStatus("Failed to send test command", "error")/feedback.showError("Failed to send test command")/g')
  content=$(echo "$content" | sed 's/showStatus("API connected successfully", "success")/feedback.showSuccessToast("API connected successfully")/g')
  content=$(echo "$content" | sed 's/showStatus(`API connection failed: \${error}`, "error")/feedback.showError("API connection failed", error)/g')
  content=$(echo "$content" | sed 's/showStatus("Discovering lights\.\.\.", "info", 0)/feedback.showInfo("Discovering lights...", "Searching for Govee devices")/g')
  content=$(echo "$content" | sed 's/showStatus("No lights found[^"]*", "warning")/feedback.showWarning("No lights found", "Check connections and try again")/g')
  content=$(echo "$content" | sed 's/showStatus("Light discovery failed", "error")/feedback.showError("Light discovery failed")/g')
  
  # Remove the status field HTML section
  content=$(echo "$content" | sed '/<!-- Status field for notifications -->/,/<\/div>$/d' | sed 's/<\/section>$/&/')
  
  # Write the updated content back
  echo "$content" > "$file"
  
  echo "  ✓ Updated $basename"
}

# Update each view file
for file in /Users/felixgeelhaar/Developer/projects/govee-light-management/src/frontend/views/{BrightnessActionView,ColorActionView,WarmthActionView}.vue; do
  update_view "$file"
done

echo "All views updated!"
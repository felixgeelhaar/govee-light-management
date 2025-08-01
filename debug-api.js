#!/usr/bin/env node

/**
 * Debug script to test Govee API connectivity and device discovery
 * 
 * Usage: node debug-api.js YOUR_API_KEY
 */

import { GoveeClient } from '@felixgeelhaar/govee-api-client';

async function debugGoveeAPI() {
  const apiKey = process.argv[2];
  
  if (!apiKey) {
    console.error('Usage: node debug-api.js YOUR_API_KEY');
    process.exit(1);
  }

  console.log('🔍 Debugging Govee API Connection...');
  console.log('API Key:', apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4));
  
  try {
    const client = new GoveeClient({
      apiKey: apiKey,
      enableRetries: true,
      retryPolicy: 'production',
    });

    console.log('\n📡 Fetching all devices...');
    const allDevices = await client.getDevices();
    console.log(`Found ${allDevices.length} total devices:`);
    
    allDevices.forEach((device, index) => {
      console.log(`  ${index + 1}. ${device.deviceName}`);
      console.log(`     ID: ${device.deviceId}`);
      console.log(`     Model: ${device.model}`);
      console.log(`     Can Control: ${device.canControl ? device.canControl() : 'Unknown'}`);
      console.log('');
    });

    console.log('\n🎮 Fetching controllable devices...');
    const controllableDevices = await client.getControllableDevices();
    console.log(`Found ${controllableDevices.length} controllable devices:`);
    
    if (controllableDevices.length === 0) {
      console.log('❌ No controllable devices found. This might explain the 400 error.');
      console.log('   Make sure your devices are:');
      console.log('   - Online and connected to WiFi');
      console.log('   - Supported by the Govee API');
      console.log('   - Added to your Govee account');
      return;
    }

    // Test first controllable device
    const testDevice = controllableDevices[0];
    console.log(`\n🧪 Testing first controllable device: ${testDevice.deviceName}`);
    
    try {
      console.log('  📊 Getting device state...');
      const state = await client.getDeviceState(testDevice.deviceId, testDevice.model);
      console.log(`  State: ${state ? 'Retrieved successfully' : 'No state available'}`);
      
      if (state) {
        console.log(`    Online: ${state.isOnline()}`);
        console.log(`    Power: ${state.getPower() ? 'On' : 'Off'}`);
        
        if (state.getBrightness()) {
          console.log(`    Brightness: ${state.getBrightness().level}%`);
        }
        
        if (state.getColor()) {
          console.log(`    Color: ${state.getColor().toString()}`);
        }
      }
      
      // Test basic control if device is online
      if (state && state.isOnline()) {
        console.log('\n  🔧 Testing basic control (toggle power)...');
        const currentPower = state.getPower();
        
        if (currentPower) {
          console.log('  Turning device OFF...');
          await client.turnOff(testDevice.deviceId, testDevice.model);
        } else {
          console.log('  Turning device ON...');
          await client.turnOn(testDevice.deviceId, testDevice.model);
        }
        
        console.log('  ✅ Control test successful!');
        
        // Wait a moment then restore original state
        setTimeout(async () => {
          try {
            if (currentPower) {
              console.log('  Restoring device to ON state...');
              await client.turnOn(testDevice.deviceId, testDevice.model);
            } else {
              console.log('  Restoring device to OFF state...');
              await client.turnOff(testDevice.deviceId, testDevice.model);
            }
            console.log('  ✅ Device state restored!');
          } catch (error) {
            console.log('  ⚠️  Could not restore original state:', error.message);
          }
        }, 2000);
        
      } else {
        console.log('  ⚠️  Device is offline, skipping control test');
      }
      
    } catch (controlError) {
      console.log('  ❌ Control test failed:', controlError.message);
      
      if (controlError.message.includes('400')) {
        console.log('     This is the same 400 error you\'re seeing in the plugin!');
        console.log('     Possible causes:');
        console.log('     - Device doesn\'t support the requested operation');
        console.log('     - Device model/ID mismatch');
        console.log('     - Device firmware is outdated');
        console.log('     - Device is in a special mode (e.g., music mode)');
      }
    }

  } catch (error) {
    console.error('❌ API Error:', error.message);
    
    if (error.message.includes('401')) {
      console.log('   Your API key appears to be invalid or expired.');
      console.log('   Please check your Govee API key.');
    } else if (error.message.includes('429')) {
      console.log('   Rate limit exceeded. Wait a moment and try again.');
    }
  }
}

debugGoveeAPI().catch(console.error);
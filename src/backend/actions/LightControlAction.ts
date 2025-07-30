import {
	action,
	KeyDownEvent,
	SingletonAction,
	WillAppearEvent,
	type SendToPluginEvent,
	type JsonValue,
	streamDeck,
} from "@elgato/streamdeck";
import { GoveeLightRepository } from '../infrastructure/repositories/GoveeLightRepository';
import { LightControlService } from '../domain/services/LightControlService';
import { Light } from '../domain/entities/Light';
import { Brightness, ColorRgb, ColorTemperature } from '@felixgeelhaar/govee-api-client';

type LightControlSettings = {
	apiKey?: string;
	selectedDeviceId?: string;
	selectedModel?: string;
	selectedLightName?: string;
	controlMode?: 'toggle' | 'on' | 'off' | 'brightness' | 'color' | 'colorTemp';
	brightnessValue?: number;
	colorValue?: string; // hex color
	colorTempValue?: number; // Kelvin
};

/**
 * Stream Deck action for controlling individual Govee lights
 */
@action({ UUID: "com.felixgeelhaar.govee-light-management.lights" })
export class LightControlAction extends SingletonAction<LightControlSettings> {
	private lightRepository?: GoveeLightRepository;
	private lightControlService?: LightControlService;
	private currentLight?: Light;

	/**
	 * Initialize services when action appears
	 */
	override async onWillAppear(
		ev: WillAppearEvent<LightControlSettings>,
	): Promise<void> {
		const { settings } = ev.payload;
		
		if (settings.apiKey) {
			this.initializeServices(settings.apiKey);
		}

		// Set initial title based on configuration
		const title = this.getActionTitle(settings);
		await ev.action.setTitle(title);

		// Load current light if configured
		if (settings.selectedDeviceId && settings.selectedModel && this.lightRepository) {
			try {
				const foundLight = await this.lightRepository.findLight(
					settings.selectedDeviceId,
					settings.selectedModel
				);
				this.currentLight = foundLight || undefined;
				if (this.currentLight) {
					// Refresh light state
					await this.lightRepository.getLightState(this.currentLight);
					await this.updateActionAppearance(ev.action, this.currentLight, settings);
				}
			} catch (error) {
				streamDeck.logger.error('Failed to load light state:', error);
			}
		}
	}

	/**
	 * Handle key press events
	 */
	override async onKeyDown(ev: KeyDownEvent<LightControlSettings>): Promise<void> {
		const { settings } = ev.payload;

		if (!this.isConfigured(settings)) {
			await ev.action.showAlert();
			streamDeck.logger.warn('Light control action not properly configured');
			return;
		}

		if (!this.currentLight || !this.lightControlService) {
			await ev.action.showAlert();
			streamDeck.logger.error('Light not available or service not initialized');
			return;
		}

		try {
			await this.executeControl(this.currentLight, settings);
			await this.updateActionAppearance(ev.action, this.currentLight, settings);
		} catch (error) {
			streamDeck.logger.error('Failed to control light:', error);
			await ev.action.showAlert();
		}
	}

	/**
	 * Handle messages from property inspector
	 */
	override async onSendToPlugin(
		ev: SendToPluginEvent<JsonValue, LightControlSettings>,
	): Promise<void> {
		if (!(ev.payload instanceof Object) || !('event' in ev.payload)) {
			return;
		}

		const settings = await ev.action.getSettings();

		switch (ev.payload.event) {
			case 'getLights':
				await this.handleGetLights(settings);
				break;
			case 'testLight':
				await this.handleTestLight(ev, settings);
				break;
			case 'refreshState':
				await this.handleRefreshState(ev, settings);
				break;
		}
	}

	/**
	 * Initialize repositories and services
	 */
	private initializeServices(apiKey: string): void {
		this.lightRepository = new GoveeLightRepository(apiKey, true);
		this.lightControlService = new LightControlService(this.lightRepository);
	}

	/**
	 * Check if action is properly configured
	 */
	private isConfigured(settings: LightControlSettings): boolean {
		return !!(settings.apiKey && settings.selectedDeviceId && settings.selectedModel);
	}

	/**
	 * Execute the configured control action
	 */
	private async executeControl(light: Light, settings: LightControlSettings): Promise<void> {
		if (!this.lightControlService) {
			throw new Error('Light control service not initialized');
		}

		const mode = settings.controlMode || 'toggle';

		switch (mode) {
			case 'toggle':
				await this.lightControlService.controlLight(light, light.isOn ? 'off' : 'on');
				break;

			case 'on':
				if (settings.brightnessValue || settings.colorValue || settings.colorTempValue) {
					const controlSettings = this.parseControlSettings(settings);
					await this.lightControlService.turnOnLightWithSettings(light, controlSettings);
				} else {
					await this.lightControlService.controlLight(light, 'on');
				}
				break;

			case 'off':
				await this.lightControlService.controlLight(light, 'off');
				break;

			case 'brightness':
				if (settings.brightnessValue !== undefined) {
					const brightness = new Brightness(settings.brightnessValue);
					await this.lightControlService.controlLight(light, 'brightness', brightness);
				}
				break;

			case 'color':
				if (settings.colorValue) {
					const color = ColorRgb.fromHex(settings.colorValue);
					await this.lightControlService.controlLight(light, 'color', color);
				}
				break;

			case 'colorTemp':
				if (settings.colorTempValue) {
					const colorTemp = new ColorTemperature(settings.colorTempValue);
					await this.lightControlService.controlLight(light, 'colorTemperature', colorTemp);
				}
				break;
		}
	}

	/**
	 * Parse control settings from action configuration
	 */
	private parseControlSettings(settings: LightControlSettings) {
		const result: {
			brightness?: Brightness;
			color?: ColorRgb;
			colorTemperature?: ColorTemperature;
		} = {};

		if (settings.brightnessValue !== undefined) {
			result.brightness = new Brightness(settings.brightnessValue);
		}

		if (settings.colorValue) {
			result.color = ColorRgb.fromHex(settings.colorValue);
		} else if (settings.colorTempValue) {
			result.colorTemperature = new ColorTemperature(settings.colorTempValue);
		}

		return result;
	}

	/**
	 * Get appropriate title for the action
	 */
	private getActionTitle(settings: LightControlSettings): string {
		if (!settings.selectedLightName) {
			return 'Configure\nLight';
		}

		const mode = settings.controlMode || 'toggle';
		const lightName = settings.selectedLightName.length > 10 
			? settings.selectedLightName.substring(0, 10) + '...' 
			: settings.selectedLightName;

		switch (mode) {
			case 'toggle': return `Toggle\n${lightName}`;
			case 'on': return `On\n${lightName}`;
			case 'off': return `Off\n${lightName}`;
			case 'brightness': return `Bright\n${lightName}`;
			case 'color': return `Color\n${lightName}`;
			case 'colorTemp': return `Temp\n${lightName}`;
			default: return lightName;
		}
	}

	/**
	 * Update action appearance based on light state
	 */
	private async updateActionAppearance(
		action: any,
		light: Light,
		settings: LightControlSettings
	): Promise<void> {
		const title = this.getActionTitle(settings);
		await action.setTitle(title);

		// Could add state indicator (e.g., different background) based on light.isOn
		// This would require custom images in the manifest
	}

	/**
	 * Handle request for available lights from property inspector
	 */
	private async handleGetLights(settings: LightControlSettings): Promise<void> {
		if (!settings.apiKey) {
			streamDeck.logger.warn('API key required to fetch lights');
			return;
		}

		try {
			if (!this.lightRepository) {
				this.initializeServices(settings.apiKey);
			}

			const lights = await this.lightRepository!.getAllLights();
			const items = lights.map(light => ({
				label: light.name,
				value: `${light.deviceId}|${light.model}`,
			}));

			await streamDeck.ui.current?.sendToPropertyInspector({
				event: 'getLights',
				items,
			});
		} catch (error) {
			streamDeck.logger.error('Failed to fetch lights:', error);
			await streamDeck.ui.current?.sendToPropertyInspector({
				event: 'error',
				message: 'Failed to fetch lights. Check your API key.',
			});
		}
	}

	/**
	 * Handle test light request from property inspector
	 */
	private async handleTestLight(
		ev: SendToPluginEvent<JsonValue, LightControlSettings>,
		settings: LightControlSettings
	): Promise<void> {
		if (!settings.selectedDeviceId || !settings.selectedModel || !this.lightRepository) {
			return;
		}

		try {
			const light = await this.lightRepository.findLight(
				settings.selectedDeviceId,
				settings.selectedModel
			);

			if (light && this.lightControlService) {
				// Quick blink test
				await this.lightControlService.controlLight(light, light.isOn ? 'off' : 'on');
				setTimeout(async () => {
					if (this.lightControlService && light) {
						await this.lightControlService.controlLight(light, light.isOn ? 'off' : 'on');
					}
				}, 1000);

				await streamDeck.ui.current?.sendToPropertyInspector({
					event: 'testResult',
					success: true,
					message: 'Light test successful!',
				});
			}
		} catch (error) {
			streamDeck.logger.error('Light test failed:', error);
			await streamDeck.ui.current?.sendToPropertyInspector({
				event: 'testResult',
				success: false,
				message: 'Light test failed. Check connection.',
			});
		}
	}

	/**
	 * Handle refresh state request from property inspector
	 */
	private async handleRefreshState(
		ev: SendToPluginEvent<JsonValue, LightControlSettings>,
		settings: LightControlSettings
	): Promise<void> {
		if (this.currentLight && this.lightRepository) {
			try {
				await this.lightRepository.getLightState(this.currentLight);
				await this.updateActionAppearance(ev.action, this.currentLight, settings);
			} catch (error) {
				streamDeck.logger.error('Failed to refresh light state:', error);
			}
		}
	}
}
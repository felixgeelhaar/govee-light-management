/**
 * Migration Recommendations Composable
 *
 * Provides reactive access to migration recommendations for property inspectors
 */

import { ref, computed, onMounted } from "vue";
import { websocketService } from "../services/websocketService";

/**
 * Migration recommendation item
 */
export interface MigrationRecommendation {
  id: string;
  message: string;
  type: "info" | "success" | "warning";
  actionType?: string;
  targetType?: string;
  dismissed?: boolean;
}

/**
 * Migration recommendations composable
 */
export function useMigrationRecommendations() {
  const recommendations = ref<MigrationRecommendation[]>([]);
  const isLoading = ref(false);
  const hasRecommendations = computed(() => recommendations.value.length > 0);
  const activeRecommendations = computed(() =>
    recommendations.value.filter((r) => !r.dismissed),
  );

  /**
   * Load migration recommendations from the plugin
   */
  const loadRecommendations = async () => {
    if (!websocketService.isConnected) {
      console.warn(
        "WebSocket not connected, cannot load migration recommendations",
      );
      return;
    }

    isLoading.value = true;
    try {
      await websocketService.sendToPlugin({
        event: "getMigrationRecommendations",
      });
    } catch (error) {
      console.error("Failed to request migration recommendations:", error);
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Dismiss a specific recommendation
   */
  const dismissRecommendation = async (recommendationId: string) => {
    const recommendation = recommendations.value.find(
      (r) => r.id === recommendationId,
    );
    if (recommendation) {
      recommendation.dismissed = true;

      // Notify plugin that recommendation was dismissed
      try {
        await websocketService.sendToPlugin({
          event: "dismissMigrationRecommendation",
          recommendationId,
        });
      } catch (error) {
        console.error("Failed to dismiss recommendation:", error);
      }
    }
  };

  /**
   * Dismiss all recommendations
   */
  const dismissAllRecommendations = async () => {
    recommendations.value.forEach((r) => (r.dismissed = true));

    try {
      await websocketService.sendToPlugin({
        event: "dismissAllMigrationRecommendations",
      });
    } catch (error) {
      console.error("Failed to dismiss all recommendations:", error);
    }
  };

  /**
   * Handle incoming migration recommendations from plugin
   */
  const handleMigrationRecommendations = (data: any) => {
    if (data.recommendations && Array.isArray(data.recommendations)) {
      recommendations.value = data.recommendations.map(
        (message: string, index: number) => ({
          id: `migration-${index}`,
          message,
          type: "info" as const,
          dismissed: false,
        }),
      );
    }
  };

  /**
   * Generate helpful migration messages based on action type
   */
  const getActionSpecificMessages = (
    actionType: string,
  ): MigrationRecommendation[] => {
    const messages: Record<string, string> = {
      toggle:
        "This Toggle action can control both individual lights and groups. Use the target selector to choose what to control.",
      brightness:
        "This Brightness action supports Stream Deck+ dial rotation for smooth brightness control. Turn the dial to adjust brightness.",
      color:
        "This Color action lets you pick colors directly or cycle through presets. Great for Stream Deck+ touchscreen displays.",
      warmth:
        "This Warmth action controls color temperature from warm (2000K) to cool (9000K). Perfect for Stream Deck+ dial control.",
    };

    const message = messages[actionType];
    if (message) {
      return [
        {
          id: `help-${actionType}`,
          message,
          type: "info",
          actionType,
          dismissed: false,
        },
      ];
    }

    return [];
  };

  /**
   * Add helpful messages for new users
   */
  const addHelpfulMessages = (actionType: string) => {
    const helpMessages = getActionSpecificMessages(actionType);
    helpMessages.forEach((msg) => {
      if (!recommendations.value.find((r) => r.id === msg.id)) {
        recommendations.value.push(msg);
      }
    });
  };

  // Set up WebSocket message handler
  onMounted(() => {
    if (websocketService.isConnected) {
      loadRecommendations();
    }

    // Listen for WebSocket connection
    const handleConnection = () => {
      loadRecommendations();
    };

    // Listen for migration recommendations
    const handleMessage = (event: any) => {
      if (event.payload?.event === "migrationRecommendations") {
        handleMigrationRecommendations(event.payload);
      }
    };

    websocketService.on("connect", handleConnection);
    websocketService.on("sendToPropertyInspector", handleMessage);

    // Cleanup
    return () => {
      websocketService.off("connect", handleConnection);
      websocketService.off("sendToPropertyInspector", handleMessage);
    };
  });

  return {
    recommendations: activeRecommendations,
    isLoading,
    hasRecommendations,
    loadRecommendations,
    dismissRecommendation,
    dismissAllRecommendations,
    addHelpfulMessages,
  };
}

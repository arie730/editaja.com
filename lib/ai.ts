// Re-export from settings for backward compatibility
export { getAiApiKey } from "./settings";

// AI API endpoints
export const AI_ENDPOINT_CREATE =
  "https://api.freepik.com/v1/ai/gemini-2-5-flash-image-preview";
export const AI_ENDPOINT_STATUS =
  "https://api.freepik.com/v1/ai/gemini-2-5-flash-image-preview/";

// Poll AI result
export const pollAiResult = async (
  taskId: string,
  apiKey: string,
  maxWaitSeconds: number = 90,
  intervalSeconds: number = 3
): Promise<{ ok: boolean; urls?: string[]; error?: string; json?: any }> => {
  const deadline = Date.now() + maxWaitSeconds * 1000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(
        `${AI_ENDPOINT_STATUS}${encodeURIComponent(taskId)}`,
        {
          method: "GET",
          headers: {
            "x-freepik-api-key": apiKey,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return {
          ok: false,
          error: `HTTP ${response.status}: ${errorText}`,
        };
      }

      const json = await response.json();
      const status = json?.data?.status;

      if (status === "COMPLETED") {
        const urls = json?.data?.generated || [];
        return { ok: true, urls, json };
      }

      if (status === "FAILED" || status === "CANCELLED") {
        return { ok: false, error: `Task ${status}`, json };
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1000));
    } catch (error: any) {
      return { ok: false, error: error.message || "Error polling result" };
    }
  }

  return { ok: false, error: "Timeout waiting for result" };
};




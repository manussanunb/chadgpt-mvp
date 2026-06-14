export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const [{ NodeSDK }, { resourceFromAttributes }, { PostHogSpanProcessor }, { GenAIInstrumentation }] =
      await Promise.all([
        import("@opentelemetry/sdk-node"),
        import("@opentelemetry/resources"),
        import("@posthog/ai/otel"),
        import("@traceloop/instrumentation-google-generativeai"),
      ]);

    const sdk = new NodeSDK({
      resource: resourceFromAttributes({
        "service.name": "chadgpt",
      }),
      spanProcessors: [
        new PostHogSpanProcessor({
          projectToken: process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!,
          host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
        }),
      ],
      instrumentations: [new GenAIInstrumentation()],
    });

    sdk.start();
  }
}

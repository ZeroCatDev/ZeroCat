import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import zcconfig from "./services/config/zcconfig.js";

const dsn = await zcconfig.get("sentry.dsn");

if (dsn && dsn.trim() !== "") {
  Sentry.init({
    dsn: dsn.trim(),
    integrations: [
      nodeProfilingIntegration(),
    ],

    // Send structured logs to Sentry
    enableLogs: true,
    // Tracing
    tracesSampleRate: 1.0, //  Capture 100% of the transactions
    // Set sampling rate for profiling - this is evaluated only once per SDK.init call
    profileSessionSampleRate: 1.0,
    // Trace lifecycle automatically enables profiling during active traces
    profileLifecycle: 'trace',
    // Setting this option to true will send default PII data to Sentry.
    // For example, automatic IP address collection on events
    sendDefaultPii: true,
  });

  // Profiling happens automatically after setting it up with `Sentry.init()`.
  // All spans (unless those discarded by sampling) will have profiling data attached to them.
  Sentry.startSpan({
    name: "Sentry Initialized",
  }, () => {
    // Sentry is ready
  });
}

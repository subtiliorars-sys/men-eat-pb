import { handleFeedbackApiRequest, type FeedbackApiEnv } from "./handler";

export default {
  fetch(request, env) {
    return handleFeedbackApiRequest(request, env);
  },
} satisfies ExportedHandler<FeedbackApiEnv>;

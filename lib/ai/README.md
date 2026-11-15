Owner: AI layer. Career matching, cited chat, and the output guard.

`lib/ai/client.ts` is the only file that calls a model. It reads `AI_API_KEY` on the server. With the key unset, career and chat return the engine-only fallback and do not call the network. There are no embeddings.

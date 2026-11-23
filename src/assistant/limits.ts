// Same for every role (docs/PROMPTS.md): a hard cap on the person's messages per session.
// Shared by the chat panel and the web server, which enforces it too.
export const maxUserMessages = 25;

// The longest message the person can send (about ten pages). Shared by the chat panel, which
// stops a longer one before it is recorded, and the web server, which refuses it: a longer
// message in the record would make every later call fail. Data belongs in attachments.
export const maxMessageChars = 20_000;

// The longest note the app writes into the record itself ("Podklad zobrazen: …", "Odevzdáno
// (… znaků)"): a material title at most. The evaluator gets no more of an event than this,
// and the web server refuses longer ones, which only a forged record can contain.
export const maxEventChars = 300;

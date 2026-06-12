// The marker catalogue — every headline-language marker the build
// counts, with its display title and a one-line definition. Single
// source of truth for the Style page: the nine curated cards take
// their titles from here, and the full ledger lists everything.
//
// Definitions here describe what build/build_language.py actually
// counts — if a definition changes there, change the words here.

export const MARKERS = [
  // Quotation & voice
  { key: 'quote_start', group: 'Quotation & voice', title: 'The quote opening', def: 'Headlines whose first character is a quotation mark.' },
  { key: 'quotes_anywhere', group: 'Quotation & voice', title: 'Quotation, anywhere', def: 'At least one quoted phrase somewhere in the headline.' },
  { key: 'first_person', group: 'Quotation & voice', title: 'First person', def: 'Contains "I", "my" or "me" as a whole word.' },
  { key: 'second_person', group: 'Quotation & voice', title: 'Second person', def: 'Contains "you" or "your" — the service-journalism address.' },
  { key: 'says_word', group: 'Quotation & voice', title: 'Says', def: 'The plainest attribution verb, doing ever more work.' },
  { key: 'warns', group: 'Quotation & voice', title: 'Warns', def: '"Warns" or "warned" — attribution with a forecast attached.' },
  { key: 'insists', group: 'Quotation & voice', title: 'Insists', def: '"Insists" or "insisted" — attribution under pressure.' },
  { key: 'admits', group: 'Quotation & voice', title: 'Admits', def: '"Admits" or "admitted" — attribution with a concession.' },
  { key: 'according_to', group: 'Quotation & voice', title: 'According to', def: 'The cautious sourcing formula, written out in full.' },

  // Punctuation
  { key: 'question', group: 'Punctuation', title: 'The question mark', def: 'Contains a question mark.' },
  { key: 'colon', group: 'Punctuation', title: 'The colon', def: 'A colon followed by a space — 3:30pm does not count.' },
  { key: 'exclamation', group: 'Punctuation', title: 'The exclamation mark', def: 'Contains an exclamation mark.' },
  { key: 'ellipsis', group: 'Punctuation', title: 'The ellipsis', def: 'Contains … or three dots.' },
  { key: 'dash', group: 'Punctuation', title: 'The dash', def: 'A spaced en or em dash — the Guardian headline’s hinge.' },
  { key: 'semicolon', group: 'Punctuation', title: 'The semicolon', def: 'The rarest respectable punctuation in a headline.' },
  { key: 'brackets', group: 'Punctuation', title: 'Brackets', def: 'Contains a parenthesis.' },
  { key: 'pipe', group: 'Punctuation', title: 'The pipe', def: 'The " | " that ends a comment headline — broadly tracks the Opinion desk.' },

  // Shape
  { key: 'short5', group: 'Shape', title: 'Five words or fewer', def: 'The headline that assumed you’d already seen the page.' },
  { key: 'words20', group: 'Shape', title: 'Twenty words or more', def: 'The headline that is fully a sentence, possibly two.' },
  { key: 'single_word', group: 'Shape', title: 'One word', def: 'The entire headline is a single word.' },
  { key: 'digits', group: 'Shape', title: 'Numbers', def: 'Contains a digit.' },
  { key: 'digit_start', group: 'Shape', title: 'Starts with a number', def: 'The listicle opening: "10 things…".' },
  { key: 'money', group: 'Shape', title: 'Money', def: 'Contains £, $ or €.' },
  { key: 'percent', group: 'Shape', title: 'The per cent sign', def: 'Contains %.' },
  { key: 'age_comma', group: 'Shape', title: 'The comma age', def: 'The ", 34," construction — a person, aged, bracketed by commas.' },
  { key: 'versus', group: 'Shape', title: 'X v Y', def: 'The bare "v" or "vs" of a contest.' },

  // Journalese
  { key: 'amid', group: 'Journalese', title: 'Amid', def: 'Journalism’s busiest preposition.' },
  { key: 'set_to', group: 'Journalese', title: 'Set to', def: 'The future tense of news.' },
  { key: 'row_word', group: 'Journalese', title: 'Row', def: 'The great British disagreement.' },
  { key: 'sparks', group: 'Journalese', title: 'Sparks', def: '"Sparks" or "sparked" — how rows begin.' },
  { key: 'fears', group: 'Journalese', title: 'Fears', def: '"Fears" — frequently found amid.' },
  { key: 'boost', group: 'Journalese', title: 'Boost', def: 'Political reporting’s good weather.' },
  { key: 'blow', group: 'Journalese', title: 'Blow', def: 'Political reporting’s bad weather.' },
  { key: 'hedge', group: 'Journalese', title: 'Could, may, might', def: 'The speculation index.' },
  { key: 'crisis', group: 'Journalese', title: 'Crisis', def: 'The word itself, in the headline.' },
  { key: 'chaos', group: 'Journalese', title: 'Chaos', def: 'Crisis’s more excitable sibling.' },
  { key: 'urges', group: 'Journalese', title: 'Urges', def: '"Urges", "urged" or "urging".' },
  { key: 'u_turn', group: 'Journalese', title: 'U-turn', def: 'The manoeuvre, hyphenated.' },
  { key: 'so_called', group: 'Journalese', title: 'So-called', def: 'Distance, in one hyphenated word.' },
  { key: 'gate', group: 'Journalese', title: '-gate', def: 'Scandal coinages — Southgate, Margate and friends excluded.' },
  { key: 'woke', group: 'Journalese', title: 'Woke', def: 'The word, in any sense.' },
  { key: 'viral', group: 'Journalese', title: 'Viral', def: 'Mostly metaphorical; briefly, in 2020, not.' },

  // Words & registers
  { key: 'why_start', group: 'Words', title: 'Why…', def: 'Headlines that open with "Why".' },
  { key: 'how_to', group: 'Words', title: 'How to', def: 'The service promise.' },
  { key: 'best', group: 'Words', title: 'Best', def: 'The lifestyle superlative.' },
  { key: 'worst', group: 'Words', title: 'Worst', def: 'Its shadow.' },
  { key: 'swears', group: 'Words', title: 'Swearing', def: 'A headline containing a swear word — the Guardian prints them in full.' },

  // Formats & furniture
  { key: 'as_it_happened', group: 'Formats', title: '…as it happened', def: 'How the archive remembers a liveblog: closed blogs are retitled.' },
  { key: 'revealed', group: 'Formats', title: 'Revealed:', def: 'Headlines opening with "Revealed:".' },
  { key: 'exclusive', group: 'Formats', title: 'Exclusive:', def: 'Headlines opening with "Exclusive:" — famously, almost none.' },
  { key: 'guardian_view', group: 'Formats', title: 'The Guardian view', def: 'The leader column’s standing introduction.' },
  { key: 'letters', group: 'Formats', title: 'Letters', def: 'Headlines that open or close as letters pages.' },
  { key: 'in_pictures', group: 'Formats', title: '…in pictures', def: 'The gallery suffix. Extinct.' },
  { key: 'video_suffix', group: 'Formats', title: '– video', def: 'The video suffix. Also extinct.' },
  { key: 'podcast', group: 'Formats', title: 'Podcast', def: 'The word, usually as furniture.' },
  { key: 'review_word', group: 'Formats', title: 'Review', def: 'The word "review" — mostly the format, sometimes the inquiry.' },
  { key: 'obituary', group: 'Formats', title: 'Obituary', def: 'The word in the headline, almost always as a label.' },
  { key: 'recipe', group: 'Formats', title: 'Recipe', def: '"Recipe" or "recipes" — the Feast era, measurable.' },
  { key: 'quiz', group: 'Formats', title: 'Quiz', def: 'The word, usually a promise of one.' },
  { key: 'qanda', group: 'Formats', title: 'Q&A', def: 'A dead format label.' },
  { key: 'factcheck', group: 'Formats', title: 'Factcheck', def: '"Factcheck" or "fact check".' },
  { key: 'cartoon', group: 'Formats', title: 'Cartoon', def: 'The labelled cartoon headline, now nearly gone.' },
];

export const MARKER_BY_KEY = new Map(MARKERS.map(m => [m.key, m]));

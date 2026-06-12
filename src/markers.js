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
  { key: 'says_word', q: 'says', group: 'Quotation & voice', title: 'Says', def: 'The plainest attribution verb, doing ever more work.' },
  { key: 'warns', q: 'warns', group: 'Quotation & voice', title: 'Warns', def: '"Warns" or "warned" — attribution with a forecast attached.' },
  { key: 'insists', q: 'insists', group: 'Quotation & voice', title: 'Insists', def: '"Insists" or "insisted" — attribution under pressure.' },
  { key: 'admits', q: 'admits', group: 'Quotation & voice', title: 'Admits', def: '"Admits" or "admitted" — attribution with a concession.' },
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
  { key: 'amid', q: 'amid', group: 'Journalese', title: 'Amid', def: 'Journalism’s busiest preposition.' },
  { key: 'set_to', group: 'Journalese', title: 'Set to', def: 'The future tense of news.' },
  { key: 'row_word', q: 'row', group: 'Journalese', title: 'Row', def: 'The great British disagreement.' },
  { key: 'sparks', q: 'sparks', group: 'Journalese', title: 'Sparks', def: '"Sparks" or "sparked" — how rows begin.' },
  { key: 'fears', q: 'fears', group: 'Journalese', title: 'Fears', def: '"Fears" — frequently found amid.' },
  { key: 'boost', q: 'boost', group: 'Journalese', title: 'Boost', def: 'Political reporting’s good weather.' },
  { key: 'blow', q: 'blow', group: 'Journalese', title: 'Blow', def: 'Political reporting’s bad weather.' },
  { key: 'hedge', group: 'Journalese', title: 'Could, may, might', def: 'The speculation index.' },
  { key: 'crisis', q: 'crisis', group: 'Journalese', title: 'Crisis', def: 'The word itself, in the headline.' },
  { key: 'chaos', q: 'chaos', group: 'Journalese', title: 'Chaos', def: 'Crisis’s more excitable sibling.' },
  { key: 'urges', q: 'urges', group: 'Journalese', title: 'Urges', def: '"Urges", "urged" or "urging".' },
  { key: 'u_turn', q: 'u-turn', group: 'Journalese', title: 'U-turn', def: 'The manoeuvre, hyphenated.' },
  { key: 'so_called', q: 'so-called', group: 'Journalese', title: 'So-called', def: 'Distance, in one hyphenated word.' },
  { key: 'gate', group: 'Journalese', title: '-gate', def: 'Scandal coinages — Southgate, Margate and friends excluded.' },
  { key: 'woke', q: 'woke', group: 'Journalese', title: 'Woke', def: 'The word, in any sense.' },
  { key: 'viral', q: 'viral', group: 'Journalese', title: 'Viral', def: 'Mostly metaphorical; briefly, in 2020, not.' },
  { key: 'slam', q: 'slam', group: 'Journalese', title: 'Slam', def: 'The tabloid verb the guide lists among those to avoid. Headlines do enjoy a good slam.' },
  { key: 'unveil', q: 'unveil', group: 'Journalese', title: 'Unveil', def: 'Best kept for statues, in the spirit of the guide; increasingly applied to policies and phones.' },
  { key: 'hike', q: 'hike', group: 'Journalese', title: 'Hike', def: 'The guide warns the metaphor can wander — a “petrol hike” rather suggests a long walk to a garage.' },
  { key: 'pledge', q: 'pledge', group: 'Journalese', title: 'Pledge', def: 'Among the words “used all the time by journalists, only rarely by normal people” — the guide’s phrase.' },
  { key: 'spiral', q: 'spiral', group: 'Journalese', title: 'Spiral', def: 'Costs do it, situations do it; the guide would rather they did it a little less often.' },
  { key: 'fuels', q: 'fuels', group: 'Journalese', title: 'Fuels', def: 'As in “fuels fears” — the headline verb, not the petrol.' },
  { key: 'downplay', q: 'downplay', group: 'Journalese', title: 'Downplay', def: 'Newsroom shorthand the guide files under overused.' },
  { key: 'ramp_up', q: 'ramp up', group: 'Journalese', title: 'Ramp up', def: 'Shorthand for “increase”. The guide hasn’t caught up with it; the headlines have.' },
  { key: 'right_now', q: 'right now', group: 'Journalese', title: 'Right now', def: 'The guide says it “adds nothing and should normally be deleted”.' },
  { key: 'perfect_storm', q: 'perfect storm', group: 'Journalese', title: 'Perfect storm', def: '“A perfect cliche, best avoided” — the guide, rather pleased with the line.' },
  { key: 'fit_for_purpose', q: 'fit for purpose', group: 'Journalese', title: 'Fit for purpose', def: 'The guide calls it a “cliche that quickly proved itself unfit for the purpose of good writing”.' },
  { key: 'elephant_in_room', q: 'elephant in the room', group: 'Journalese', title: 'Elephant in the room', def: 'A metaphor the guide says outstayed its welcome. Mercifully rare in headlines.' },

  // Words & registers
  { key: 'why_start', group: 'Words', title: 'Why…', def: 'Headlines that open with "Why".' },
  { key: 'how_to', group: 'Words', title: 'How to', def: 'The service promise.' },
  { key: 'best', q: 'best', group: 'Words', title: 'Best', def: 'The lifestyle superlative.' },
  { key: 'worst', q: 'worst', group: 'Words', title: 'Worst', def: 'Its shadow.' },
  { key: 'swears', group: 'Words', title: 'Swearing', def: 'A headline containing a swear word — the Guardian prints them in full.' },
  { key: 'iconic', q: 'iconic', group: 'Words', title: 'Iconic', def: 'The guide pleads for “a little more thought, and restraint” — and admits its own writers rarely oblige.' },
  { key: 'massive', q: 'massive', group: 'Words', title: 'Massive', def: 'The guide’s one-word verdict: “massively overused.”' },
  { key: 'major', q: 'major', group: 'Words', title: 'Major', def: '“A major case of overuse,” per the guide, which offers big, main and leading as ways out.' },
  { key: 'very', group: 'Words', title: 'Very', def: 'The guide passes on the old advice: write “damn” instead, and your editor will delete it.' },
  { key: 'controversial', q: 'controversial', group: 'Words', title: 'Controversial', def: 'The guide reckons it “can normally be safely removed to let readers make up their own minds”.' },
  { key: 'famous', q: 'famous', group: 'Words', title: 'Famous', def: '“If you need to tell people something’s famous, it isn’t” — the guide, on itself.' },
  { key: 'basically', group: 'Words', title: 'Basically', def: '“This word is unnecessary, basically” — the guide’s entry, in full.' },
  { key: 'ongoing', q: 'ongoing', group: 'Words', title: 'Ongoing', def: 'The guide concedes that “even some journalists are oddly fond of it”.' },
  { key: 'upcoming', q: 'upcoming', group: 'Words', title: 'Upcoming', def: 'The guide’s entry on this one works itself up to mentioning corporal punishment. We’ll stop there.' },
  { key: 'multiple', group: 'Words', title: 'Multiple', def: 'The guide prefers the plain plural: “gunshots were heard”, not “multiple gunshots”.' },

  // Formats & furniture
  { key: 'as_it_happened', group: 'Formats', title: '…as it happened', def: 'How the archive remembers a liveblog: closed blogs are retitled.' },
  { key: 'revealed', q: 'revealed', group: 'Formats', title: 'Revealed:', def: 'Headlines opening with "Revealed:".' },
  { key: 'exclusive', q: 'exclusive', group: 'Formats', title: 'Exclusive:', def: 'Headlines opening with "Exclusive:" — famously, almost none.' },
  { key: 'guardian_view', group: 'Formats', title: 'The Guardian view', def: 'The leader column’s standing introduction.' },
  { key: 'letters', group: 'Formats', title: 'Letters', def: 'Headlines that open or close as letters pages.' },
  { key: 'in_pictures', group: 'Formats', title: '…in pictures', def: 'The gallery suffix. Extinct.' },
  { key: 'video_suffix', group: 'Formats', title: '– video', def: 'The video suffix. Also extinct.' },
  { key: 'podcast', q: 'podcast', group: 'Formats', title: 'Podcast', def: 'The word, usually as furniture.' },
  { key: 'review_word', q: 'review', group: 'Formats', title: 'Review', def: 'The word "review" — mostly the format, sometimes the inquiry.' },
  { key: 'obituary', q: 'obituary', group: 'Formats', title: 'Obituary', def: 'The word in the headline, almost always as a label.' },
  { key: 'recipe', q: 'recipe', group: 'Formats', title: 'Recipe', def: '"Recipe" or "recipes" — the Feast era, measurable.' },
  { key: 'quiz', q: 'quiz', group: 'Formats', title: 'Quiz', def: 'The word, usually a promise of one.' },
  { key: 'qanda', group: 'Formats', title: 'Q&A', def: 'A dead format label.' },
  { key: 'factcheck', group: 'Formats', title: 'Factcheck', def: '"Factcheck" or "fact check".' },
  { key: 'cartoon', q: 'cartoon', group: 'Formats', title: 'Cartoon', def: 'The labelled cartoon headline, now nearly gone.' },
];

export const MARKER_BY_KEY = new Map(MARKERS.map(m => [m.key, m]));

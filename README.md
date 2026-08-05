# Learnova

Learnova is a study tool built on active recall, spaced
practice, and self-explanation. It is a calibration
instrument rather than a card stack: the aim is to show a
student the gap between feeling familiar with material and
actually understanding it.

Teach-Back is the diagnostic. A student explains a concept in
their own words, the explanation is graded honestly, and
concepts that are not yet understood resurface until they
are. Feedback is never softened, and the system will not hand
over the answer.

## Honest note on the research

Practice testing and spaced practice are the most strongly
supported study methods in the literature. Self-explanation
has moderate support. Learnova's contribution is not the
method itself, it is knowing what to drill and whether
understanding is real.

## Status

Early development. Not yet released.

## Privacy

Explanations are sent to a server-side AI model for grading.
The model call happens on the server, never in the browser,
and API credentials are never exposed to the client. There
are no user accounts, and nothing is stored beyond the
current session. This will change as the project develops,
and this section will be updated to match rather than
lagging behind it.

## Authorship

Learnova v2 is a solo rebuild from scratch. An earlier
version was built with a co-founder.



## Stack

Next.js, TypeScript, Tailwind CSS.

## License

Apache License 2.0. See LICENSE and NOTICE.

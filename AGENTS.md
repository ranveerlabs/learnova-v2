<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Storing something means updating the README in the same commit

If a change causes anything to be kept anywhere — a new `localStorage` key or a
new field in an existing one, a cookie, a server-side cache, a log line that can
contain something a student wrote, or a new third party that receives their text
— then the Privacy section of `README.md` is part of that change and goes in the
same commit. Not a follow-up, not a TODO.

This rule exists because that section has been wrong twice, and both times the
same way. The product started keeping something, the prose stayed reassuring,
and "nothing is stored beyond the current session" went from true to false
without anybody editing a line. A privacy claim does not decay loudly; it just
quietly stops being true.

So write that section to be **checkable rather than comforting**. Name the
actual storage keys. Say what is in them, that they are per device, and that
clearing site data erases them with no way back. Name the third parties that
receive student text. Where something is awkward — that there is no in-app way
to reset the elo, that unparseable model output is logged and can quote pasted
material — say it, because the awkward facts are the ones a reassuring rewrite
drops first.

The same discipline applies to claims about verification anywhere in the README.
If something has been checked in emulated Chrome on one machine, that is what it
says, not "works on mobile".

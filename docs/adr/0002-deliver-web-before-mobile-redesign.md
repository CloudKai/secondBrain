---
status: accepted
---

# Deliver web before adapting the iPhone design

The target learning-library experience will be designed and delivered in a
browser first, with room for contextual graph and source panels. The existing
iPhone design is retained for reference and adapted after the web experience
is well designed, so a phone layout does not constrain the new learning flow
before that flow is established. The verified native MVP remains the current
baseline; this decision sets the delivery order for target work.

Implement the browser frontend separately in the parent repository and keep
`mobile/` and generated native iOS folders untouched during web work. This
preserves the existing phone design while allowing browser-specific panels and
navigation to develop independently.

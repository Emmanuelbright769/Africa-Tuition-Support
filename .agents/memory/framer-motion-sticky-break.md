---
name: Framer-motion transforms break position:sticky
description: Using itemVariants (y:18→y:0) on a motion.div ancestor silently breaks position:sticky inside it — opacity-only animation is the fix.
---

## Rule
Never wrap a component that contains `position: sticky` children with a `motion.div` that animates any transform property (`y`, `x`, `scale`, `rotate`, etc.).

**Why:** CSS transforms create a new containing block. When framer-motion applies `translateY(18px)` (or even `translateY(0px)` after animation ends), the sticky element resolves its "scroll container" as the transformed ancestor rather than the real `overflow-y: auto` scroll container. The header scrolls away instead of sticking.

**How to apply:** For any section rendered with `motion.div variants={itemVariants}` where the section itself manages a sticky header, override the motion wrapper to use opacity-only:

```jsx
// WRONG — y transform breaks sticky inside EcommerceSection
<motion.div variants={itemVariants}>
  <EcommerceSection />
</motion.div>

// CORRECT — opacity only, no transform, sticky works
<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
  <EcommerceSection />
</motion.div>
```

Leave a comment on the motion.div explaining WHY itemVariants cannot be used there, so future changes don't reintroduce the bug.

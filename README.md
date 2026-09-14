 # Turning cool websites into code you can use

An Instagram series, and the working code behind it.

Every episode picks one interaction off a site that made me stop scrolling,
works out what it is *actually* doing — by reading the numbers off the live
page, not by guessing at them — and rebuilds it as a component you can drop
into your own project.

No "inspired by". The real geometry, the real timings, and a note on which bits
I changed and why.

## Episodes

| # | Interaction | Source | Code | Read |
|---|---|---|---|---|
| 001 | Diagonal carousel — objects travelling one shared diagonal, rotating as they go, lights flickering on as they pass centre | [studioloop.com.br](https://www.studioloop.com.br/) | [`001-diagonal-carousel/`](001-diagonal-carousel/) | [blog](blog/001-the-diagonal-carousel.md) |
| 002 | Image sphere — 3D gallery on a sphere, an endless helix or stacked rings, in either orientation; drag to orbit, scroll to roll or screw | [gionatannese.com](https://www.gionatannese.com/) + [k95.it](https://k95.it/en) | [`002-image-sphere/`](002-image-sphere/) | [blog](blog/002-the-image-sphere.md) |

## Running an episode

Each folder is a standalone app. Nothing is shared between them, on purpose —
you should be able to copy one directory out and have it work.

```bash
cd 001-diagonal-carousel
npm install
npm run dev
```

The component itself is always under `src/<name>/`, with no dependencies beyond
React. That is the part meant to be lifted; everything outside it is just a page
to show it off on.

## What's in an episode

```
00N-thing/
├── README.md          how to use the component, and how it works
├── src/<name>/        the component — self-contained, copy this out
├── src/App.tsx        a demo page, not part of the component
└── public/            any generated assets
```

Plus a post in [`blog/`](blog/) covering how the original was reverse-engineered
— usually the more interesting half.

## Method

[`SKILL.md`](SKILL.md) is the repeatable version of the process: how to find the
real numbers instead of eyeballing them, how to reduce an interaction to the one
value that drives it, and how to prove the rebuild matches rather than hoping it
does. It is written as a Claude Code skill — drop it in `~/.claude/skills/` — but
it reads fine as a checklist for doing it by hand.

## On copying

Everything here is rebuilt from scratch. I read the published page to understand
the mechanism — spacing, angles, timings — the same way you would read any site
you admire, and then write my own implementation of it.

What I don't take: artwork, copy, fonts, or anything else the original studio
actually made. Episode assets are generated or sourced separately, and each
episode's README says where its assets came from. If you ship one of these,
bring your own art too.

Sources are credited in every episode and every post. Go look at the originals —
they are better than my rebuilds.

# What Was Wrong With the References, and What Was Fixed

## The worry

You were worried the report's References section might have fake or broken citations, since your professor treats that as an automatic fail.

## What I did

I opened every single reference in the report and checked it for real — clicked every link, and read every datasheet PDF to see if the numbers in the report actually match what's in the datasheet.

## What I found

**Problem 1: Broken links.**
5 out of 8 web links in the References list were dead — they went nowhere. I found the correct working link for each one and replaced it.

**Problem 2: Some numbers didn't match their sources.**
The report has a spot where it says four sensor accuracy numbers "come directly from the manufacturer's datasheet." I checked, and two of those four numbers were wrong, and one had no datasheet source at all. These weren't invented out of nowhere — they were real numbers already used in your alert code — the report just claimed a stronger source for them than actually existed.

## What I fixed

- Replaced the 5 broken links with working ones.
- Updated the alert code (`AlertService.java`) so those two wrong numbers now match the real datasheet.
- Fixed the report text so every number now says truthfully where it came from — either "from the datasheet" (when true) or "our own chosen value" (when there's no datasheet number to point to).
- Did the same fix in both copies of the report: `ieee-report.tex` and `ieee-report.md`.
- Recompiled the report to make sure it still builds fine and is still 8 pages.

## Where things stand now

Everything above is done. Nothing is left open from this check.

---
name: atlas-learning
description: Set up a cloned Course Learning Atlas, learn or review a course topic, check understanding, or add a clear explanation, diagram, interactive lesson, or narrated video to an Atlas course.
---

# Learn with Course Learning Atlas

## Get started

Read the repository README. For a setup request, build and open the bundled demo or use `atlas.py init` to start a course. For a concept request, find the relevant course manifest, local guidance, and material. Use the bundled example when it covers the concept and the learner has no course of their own. A short request such as `$atlas-learning 容量估算` is enough to begin. Use a brief explanation and worked example by default. Ask about the course or current difficulty when the answer materially changes the lesson.

## Learn, review, or check understanding

- For a new topic, establish the prerequisites and teach one idea through a worked example. Check the relevant source, state the assumptions, define symbols and units, and use the course's terminology. If there is no course source for the idea, identify it as a general explanation.
- For review, start from the learner's current question or the recorded stopping point. Connect the idea to an earlier topic and revisit the misconception or decision the learner struggled with.
- When the learner asks to check understanding, offer one prediction, explanation, or transfer question at a time. Wait for their reasoning before giving feedback. A viewed lesson is evidence of exposure. Record mastery only when the learner demonstrates it, and update existing learning notes when requested.

## Pick a teaching format

Honor the requested format. Add a small diagram or interactive when it makes the underlying relationship easier to see. Use a narrated video when requested or when movement and timing materially help the learner and media tools are available. Keep the same example and values across any companion materials.

- **Explanation:** Use direct sentences and consistent terms. Connect each equation to what it measures or predicts. Distinguish a course claim from an illustrative value or inference.
- **Diagram:** Show a relationship, sequence, or comparison. Label axes, units, and the meaning of the arrows or marks. Check the diagram against the text and course source.
- **Interactive:** Build a self-contained HTML lesson or register its dependencies with `assets` in `course.json`. Use a small number of meaningful controls, an informative starting case, and a reset. Check at least the default, a changed input, and reset.
- **Narrated video:** Use animation to show a change that is harder to follow in a static picture. Match the narration, captions, and example, then check representative frames, runtime, and audible audio. A speech tool and FFmpeg are optional ways to author one. For personal use on macOS, check that `say` created positive-duration audio before combining it with video. Use narration that permits redistribution in public examples. If rendering is unavailable, identify the resulting storyboard and script as such. Put a finished MP4 beside its lesson and list it under `assets` so the build includes it.

Use `examples/networking/materials/capacity.html` and `examples/networking/course.json` as a working example. Check one numerical case by hand and name the source or the illustrative assumption. After adding a resource, build the relevant course or combined site and open its resource card. Keep source files and the manifest as the record for later rebuilds. Use synthetic examples or materials cleared for the audience in a public build. Keep private sources, notes, and builds in an access-controlled location.

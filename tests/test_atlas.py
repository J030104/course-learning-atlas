import json
import tempfile
import unittest
from pathlib import Path

from atlas import DEMO, MARKER, build, build_site, init, staged_output


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


class AtlasBuildTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.output = self.root / "dist"

    def new_course(self, course_id):
        folder = self.root / course_id
        config = init(folder, course_id, course_id.title(), course_id.upper())
        data = read(config)
        data["topics"] = ["Review"]
        data["resources"] = [{"id": "notes", "kind": "notes", "title": "Notes",
                              "topics": ["Review"], "files": ["notes.md"]}]
        config.write_text(json.dumps(data))
        material = folder / "materials" / "notes.md"
        material.write_text("First edition\n")
        return config, material

    def make_site(self):
        alpha, a_material = self.new_course("alpha")
        beta, b_material = self.new_course("beta")
        site = self.root / "site.json"
        site.write_text(json.dumps({"default": "alpha", "courses": [
            {"config": str(alpha)}, {"config": str(beta)},
        ]}))
        return site, a_material, b_material

    def version(self, course):
        return read(self.output / course / "version.json")

    def test_single_course_and_blank_course(self):
        demo = build(DEMO, DEMO.parent / "materials", self.output)
        self.assertEqual(len(demo["resources"]), 4)
        self.assertEqual(demo["courses"], [])
        self.assertTrue((self.output / "resources/capacity.pdf").is_file())
        config = init(self.root / "new", "empty", "Empty course", "EMPTY")
        empty = build(config, config.parent / "materials", self.output)
        self.assertEqual(empty["resources"], [])
        self.assertTrue((self.output / MARKER).exists())

    def test_each_course_versions_independently(self):
        site, alpha, beta = self.make_site()
        build_site(site, self.output)
        a_initial, b_initial = self.version("alpha"), self.version("beta")
        alpha.write_text("Second edition\n")
        build_site(site, self.output)
        a_next = self.version("alpha")
        self.assertNotEqual(a_initial["course"], a_next["course"])
        self.assertEqual(a_initial["shared"], a_next["shared"])
        self.assertEqual(b_initial, self.version("beta"))

        alpha.write_text("Third edition\n")
        beta.write_text("Second edition\n")
        build_site(site, self.output)
        self.assertNotEqual(a_next["course"], self.version("alpha")["course"])
        self.assertNotEqual(b_initial["course"], self.version("beta")["course"])
        self.assertEqual((self.output / "alpha/resources/notes.md").read_text(), "Third edition\n")
        self.assertEqual((self.output / "beta/resources/notes.md").read_text(), "Second edition\n")
        self.assertEqual(read(self.output / "alpha/catalog.json")["courses"][1]["url"], "../beta/")

    def test_failed_build_preserves_previous_site(self):
        site, _, beta = self.make_site()
        build_site(site, self.output)
        previous = self.version("beta")
        beta.unlink()
        with self.assertRaises(ValueError):
            build_site(site, self.output)
        self.assertEqual(previous, self.version("beta"))
        self.assertTrue((self.output / "beta/resources/notes.md").is_file())

    def test_same_output_is_single_writer(self):
        with staged_output(self.output) as candidate:
            candidate.mkdir()
            with self.assertRaisesRegex(ValueError, "Another Atlas build"):
                build(DEMO, DEMO.parent / "materials", self.output)
        self.assertTrue((self.output / MARKER).exists())

    def test_private_unlisted_and_outside_paths(self):
        config, _ = self.new_course("alpha")
        material = config.parent / "materials"
        (material / "unlisted.md").write_text("must stay out")
        build(config, material, self.output)
        self.assertFalse((self.output / "resources/unlisted.md").exists())
        data = read(config)
        data["resources"][0]["files"] = ["../course.json"]
        config.write_text(json.dumps(data))
        with self.assertRaises(ValueError):
            build(config, material, self.output)


if __name__ == "__main__":
    unittest.main()

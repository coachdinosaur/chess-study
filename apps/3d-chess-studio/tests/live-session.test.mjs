import assert from "node:assert/strict";
import test from "node:test";
import {
  createStudentLiveUrl,
  createTeacherLiveUrl,
  generateRoomCode,
  parseLiveRoomFromUrl,
} from "../app/live-session.ts";

test("generateRoomCode generates valid 3D-XXXX room codes", () => {
  const code1 = generateRoomCode();
  const code2 = generateRoomCode();
  assert.match(code1, /^3D-[A-Z0-9]{4}$/);
  assert.match(code2, /^3D-[A-Z0-9]{4}$/);
});

test("createStudentLiveUrl and createTeacherLiveUrl generate proper hashes", () => {
  const studentUrl = createStudentLiveUrl("3D-TEST");
  const teacherUrl = createTeacherLiveUrl("3D-TEST");
  assert.match(studentUrl, /#room=3D-TEST&role=student$/);
  assert.match(teacherUrl, /#room=3D-TEST&role=teacher$/);
});

test("parseLiveRoomFromUrl parses valid hashes", () => {
  const testUrl = "http://localhost:3000/3d/#room=3D-ABCD&role=student";
  const parsed = parseLiveRoomFromUrl(testUrl);
  assert.deepEqual(parsed, {
    roomId: "3D-ABCD",
    role: "student",
  });

  const teacherUrl = "http://localhost:3000/3d/#room=3D-WXYZ&role=teacher";
  const parsedTeacher = parseLiveRoomFromUrl(teacherUrl);
  assert.deepEqual(parsedTeacher, {
    roomId: "3D-WXYZ",
    role: "teacher",
  });

  const invalidUrl = "http://localhost:3000/3d/#someOtherHash";
  assert.equal(parseLiveRoomFromUrl(invalidUrl), null);
});

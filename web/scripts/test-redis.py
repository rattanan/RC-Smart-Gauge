"""Test the exact deployed Lua script using isolated fakeredis + Lua.
Install test dependencies with pip install 'fakeredis[lua]==2.32.1'.
"""
import json
import pathlib
import re
import fakeredis

source = (pathlib.Path(__file__).parents[1] / "src/lib/store.ts").read_text(encoding="utf-8")
script = re.search(r"export const INGEST_LUA = `(.+?)`;", source, re.S).group(1)
db = fakeredis.FakeRedis(decode_responses=True)
prefix = "rcsg:{rc-01}:retired:"
def send(boot, seq, capture, at):
    reading = {"packet": {"boot_id": boot, "seq": seq, "t_capture_us": capture}, "receivedAt": at}
    return db.eval(script, 2, "rcsg:{rc-01}:latest", prefix + boot, json.dumps(reading), prefix)
assert send("a", 1, 100, 1000) == "accepted"
assert send("a", 1, 100, 1200) == "order"
assert send("a", 2, 99, 1200) == "order"
assert send("a", 2, 200, 1050) == "rate"
assert send("a", 2, 200, 1200) == "accepted"
assert send("b", 0, 0, 1400) == "accepted"
assert send("a", 3, 300, 1600) == "retired"
assert json.loads(db.get("rcsg:{rc-01}:latest"))["packet"]["boot_id"] == "b"
assert db.ttl("rcsg:{rc-01}:latest") > 86000
print("Redis Lua: 9 acceptance, replay, reboot, rate and TTL checks passed")

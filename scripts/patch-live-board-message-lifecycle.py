from pathlib import Path

VERSION = "20260725-message-lifecycle1"

messages_path = Path("live-board-messages-v2.js")
messages = messages_path.read_text(encoding="utf-8")

old_vars = """  var stopped = false;\n  var lastRenderedSignature = null;\n"""
new_vars = """  var stopped = false;\n  var lastRenderedSignature = null;\n  var initializedSessionKey = '';\n  var initializationInFlight = false;\n  var initializationTimer = null;\n"""
if old_vars not in messages:
    raise SystemExit("Message lifecycle variable marker was not found")
messages = messages.replace(old_vars, new_vars, 1)

old_session_details = """  function sessionDetails() {\n    var hash = hashParams();\n    var search = new URLSearchParams(location.search);\n    return {\n      roomCode: normalizeRoomCode(hash.get('room') || search.get('room')),\n      role: hash.get('role') || search.get('role') || '',\n      accessToken: hash.get('access') || ''\n    };\n  }\n"""
new_session_details = """  function sessionDetails() {\n    var hash = hashParams();\n    var search = new URLSearchParams(location.search);\n    var roomCode = normalizeRoomCode(hash.get('room') || search.get('room'));\n    var role = hash.get('role') || search.get('role') || '';\n    var accessToken = hash.get('access') || '';\n\n    if (!accessToken && roomCode && role === 'teacher') {\n      try {\n        var saved = JSON.parse(sessionStorage.getItem('live-board-credentials:' + roomCode) || 'null');\n        if (saved && saved.role === 'teacher') accessToken = saved.teacherToken || '';\n      } catch (_) {}\n    }\n\n    return { roomCode: roomCode, role: role, accessToken: accessToken };\n  }\n\n  function validSessionDetails(details) {\n    return Boolean(\n      details &&\n      details.roomCode &&\n      details.accessToken &&\n      (details.role === 'teacher' || details.role === 'student')\n    );\n  }\n\n  function sessionKey(details) {\n    if (!validSessionDetails(details)) return '';\n    return [details.roomCode, details.role, details.accessToken].join('|');\n  }\n\n  function detailsFromReadyEvent(event) {\n    var detail = event && event.detail && typeof event.detail === 'object' ? event.detail : {};\n    return {\n      roomCode: normalizeRoomCode(detail.roomCode),\n      role: detail.role === 'teacher' || detail.role === 'student' ? detail.role : '',\n      accessToken: String(detail.accessToken || '')\n    };\n  }\n"""
if old_session_details not in messages:
    raise SystemExit("sessionDetails marker was not found")
messages = messages.replace(old_session_details, new_session_details, 1)

old_initialize_start = """  async function initialize() {\n    var panel = document.getElementById('sessionMessages');\n    if (!panel) return;\n\n    var details = sessionDetails();\n    if (!details.roomCode || !details.accessToken || !['teacher', 'student'].includes(details.role)) {\n      return;\n    }\n\n    if (!window.supabase || typeof window.supabase.createClient !== 'function') {\n      panel.hidden = false;\n      setStatus('Messages could not connect.', true);\n      return;\n    }\n\n    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {\n"""
new_initialize_start = """  async function initializeForSession(details) {\n    var panel = document.getElementById('sessionMessages');\n    if (!panel) return false;\n\n    var key = sessionKey(details);\n    if (!key || initializedSessionKey === key || initializationInFlight) {\n      return initializedSessionKey === key;\n    }\n\n    initializationInFlight = true;\n    try {\n      if (!window.supabase || typeof window.supabase.createClient !== 'function') {\n        panel.hidden = false;\n        setStatus('Messages could not connect.', true);\n        return false;\n      }\n\n      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {\n"""
if old_initialize_start not in messages:
    raise SystemExit("initialize start marker was not found")
messages = messages.replace(old_initialize_start, new_initialize_start, 1)

old_initialize_end = """    window.LiveBoardMessages = {\n      refresh: function () { return refresh(details); }\n    };\n  }\n\n  window.addEventListener('beforeunload', function () {\n"""
new_initialize_end = """      initializedSessionKey = key;\n      window.LiveBoardMessages = {\n        refresh: function () { return refresh(details); },\n        sessionKey: key\n      };\n      return true;\n    } finally {\n      initializationInFlight = false;\n    }\n  }\n\n  function scheduleInitializationCheck(delay) {\n    if (stopped || initializedSessionKey || initializationTimer) return;\n    initializationTimer = window.setTimeout(function () {\n      initializationTimer = null;\n      initializeWhenReady();\n    }, Math.max(100, Number(delay) || 400));\n  }\n\n  async function initializeWhenReady(preferredDetails) {\n    if (stopped || initializedSessionKey || initializationInFlight) return;\n\n    var details = validSessionDetails(preferredDetails) ? preferredDetails : sessionDetails();\n    if (!validSessionDetails(details)) {\n      scheduleInitializationCheck(document.hidden ? 1500 : 400);\n      return;\n    }\n\n    try {\n      var started = await initializeForSession(details);\n      if (!started && !initializedSessionKey) scheduleInitializationCheck(1000);\n    } catch (error) {\n      console.warn('Could not initialize Live Board messages.', error);\n      setStatus('Messages could not connect.', true);\n      scheduleInitializationCheck(1200);\n    }\n  }\n\n  function handleSessionReady(event) {\n    var details = detailsFromReadyEvent(event);\n    initializeWhenReady(validSessionDetails(details) ? details : null);\n  }\n\n  window.addEventListener('live-board-session-ready', handleSessionReady);\n  window.addEventListener('hashchange', function () { initializeWhenReady(); });\n  window.addEventListener('popstate', function () { initializeWhenReady(); });\n\n  window.addEventListener('beforeunload', function () {\n"""
if old_initialize_end not in messages:
    raise SystemExit("initialize end marker was not found")
messages = messages.replace(old_initialize_end, new_initialize_end, 1)

old_beforeunload = """    stopped = true;\n    if (pollTimer) window.clearTimeout(pollTimer);\n    if (realtimeChannel) realtimeChannel.unsubscribe();\n  });\n\n  if (document.readyState === 'loading') {\n    document.addEventListener('DOMContentLoaded', initialize, { once: true });\n  } else {\n    initialize();\n  }\n"""
new_beforeunload = """    stopped = true;\n    if (initializationTimer) window.clearTimeout(initializationTimer);\n    if (pollTimer) window.clearTimeout(pollTimer);\n    if (realtimeChannel) realtimeChannel.unsubscribe();\n  });\n\n  if (document.readyState === 'loading') {\n    document.addEventListener('DOMContentLoaded', function () { initializeWhenReady(); }, { once: true });\n  } else {\n    initializeWhenReady();\n  }\n"""
if old_beforeunload not in messages:
    raise SystemExit("DOMContentLoaded marker was not found")
messages = messages.replace(old_beforeunload, new_beforeunload, 1)
messages_path.write_text(messages, encoding="utf-8")

realtime_path = Path("live-board-realtime.js")
realtime = realtime_path.read_text(encoding="utf-8")
old_write_hash = """  function writeTeacherHash(roomCode, credentials) {\n    var hash = new URLSearchParams();\n    hash.set('room', roomCode);\n    hash.set('role', 'teacher');\n    hash.set('access', credentials.accessToken);\n    hash.set('student', credentials.studentToken);\n    history.replaceState(null, '', location.pathname + location.search + '#' + hash.toString());\n  }\n"""
new_write_hash = """  function writeTeacherHash(roomCode, credentials) {\n    var hash = new URLSearchParams();\n    hash.set('room', roomCode);\n    hash.set('role', 'teacher');\n    hash.set('access', credentials.accessToken);\n    hash.set('student', credentials.studentToken);\n    history.replaceState(null, '', location.pathname + location.search + '#' + hash.toString());\n    window.dispatchEvent(new CustomEvent('live-board-session-ready', {\n      detail: {\n        roomCode: roomCode,\n        role: 'teacher',\n        accessToken: credentials.accessToken\n      }\n    }));\n  }\n"""
if old_write_hash not in realtime:
    raise SystemExit("writeTeacherHash marker was not found")
realtime = realtime.replace(old_write_hash, new_write_hash, 1)
realtime_path.write_text(realtime, encoding="utf-8")

html_path = Path("live-board.html")
html = html_path.read_text(encoding="utf-8")
html = html.replace(
    "./live-board-realtime.js?v=20260723-channel-sync1",
    f"./live-board-realtime.js?v={VERSION}",
    1,
)
html = html.replace(
    "./live-board-messages-v2.js",
    f"./live-board-messages-v2.js?v={VERSION}",
    1,
)
if f"live-board-realtime.js?v={VERSION}" not in html or f"live-board-messages-v2.js?v={VERSION}" not in html:
    raise SystemExit("Live Board asset versions were not updated")
html_path.write_text(html, encoding="utf-8")

print("Patched Live Board message lifecycle and asset versions")

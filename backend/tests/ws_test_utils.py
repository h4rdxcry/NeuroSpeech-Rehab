"""Bounded WebSocket reads for Starlette's supported test transports.

The public synchronous test-session API has no receive timeout. Keep this small
transport adapter in tests, with explicit failure on an unsupported transport.
Do not hide application exceptions or malformed server JSON as empty results.
"""
import json
import queue
import time

import anyio


def _receive_event(ws, timeout):
    if hasattr(ws, "_send_queue"):
        # The pinned Starlette 0.37 test client uses a thread-safe queue.
        try:
            return ws._send_queue.get(timeout=timeout)
        except queue.Empty as exc:
            raise TimeoutError("WebSocket receive deadline reached") from exc

    if hasattr(ws, "_send_rx"):
        # Newer Starlette test clients use an AnyIO receive stream.
        async def receive_stream_event():
            with anyio.fail_after(timeout):
                return await ws._send_rx.receive()

        try:
            return ws.portal.call(receive_stream_event)
        except anyio.EndOfStream:
            return {"type": "websocket.close"}

    raise AssertionError("Unsupported Starlette WebSocket test transport")


def collect_ws_messages(ws, timeout=5.0):
    messages = []
    deadline = time.monotonic() + timeout
    while (remaining := deadline - time.monotonic()) > 0:
        try:
            event = _receive_event(ws, remaining)
        except TimeoutError:
            break
        if isinstance(event, BaseException):
            raise event
        if event.get("type") in ("websocket.disconnect", "websocket.close"):
            break
        if "text" in event:
            messages.append(json.loads(event["text"]))
    return messages
